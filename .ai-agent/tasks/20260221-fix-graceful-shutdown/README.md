# fix-graceful-shutdown

GitHub Issue: https://github.com/mizunashi-mana/cc-voice-reporter/issues/45

## 目的・ゴール

Ctrl+C (SIGINT) でプロセスが確実にシャットダウンし、子プロセス（`say` コマンド等）も適切にクリーンアップされるようにする。

## 原因

1. **Speaker が dispose されない**: `daemon.stop()` が `speaker.dispose()` を呼んでいないため、実行中の `say` プロセスがキルされない
2. **シャットダウンにタイムアウトがない**: `cli.ts` のシャットダウンハンドラが `daemon.stop()` の完了を無期限に待つ
3. **エラーハンドリングの欠如**: `void daemon.stop().then(...)` に `.catch()` がなく、例外発生時にプロセスが終了しない

## 実装方針（確定）

- **SIGINT/SIGTERM (Ctrl+C)**: 今再生中のものが終わったら graceful にシャットダウン。2回目のシグナルで強制終了
- **SIGQUIT (Ctrl+\\)**: 即座に強制シャットダウン（say プロセスを kill）
- `Speaker.stopGracefully()`: キューをクリアし、現在の再生完了を待つ
- `Speaker.dispose()`: 即座に kill（強制終了用）
- `Daemon.stop()`: タイマーキャンセル + watcher close + speaker.stopGracefully()
- `Daemon.forceStop()`: タイマーキャンセル + speaker.dispose() + watcher close

## 完了条件

- [x] `daemon.stop()` が `speaker.stopGracefully()` を呼ぶ
- [x] `daemon.forceStop()` が `speaker.dispose()` を呼ぶ
- [x] SIGQUIT で強制シャットダウンする
- [x] エラー時も確実にプロセスが終了する（`.catch()` 追加）
- [x] 既存テストが通る（226 tests passed）
- [x] 新規テストでシャットダウン動作を検証

## 作業ログ

- `src/speaker.ts`: `stopGracefully()` メソッドを追加（キュークリア + 現在の再生完了待ち）
- `src/daemon.ts`: `stop()` をタイマーキャンセル + stopGracefully に変更、`forceStop()` を追加、`cancelPendingTimers()` ヘルパー追加
- `src/cli.ts`: SIGINT/SIGTERM → graceful（2回目は force）、SIGQUIT → force、`.catch()` 追加
- `src/speaker.test.ts`: `stopGracefully` テスト5件追加
- `src/daemon.test.ts`: `stop` テスト2件を新挙動に更新、`forceStop` テスト1件追加、翻訳テスト1件を更新
