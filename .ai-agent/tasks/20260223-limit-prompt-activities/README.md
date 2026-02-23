# アクティビティが多すぎると要約生成に失敗する (Issue #123)

## 目的・ゴール

`buildPrompt()` にイベント数の制限を追加し、大量アクティビティ蓄積時でも要約生成が安定して動作するようにする。

## 実装方針

二段階制限方式:

1. **第一段階 (FILTER_THRESHOLD = 10)**: イベント数が 10 を超えた場合、テキストイベント（message）を優先し、残りスロットにツールイベントを配置
2. **第二段階 (maxPromptEvents, デフォルト 30)**: ハードキャップ。超過時は直近のイベントを優先。設定で変更可能
3. 切り詰めた場合はプロンプトに省略情報を追加
4. `baseUrl` のデフォルト値を CLI 側で埋め、Summarizer では必須パラメータに変更

### 変更対象

- `packages/cc-voice-reporter/src/monitor/summarizer.ts` — `selectEventsForPrompt()` 追加、`buildPrompt()` にイベント選択ロジック追加、`SummarizerOptions` で `maxPromptEvents` 必須化・`baseUrl` 必須化
- `packages/cc-voice-reporter/src/monitor/summarizer-prompt-limit.test.ts` — イベント制限テスト（新規）
- `packages/cc-voice-reporter/src/monitor/summarizer.test.ts` — `createSummarizer` に `maxPromptEvents` 追加
- `packages/cc-voice-reporter/src/cli/config.ts` — `ConfigSchema` に `maxPromptEvents` 追加、`resolveOptions` でデフォルト値を埋める
- `packages/cc-voice-reporter/src/cli/config.test.ts` — テスト更新

## 完了条件

- [x] `buildPrompt()` がイベント数上限を持つ
- [x] 10 件超で text イベント優先フィルタが動作する
- [x] 30 件超でハードキャップが動作する
- [x] 省略時にプロンプトに省略情報が含まれる
- [x] 上限は設定で変更可能
- [x] `baseUrl` のデフォルト値を CLI 側で管理
- [x] 既存テストが全て通る
- [x] 新規テストが追加されている
- [x] `npm run build` / `npm run lint` / `npm test` が通る

## 作業ログ

- `selectEventsForPrompt()` を新規追加し、二段階フィルタリングを実装
- `SummarizerOptions.maxPromptEvents` を必須化、`SummarizerOptions.ollama.baseUrl` を必須化
- CLI の `config.ts` で `DEFAULT_MAX_PROMPT_EVENTS = 30`、`DEFAULT_OLLAMA_BASE_URL` のデフォルト値を埋める
- テストファイルサイズが max-lines に引っかかったため `summarizer-prompt-limit.test.ts` に分離
