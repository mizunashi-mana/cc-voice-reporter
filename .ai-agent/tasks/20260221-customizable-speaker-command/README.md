# 音声出力コマンドを設定でカスタマイズ可能にする

Issue: https://github.com/mizunashi-mana/cc-voice-reporter/issues/55

## 目的・ゴール

`say` コマンドにハードコードされている音声出力コマンドを、設定ファイルでカスタマイズ可能にする。これにより:

- macOS 以外の環境（Linux の espeak など）でも利用可能にする
- VOICEVOX などの代替 TTS エンジンを使えるようにする
- 音声の声質やスピードなどのオプションをカスタマイズ可能にする（plan.md フェーズ 5「音声の設定」を兼ねる）

## 実装方針

### 設定スキーマ

`config.json` の `speaker` セクションに `command` フィールド（文字列の配列）を追加:

```json
{
  "speaker": {
    "command": ["say"]
  }
}
```

実行時: `execFile(command[0], [...command.slice(1), message])`

### 変更対象ファイル

1. **`src/config.ts`**: `ConfigSchema` の `speaker` に `command: z.array(z.string()).min(1).optional()` を追加
2. **`src/speaker.ts`**: `SpeakerOptions` に `command` を追加し、デフォルト executor を `command` ベースに変更
3. **`src/config.test.ts`**: command フィールドのバリデーションテストを追加
4. **`src/speaker.test.ts`**: command 指定時のテストを追加

### デフォルト動作

- `command` 未指定時は `["say"]` と同じ動作を維持（後方互換性）
- `executor` が指定されている場合は `executor` が優先（テスト用）

## 完了条件

- [x] `speaker.command` を設定ファイルで指定できる
- [x] 未設定時は `["say"]` と同じ動作を維持
- [x] `npm run build` がエラーなく通る
- [x] `npm run lint` がエラーなく通る
- [x] `npm test` が全て通る
- [x] plan.md を更新（フェーズ 5「音声の設定」をこの Issue で完了とする）

## 作業ログ

- `config.ts`: `speaker` セクションに `command: z.array(z.string()).min(1).optional()` を追加
- `speaker.ts`: `SpeakerOptions` に `command` フィールドを追加。コンストラクタでデフォルト executor を `command` ベースに変更（`const [bin = 'say', ...fixedArgs] = cmd`）
- `config.test.ts`: `speaker.command` の受理テスト、空配列の拒否テスト、full config テストに command を追加
- `speaker.test.ts`: executor が command より優先されることのテストを追加
- `plan.md`: フェーズ 5「音声の設定」を完了済みに更新
