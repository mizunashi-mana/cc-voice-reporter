# Transcript JSONL 監視方式への移行調査

調査日: 2026-02-15

## 調査の問い

- 現在のフックベース方式から、transcript .jsonl ファイル監視方式へ移行することは実現可能か？
- フック方式を廃止して .jsonl 監視に一本化する場合の注意点は何か？
- 最適な実装方式はどれか？

## 背景

cc-voice-reporter は Claude Code のフック機構を利用し、ツール実行・通知・完了などのイベントを `say` コマンドで音声報告している。しかしフック方式では **Claude のテキスト応答（方針説明、結果報告など）** を取得できない。

Claude Code は会話の全内容を `~/.claude/projects/{encoded-path}/{session-id}.jsonl` にリアルタイムで書き出しており、このファイルを監視すれば Claude のテキスト出力を含む全情報にアクセスできる。

## 調査方法

- transcript .jsonl ファイルの実データ分析（構造、書き込みパターン）
- Node.js ファイル監視ライブラリの比較調査
- Claude Code CLI の公式出力オプション調査
- 類似プロジェクトの調査

## 調査結果

### 1. アプローチの比較

3つの選択肢が存在する:

| 項目 | A: フック方式（現行） | B: transcript .jsonl 監視 | C: `--output-format stream-json` |
|------|----------------------|--------------------------|----------------------------------|
| 概要 | 公式フックイベントで say 実行 | transcript ファイルを tail して読み上げ | CLI 出力をパイプで処理 |
| Claude テキスト応答 | 取得不可 | **取得可能** | **取得可能** |
| ツール実行情報 | 取得可能 | 取得可能 | 取得可能 |
| thinking（内部思考） | 取得不可 | 取得可能 | 取得可能 |
| インタラクティブモード | 対応 | 対応 | **非対応**（`-p` 必須） |
| フォーマット安定性 | 公式 API | 内部フォーマット（変更リスク） | 公式 API |
| 起動方式 | フック設定で自動 | 別プロセスとしてデーモン起動 | Claude Code 起動時にパイプ |
| 複数セッション監視 | 自動（フックごと） | 可能（glob 監視） | 不可（1プロセス1セッション） |
| 依存関係 | なし（say のみ） | ファイル監視ライブラリ | なし |

### 2. 方式 C (`--output-format stream-json`) の評価

Claude Code CLI は以下のオプションをサポートしている:

```bash
claude -p "query" --output-format stream-json
claude -p "query" --output-format stream-json --include-partial-messages
```

ただし `-p` フラグ（非インタラクティブモード）が必須。日常的にインタラクティブモードで Claude Code を使う場合、この方式は使えない。ユーザーのワークフローを大きく変える必要があるため、**今回の目的には不適合**。

### 3. Transcript .jsonl ファイルの構造

#### ファイルパス

```
~/.claude/projects/-{encoded-cwd}/{session-uuid}.jsonl
~/.claude/projects/-{encoded-cwd}/{session-uuid}/subagents/agent-{id}.jsonl
```

`encoded-cwd` はプロジェクトディレクトリのパスで `/` を `-` に置換したもの。

#### NDJSON フォーマット

各行が完全な JSON オブジェクト（Newline Delimited JSON）。行単位でアトミックに追記される。

#### 主要なレコードタイプ

| type | 説明 | 読み上げ対象 |
|------|------|-------------|
| `assistant` + content `text` | Claude のテキスト応答 | **対象** |
| `assistant` + content `tool_use` | ツール呼び出し | 対象（ツール名・概要） |
| `assistant` + content `thinking` | 内部思考 | 除外（冗長） |
| `user` + content `tool_result` | ツール実行結果 | 除外（巨大） |
| `progress` | MCP ツール進捗 | 除外 |
| `file-history-snapshot` | ファイル履歴 | 除外 |

#### ストリーミングの書き込みパターン

1つの API リクエスト/レスポンスサイクルは **同じ `requestId` を持つ複数行** として記録される:

```
行1: {requestId: "req_XXX", content: [{type: "text", text: "\n\n"}]}
行2: {requestId: "req_XXX", content: [{type: "thinking", thinking: "..."}]}
行3: {requestId: "req_XXX", content: [{type: "text", text: "実際の応答テキスト..."}]}
行4: {requestId: "req_XXX", content: [{type: "tool_use", ...}]}
```

各行はミリ秒間隔で追記される。`"\n\n"` のみの初期テキストブロックは無視すべき。

### 4. ファイル監視ライブラリの比較

| ライブラリ | レイテンシ | macOS 信頼性 | ファイルローテーション | 依存数 | メンテナンス |
|-----------|-----------|------------|-------------------|--------|------------|
| `@logdna/tail-file` | 良好（設定可能） | 高（本番実績） | 優秀（データロスなし） | 0 | 1年前更新 |
| `chokidar` + 自前 tail | 優秀（0-100ms） | 優秀（FSEvents） | 要自前実装 | 少数 | 2025/11 v5 |
| `tail`（node-tail） | 良好（~100ms） | 中（fs.watch 依存） | サポートあり | 0 | 3年前更新 |
| `fs.watch`（組込） | 良好（~100ms） | 中（イベント欠落あり） | 要自前実装 | 0 | Node.js コア |
| `tail -f` spawn | 優秀 | 優秀 | `tail -F` で対応 | 0 | Unix 標準 |

#### 推奨: chokidar + 自前 tail ロジック

