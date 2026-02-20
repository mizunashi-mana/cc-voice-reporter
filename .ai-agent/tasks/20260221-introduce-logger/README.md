# logger 導入タスク

Issue: https://github.com/mizunashi-mana/cc-voice-reporter/issues/41

## 目的・ゴール

`process.stderr.write()` による直接ログ出力を、自前の軽量 logger モジュールに移行し、ログレベル制御・フォーマット統一・テスト容易性を実現する。

## 実装方針

1. `src/logger.ts` を新規作成（外部依存なし）
   - ログレベル: debug / info / warn / error
   - 出力先: process.stderr
   - フォーマット: `[cc-voice-reporter] {level}: {message}`
   - デフォルトレベル: info
2. config.json に `logLevel` フィールド追加
3. 環境変数 `CC_VOICE_REPORTER_LOG_LEVEL` でもオーバーライド可能
4. 既存の `process.stderr.write` を logger 経由に置き換え
5. テスト追加

## 完了条件

- [x] `src/logger.ts` が作成されている
- [x] `src/logger.test.ts` でユニットテストが通る
- [x] 既存の `process.stderr.write` が全て logger 経由に置き換わっている
- [x] config.json に `logLevel` を設定可能
- [x] 環境変数 `CC_VOICE_REPORTER_LOG_LEVEL` で制御可能
- [x] `npm run build` が通る
- [x] `npm run lint` が通る
- [x] `npm test` が通る

## 作業ログ

- 2026-02-21: タスク開始
- 2026-02-21: 実装完了
  - `src/logger.ts` — Logger クラス（debug/info/warn/error）、parseLogLevel、resolveLogLevel
  - `src/logger.test.ts` — 13テスト追加
  - `src/config.ts` — ConfigSchema に `logLevel` フィールド追加
  - `src/cli.ts` — Logger を使用、resolveLogLevel で設定解決
  - `src/daemon.ts` — 全 process.stderr.write を Logger 経由に置換
  - `src/watcher.ts` — Logger を注入可能に、process.stderr.write を置換
  - `src/translator.ts` — デフォルト onWarn を Logger 経由に変更
  - `.ai-agent/structure.md` — logger.ts の説明追加
