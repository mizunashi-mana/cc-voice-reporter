# Logger DI 統一タスク

Issue: https://github.com/mizunashi-mana/cc-voice-reporter/issues/47

## 目的・ゴール

Logger を各コンポーネントでインスタンス化せず、`cli.ts` の main 関数で作成した 1 つの Logger インスタンスをコンストラクタ経由で全コンポーネントに注入する。

## 実装方針

1. **Daemon**: `logLevel` ではなく `Logger` インスタンスを受け取る
2. **TranscriptWatcher**: `options?.logger` のフォールバック `new Logger()` を削除し、Logger を必須パラメータに変更
3. **Translator**: `onWarn` コールバックのデフォルト Logger を削除し、Logger を直接受け取る
4. **Summarizer**: `callbacks` のデフォルト Logger を削除し、Logger を直接受け取る
5. **cli.ts**: main 関数で作成した Logger を Daemon に渡す（Daemon が下位コンポーネントに伝播）
6. テストではモック Logger を注入

## 完了条件

- [x] `new Logger()` が `cli.ts` の main 関数と catch ハンドラ以外に存在しない
- [x] `npm run build` 成功
- [x] `npm run lint` 成功
- [x] `npm test` 成功（312 tests passed）

## 作業ログ

- Daemon: `logLevel?: LogLevel` → `logger: Logger`（必須）に変更。`options` も必須化
- TranscriptWatcher: `WatcherOptions.logger` を必須化、constructor の `options` を必須化
- Translator: 第2引数を `onWarn?: (msg: string) => void` → `logger: Logger` に変更
- Summarizer: 第3引数を `callbacks?` → `logger: Logger` に変更
- DaemonOptions.watcher の型を `Omit<WatcherOptions, "logger">` に変更（logger は Daemon が注入）
- config.ts の `resolveOptions` 返り値型を `Omit<DaemonOptions, "logger">` に変更
- cli.ts: `{ ...options, logLevel }` → `{ ...options, logger }` に変更
- テストファイル: silentLogger / カスタム writeFn Logger を注入するよう修正