理由:
- macOS の FSEvents をネイティブに利用し、最も低レイテンシ
- v5 が 2025/11 にリリースされ活発にメンテナンスされている
- ファイル監視部分は最も信頼性が高い
- tail ロジックは単純（ファイルポジション追跡 + readline）なので自前実装のコストは低い
- 新規 .jsonl ファイルの検出にも chokidar のディレクトリ監視が使える

次点: `@logdna/tail-file`（zero deps で tail ロジック込み、ただし更新頻度がやや低い）

### 5. 類似プロジェクト

音声通知系:

| プロジェクト | 方式 | TTS |
|-------------|------|-----|
| [cc-hooks](https://github.com/husniadil/cc-hooks) | フック | AI TTS + 効果音 |
| [claude-code-voice-handler](https://github.com/markhilton/claude-code-voice-handler) | フック | OpenAI TTS |
| [claude-code-tts](https://git.sr.ht/~cg/claude-code-tts) | フック | Kokoro TTS |
| [clarvis](https://github.com/nickpending/clarvis) | フック | LLM 要約 + TTS |
| [claude-code-voice-notifications](https://github.com/ZeldOcarina/claude-code-voice-notifications) | フック | ElevenLabs TTS |

既存プロジェクトは **すべてフック方式** を採用。transcript .jsonl 監視方式で音声出力を行うプロジェクトは見つからなかった。

Transcript 解析系:

| プロジェクト | 目的 |
|-------------|------|
| [claude-code-transcripts](https://github.com/simonw/claude-code-transcripts) | HTML 変換・公開 |
| [claude-code-log](https://github.com/daaain/claude-code-log) | JSONL → HTML |
| [ccusage](https://github.com/ryoppippi/ccusage) | 使用量分析 |

これらは事後分析ツールで、リアルタイム監視ではない。

### 6. 実装上の注意点

#### アクティブセッションの特定

- `~/.claude/projects/-{encoded-cwd}/` 配下の .jsonl ファイルの更新時刻を監視
- 最新の更新時刻を持つファイルをアクティブセッションとして追跡
- chokidar でディレクトリを監視すれば新規セッション開始も検出可能

#### テキスト応答の組み立て

- 同じ `requestId` の行をグループ化
- `content` 配列から `type === "text"` のブロックを抽出
- `"\n\n"` のみのブロックは無視
- 行がミリ秒間隔で追記されるため、デバウンス（~500ms-1s）で完了を判定

#### 読み上げキュー管理

- `say` コマンドは非同期だが排他制御が必要
- 前の読み上げ完了前に次のテキストが来た場合のキュー処理
- 長すぎるテキストの切り詰めまたは要約

#### tool_use からの情報抽出

- フック方式で行っていたツール名・引数の読み上げは .jsonl からも可能
- `content` 配列に `type === "tool_use"` があれば同等の情報を取得できる
- ツール結果（`tool_result`）は巨大なため無視

#### プロセスのライフサイクル

- フック方式: イベントごとに起動・終了（ステートレス）
- .jsonl 監視方式: **常駐デーモン** として動作する必要がある
- デーモンの起動・停止の仕組みが必要（手動 or launchd）

#### 内部フォーマット変更リスク

- .jsonl の構造は Claude Code の内部実装に依存
- バージョンアップ時にフィールド名・構造が変わる可能性がある
- 防御的パース（未知フィールドの無視、必須フィールドの欠落時のフォールバック）が重要

## 結論

### 推奨: 方式 B（transcript .jsonl 監視）への移行

理由:
1. **Claude のテキスト応答を読み上げできる** — これが最大の価値。フック方式では得られない情報
2. **ツール情報も取得可能** — フック方式の機能をカバーできる
3. **既存プロジェクトにない差別化** — 類似プロジェクトはすべてフック方式で、transcript 監視による音声出力は前例がない
4. **方式 C は不適合** — インタラクティブモードで使えないため現実的でない

### 注意点・リスク

1. **内部フォーマット依存**: Claude Code バージョンアップ時に追従が必要。防御的パースで影響を最小化する
2. **アーキテクチャ変更**: ステートレスなフックスクリプトから常駐デーモンへの転換。起動・停止の仕組みが必要
3. **前例なし**: リアルタイム .jsonl 監視 + 音声出力の組み合わせは既存プロジェクトにない。先行事例がないため未知の問題に遭遇する可能性がある

### 推奨技術スタック

| コンポーネント | 推奨 |
|-------------|------|
| ファイル監視 | chokidar v5 |
| JSONL パース | 自前（`JSON.parse` + 行分割） |
| 音声出力 | macOS `say` コマンド（変更なし） |
| プロセス管理 | 手動起動 or npm script |

## 参考リンク

- [Claude Code CLI リファレンス](https://code.claude.com/docs/en/cli-reference)
- [Claude Code Hooks ドキュメント](https://code.claude.com/docs/en/hooks-guide)
- [chokidar](https://github.com/paulmillr/chokidar) — ファイル監視ライブラリ
- [@logdna/tail-file](https://github.com/logdna/tail-file-node) — JSONL tail ライブラリ
- [claude-code-transcripts](https://github.com/simonw/claude-code-transcripts) — transcript 解析の参考
- [ccusage](https://github.com/ryoppippi/ccusage) — transcript 解析の参考
- [clarvis](https://github.com/nickpending/clarvis) — LLM 要約 + 音声通知
