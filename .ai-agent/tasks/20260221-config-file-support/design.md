# 設定ファイル対応 設計ドキュメント

## Context

cc-voice-reporter は現在 CLI 引数（`--include`, `--exclude`）のみでオプションを受け取っている。設定ファイルに対応することで、毎回の引数指定が不要になり、`maxLength`・`debounceMs` 等の詳細オプションも永続的に設定可能になる。

## 1. 設定ファイルのフォーマットと配置場所

### フォーマット: JSON

- zod が既に依存にあり、`JSON.parse` + zod バリデーションで完結
- 追加の依存パッケージ不要
- TypeScript との親和性が高い

### 配置場所: XDG Base Directory 準拠

```
$XDG_CONFIG_HOME/cc-voice-reporter/config.json
```

デフォルト（`$XDG_CONFIG_HOME` 未設定時）:

```
~/.config/cc-voice-reporter/config.json
```

**理由**: macOS の CLI ツールでは XDG 準拠が広く採用されている（git, npm 等）。`~/.cc-voice-reporter.json` のようなホームディレクトリ直下のドットファイルよりも整理された配置になる。

### CLI 引数 `--config` による上書き

```
cc-voice-reporter --config ./my-config.json
```

任意の設定ファイルパスを指定可能にする。

## 2. 設定スキーマ（zod 定義）

`src/config.ts` に定義:

```typescript
import { z } from "zod";

export const ConfigSchema = z.object({
  /** 監視対象プロジェクトのフィルタリング */
  filter: z.object({
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
  }).optional(),

  /** 監視ディレクトリ（通常変更不要） */
  projectsDir: z.string().optional(),

  /** デバウンス間隔（ms） */
  debounceMs: z.number().int().positive().optional(),

  /** 音声出力設定 */
  speaker: z.object({
    /** 最大文字数（これを超えると中間省略） */
    maxLength: z.number().int().positive().optional(),
    /** 省略時の区切り文字 */
    truncationSeparator: z.string().optional(),
  }).optional(),
});

export type Config = z.infer<typeof ConfigSchema>;
```

### 設定ファイル例

```json
{
  "filter": {
    "include": ["my-project", "other-project"],
    "exclude": ["/Users/me/Workspace/tmp-project"]
  },
  "debounceMs": 300,
  "speaker": {
    "maxLength": 150,
    "truncationSeparator": "、省略、"
  }
}
```

### スキーマ設計のポイント

- **全フィールド optional**: 設定ファイルには変更したい項目だけ書けばよい
- **フラット寄りの構造**: `watcher.filter` ではなく `filter` をトップレベルに配置。ユーザーが最も使う設定（filter）へのアクセスを簡潔にする
- **テスト専用オプション（`speakFn`, `executor`, `resolveProjectName`）は除外**: 設定ファイルに含めない
- **`projectsDir` はトップレベル**: 上級者向けだが、テスト等で必要になる場合がある

## 3. CLI 引数と設定ファイルの優先順位

```
CLI 引数 > 設定ファイル > デフォルト値
```

### マージルール

- CLI 引数で指定された値は、設定ファイルの同名の値を上書きする
- 設定ファイルに存在しないフィールドはデフォルト値が使われる
- `filter.include` / `filter.exclude` は配列単位で上書き（マージではない）
  - CLI で `--include a` を指定した場合、設定ファイルの `filter.include: ["b", "c"]` は無視される

### CLI 引数の拡張

現在の引数:
- `--include <pattern>` (multiple)
- `--exclude <pattern>` (multiple)

追加する引数:
- `--config <path>` — 設定ファイルパスの明示指定

**追加しない引数**: `--debounceMs`, `--maxLength` 等の詳細オプションは CLI 引数に追加しない。これらは使用頻度が低く、設定ファイルでの指定で十分。CLI 引数を増やしすぎると `--help` が煩雑になる。

## 4. 設定ファイルが存在しない場合のデフォルト動作

- **設定ファイルなし → エラーにしない**: 現在と同じデフォルト値で動作する
- **`--config` で指定したファイルが存在しない → エラー**: 明示指定は存在を期待しているため
- **設定ファイルの JSON パースエラー → エラー**: ファイルが存在するが不正な場合は起動しない
- **設定ファイルの zod バリデーションエラー → エラー**: 不明なキーや型不正は起動時にわかりやすくエラーメッセージを表示

### デフォルト値一覧

| 設定項目 | デフォルト値 | 由来 |
|---------|------------|------|
| `filter.include` | `undefined`（全プロジェクト） | watcher.ts |
| `filter.exclude` | `undefined`（除外なし） | watcher.ts |
| `projectsDir` | `~/.claude/projects` | watcher.ts `DEFAULT_PROJECTS_DIR` |
| `debounceMs` | `500` | daemon.ts |
| `speaker.maxLength` | `100` | speaker.ts |
| `speaker.truncationSeparator` | `"、中略、"` | speaker.ts |

## 5. 実装方針

### ファイル構成

