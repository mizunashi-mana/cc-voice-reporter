# say コマンドのキュー管理（排他制御）+ 長文切り詰め処理

## 目的

Phase 2（transcript .jsonl 監視方式）の音声出力インフラとして、say コマンドの排他制御キューと長文テキストの切り詰め処理を実装する。

## ゴール

- `src/speaker.ts` を新規作成: say コマンドのキュー管理モジュール
- `src/speaker.test.ts` を新規作成: テスト

## 実装方針

### Speaker クラス

- メッセージをキューに追加し、1つずつ順番に `say` コマンドで読み上げる（排他制御）
- テスト容易性のため、say コマンド実行部分を注入可能にする
- 長文テキストは指定文字数で切り詰め、サフィックス（「、以下省略」）を付加

### API

- `speak(message)`: メッセージをキューに追加（fire-and-forget）
- `clear()`: キューをクリア（現在の読み上げは停止しない）
- `dispose()`: 現在の読み上げを停止し、キューをクリア
- `pending`: キュー内のメッセージ数
- `isSpeaking`: 読み上げ中かどうか

### 切り詰め処理

- デフォルト最大文字数: 200文字
- 超過時はサフィックス付加
- 設定でカスタマイズ可能

## 完了条件

- [ ] `src/speaker.ts` が実装されている
- [ ] `src/speaker.test.ts` でテストが網羅されている
- [ ] `npm run build` が通る
- [ ] `npm run lint` が通る
- [ ] `npm test` が通る
- [ ] structure.md が更新されている

## 作業ログ

- `src/speaker.ts` を実装: Speaker クラス（キュー管理 + 切り詰め + dispose）
- `src/speaker.test.ts` を実装: 25 テストケース
- `npm run build` 成功
- `npm run lint` 成功
- `npm test` speaker テスト 25/25 通過（watcher の既存 flaky テスト 1件は無関係）
- `.ai-agent/structure.md` を更新
