# chokidar v5 によるファイル監視の実装

## 目的・ゴール

フェーズ 2（transcript .jsonl 監視方式への移行）のコアインフラとして、chokidar v5 を使ったファイル監視モジュールを実装する。

## 実装方針

- chokidar v5 で `~/.claude/projects/` 配下の .jsonl ファイルを監視
- アクティブセッション .jsonl の検出（更新時刻ベース）
- 新規セッション開始時の自動切り替え
- サブエージェント .jsonl の監視
- ファイルポジション追跡（tail ロジック）による差分読み取り

## 完了条件

- [x] chokidar v5 が dependencies に追加されている
- [x] .jsonl ファイルの変更検出が動作する
- [x] アクティブセッションの自動検出・切り替えが動作する
- [x] サブエージェント .jsonl の監視が動作する
- [x] tail ロジックで新規追記行のみ読み取れる
- [x] ユニットテストが通る
- [x] `npm run build` / `npm run lint` / `npm test` が通る

## 作業ログ

### 2026-02-15

- chokidar v5.0.0 を `npm install chokidar` でインストール
- `src/watcher.ts` を新規作成
  - `TranscriptWatcher` クラス: chokidar でディレクトリ監視 + tail ロジック
  - `isSubagentFile()` ユーティリティ関数
  - 初期スキャン時は既存コンテンツをスキップ、ready 後の新規ファイルは先頭から読み取り
  - 不完全行（末尾改行なし）の安全な処理
  - ファイルトランケーション検出・リセット
- `src/watcher.test.ts` を新規作成（11 テスト）
  - 既存ファイルスキップ、新規ファイル読み取り、複数行、不完全行、非 .jsonl 無視、サブディレクトリ監視、トランケーション、close 後の無反応など
- 全 71 テストパス、ビルド・リント成功
