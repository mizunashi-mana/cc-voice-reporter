# 常駐デーモンの実装（watcher + parser + speaker 統合）

## 目的

Phase 2 のコアとなる常駐デーモンを実装する。TranscriptWatcher で新規行を検出し、parser でメッセージを抽出し、Speaker で音声出力する統合モジュール。

## ゴール

- `src/daemon.ts` を新規作成: Daemon クラス + CLI エントリポイント
- `src/daemon.test.ts` を新規作成: テスト

## 実装方針

### Daemon クラス

- TranscriptWatcher → parser.processLines() → Speaker.speak() のパイプライン
- テキストメッセージのデバウンス: 同一 requestId のテキストを一定時間（500ms）バッファリングし、結合して一括読み上げ
- tool_use メッセージは即時読み上げ（デバウンスなし）
- SIGINT/SIGTERM で graceful shutdown

### tool_use メッセージのフォーマット

- ツール名と引数からシンプルな日本語メッセージを生成
- 将来の整理タスクで index.ts のロジックと統合予定

### CLI エントリポイント

- `main()` 関数で起動
- SIGINT/SIGTERM でデーモン停止
- stderr にログ出力

## 完了条件

- [ ] `src/daemon.ts` が実装されている
- [ ] `src/daemon.test.ts` でテストが網羅されている
- [ ] `npm run build` が通る
- [ ] `npm run lint` が通る
- [ ] `npm test` が通る
- [ ] structure.md が更新されている

## 作業ログ

- `src/daemon.ts` を実装: Daemon クラス + formatToolUse + CLI エントリポイント
- `src/daemon.test.ts` を実装: 24 テストケース（デバウンス、tool_use 即時発話、混合コンテンツ、stop 時のフラッシュ、formatToolUse）
- テスト用に `speakFn` DI を導入（Speaker の非同期キュー処理と fake timer の相互作用を回避）
- `npm run build` 成功
- `npm run lint` 成功
- `npm test` daemon テスト 24/24 通過
- `.ai-agent/structure.md` を更新
