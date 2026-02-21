# サマリ実況にストーリー性を持たせる

Issue: https://github.com/mizunashi-mana/cc-voice-reporter/issues/52

## 目的・ゴール

Summarizer が生成する要約に前回の要約との繋がり（ストーリー性）を持たせ、進捗の流れが分かるようにする。

## 実装方針

1. `ActivityEvent` に `session` フィールドを追加し、`createToolUseEvent` / `createTextEvent` にセッション引数を追加
2. `Summarizer` 内部のイベント蓄積をセッション別 `Map<string, ActivityEvent[]>` に変更
   - 異なるセッションのイベントが混在しないようにする
3. `lastSummaryBySession: Map<string, string>` で前回の要約をセッションごとに保持
4. `buildPrompt` に `previousSummary` 引数を追加し、存在する場合「前回の要約」セクションをプロンプトに含める
5. `buildSystemPrompt` に「前回の要約からの差分を意識し、進捗の流れが分かるように要約する」旨の指示を追加
6. `doFlush` でセッションごとに要約を生成し、成功時に `lastSummaryBySession` を更新
7. `Daemon` から `summarizer.record` を呼ぶ際にセッション情報を渡す
8. テストを追加・更新

## 完了条件

- [x] イベントがセッション別に蓄積される
- [x] 前回の要約がセッション別に保持され、次回の Ollama リクエストにコンテキストとして含まれる
- [x] システムプロンプトにストーリー性の指示がある
- [x] 既存テストが通る
- [x] 新規テストが追加されている
- [x] `npm run build` / `npm run lint` / `npm test` がすべて通る

## 作業ログ

- ActivityEvent に session フィールドを追加
- createToolUseEvent / createTextEvent にセッション引数を追加
- Summarizer の内部イベント蓄積を `eventsBySession: Map<string, ActivityEvent[]>` に変更
- `lastSummaryBySession: Map<string, string>` で前回要約をセッション別に保持
- `buildPrompt` に `previousSummary` 引数を追加（存在時に「Previous narration:」セクションを出力）
- `buildSystemPrompt` にストーリー継続の指示を追加
- `doFlush` をセッション単位でイテレーションする方式に変更
- Daemon から summarizer.record にセッション情報を渡すよう修正
- テスト 12 件追加（セッション別蓄積、前回要約コンテキスト、セッション別保持など）
- 全 312 テストパス、ビルド・リントクリーン