- **新規**: `src/config.ts` — 設定スキーマ定義、設定ファイル読み込み、CLI 引数とのマージ
- **変更**: `src/cli.ts` — `--config` 引数の追加、設定ファイル読み込みの呼び出し、DaemonOptions の組み立て

### 関数インターフェース

#### `loadConfig(configPath?: string): Promise<Config>`

設定ファイルを読み込み・バリデーションする。

- `configPath` 指定時 → そのファイルを読み込み（存在しなければエラー）
- 未指定時 → XDG デフォルトパスを探索（存在しなければ空 `{}` を返す）
- JSON パースエラー・zod バリデーションエラー → エラーをスロー

```typescript
export async function loadConfig(configPath?: string): Promise<Config> {
  const filePath = configPath ?? getDefaultConfigPath();

  let content: string;
  try {
    content = await fs.promises.readFile(filePath, "utf-8");
  } catch (err) {
    if (isNodeError(err) && err.code === "ENOENT") {
      if (configPath !== undefined) {
        throw new Error(`Config file not found: ${filePath}`);
      }
      return {};
    }
    throw err;
  }

  const json: unknown = JSON.parse(content);
  const result = ConfigSchema.safeParse(json);
  if (!result.success) {
    throw new Error(
      `Invalid config file ${filePath}: ${result.error.message}`
    );
  }
  return result.data;
}
```

#### `getDefaultConfigPath(): string`

XDG 準拠のデフォルト設定ファイルパスを返す。

```typescript
function getDefaultConfigPath(): string {
  const xdgConfigHome = process.env["XDG_CONFIG_HOME"]
    ?? path.join(os.homedir(), ".config");
  return path.join(xdgConfigHome, "cc-voice-reporter", "config.json");
}
```

#### `resolveOptions(config, cliArgs): DaemonOptions`

設定ファイルと CLI 引数をマージして DaemonOptions を生成する。

```typescript
export function resolveOptions(
  config: Config,
  cliArgs: { include?: string[]; exclude?: string[] },
): DaemonOptions {
  const filter: ProjectFilter = {};
  const includeSource = cliArgs.include ?? config.filter?.include;
  const excludeSource = cliArgs.exclude ?? config.filter?.exclude;
  if (includeSource) filter.include = includeSource;
  if (excludeSource) filter.exclude = excludeSource;

  return {
    watcher: {
      projectsDir: config.projectsDir,
      filter,
    },
    speaker: config.speaker,
    debounceMs: config.debounceMs,
  };
}
```

### cli.ts の変更イメージ

```typescript
async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      include: { type: "string", multiple: true },
      exclude: { type: "string", multiple: true },
      config: { type: "string" },
    },
  });

  const config = await loadConfig(values.config);
  const options = resolveOptions(config, {
    include: values.include,
    exclude: values.exclude,
  });

  const daemon = new Daemon(options);
  // ... 以降は既存コードと同じ
}
```

## 6. ユーザビリティ要件・受け入れ基準

1. **設定ファイルなしで現在と同じ動作**: 既存ユーザーに影響なし
2. **設定ファイルの JSON エラー・バリデーションエラー時にわかりやすいメッセージ**: ファイルパスと具体的なエラー内容を表示
3. **`--config` で任意のパスを指定可能**: テストや複数設定の切り替えに対応
4. **部分的な設定ファイルが有効**: 全フィールドを書く必要がない（変更したい項目のみ）
5. **CLI 引数が設定ファイルより優先される**: 一時的な上書きが可能

## 7. 品質指標

### テストカバレッジ

- `loadConfig()` のテスト:
  - ファイルなし（デフォルトパス）→ 空設定を返す
  - ファイルなし（`--config` 指定）→ エラー
  - 有効な JSON → パース成功
  - 不正な JSON → パースエラー
  - スキーマ不一致 → バリデーションエラー
  - 部分設定（一部フィールドのみ）→ 成功
- `resolveOptions()` のテスト:
  - 設定ファイルのみ → 設定値が反映
  - CLI 引数のみ → CLI 値が反映
  - 両方指定 → CLI が優先
  - 両方なし → デフォルト値
- `getDefaultConfigPath()` のテスト:
  - `XDG_CONFIG_HOME` 設定あり → そのパスを使用
  - `XDG_CONFIG_HOME` 未設定 → `~/.config/...` を使用

### 既存テストへの影響

- 既存テストは変更不要（DaemonOptions のインターフェースは変更しない）

### コード品質

- 新規コードは既存の lint / type-check をパス
- エラーメッセージは日本語（既存の stderr メッセージに合わせる）

## 8. 検証方法

1. `npm run build` — ビルド成功
2. `npm test` — 全テスト通過（新規テスト含む）
3. `npm run lint` — リントエラーなし
4. 手動検証:
   - 設定ファイルなしで起動 → 現在と同じ動作
   - `~/.config/cc-voice-reporter/config.json` に設定を書いて起動 → 反映される
   - `--config ./test-config.json` で起動 → 指定ファイルの設定が反映
   - 不正な JSON で起動 → わかりやすいエラーメッセージ
   - CLI 引数 `--include` と設定ファイルの `filter.include` を両方指定 → CLI が優先
