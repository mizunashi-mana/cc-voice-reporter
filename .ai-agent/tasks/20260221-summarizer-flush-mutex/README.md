# Summarizer の flush に排他制御を追加し Ollama 同時リクエストを防止する

Issue: https://github.com/mizunashi-mana/cc-voice-reporter/issues/58

## 目的・ゴール

Summarizer の `flush()` に排他制御を追加し、Ollama への同時リクエストを防止する。前回の Ollama リクエストが完了するまで次の flush を開始しないようにする。

## 実装方針

1. `flush()` に Promise チェーンベースの排他ロック (`flushLock`) を追加
2. flush 中に溜まったイベントはマージし、完了後に1回で処理
3. スロットル間隔のデフォルトを 5 秒に変更し、前回 flush **完了時点**から再スケジュール
4. イベント蓄積中に何回 trigger があっても flush は1回に集約

## 完了条件

- [x] `flush()` が排他制御され、同時に1つしか Ollama リクエストが実行されない
- [x] flush 中に蓄積されたイベントが完了後に1回で処理される
- [x] スロットルタイマーが flush 完了時点から再スケジュールされる
- [x] デフォルトのスロットル間隔が 5 秒に変更されている
- [x] 既存テストが通る + 新規テストが追加されている
- [x] `npm run build` / `npm run lint` / `npm test` がすべて通る

## 作業ログ

- `src/summarizer.ts`: `flushLock` Promise チェーンによる排他制御を追加。`flush()` → `doFlush()` に分離。`scheduleThrottledFlush()` が flush 完了後にイベントがあれば再スケジュールするように変更。`DEFAULT_INTERVAL_MS` を 1000 → 5000 に変更。
- `src/summarizer.test.ts`: flush serialization テスト3件 + throttle reschedule テスト1件を追加。
- `src/config.ts`: intervalMs デフォルトコメントを 60000 → 5000 に更新。
