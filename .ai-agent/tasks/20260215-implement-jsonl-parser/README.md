# JSONL パーサー + メッセージ抽出・フィルタリング

## 目的

TranscriptWatcher の `onLines` コールバックが返す生の文字列行を、型付きの transcript レコードにパースし、読み上げ対象のメッセージを抽出する。

## 実装方針

1. **JSONL パーサー**: 各行を `JSON.parse` し、transcript レコードの型定義に当てはめる
2. **メッセージ抽出**: `assistant` + `text` / `tool_use` コンテンツの抽出
3. **フィルタリング**: `thinking`, `tool_result`, `progress`, `file-history-snapshot` の除外
4. **テスト**: 上記のユニットテスト

## 完了条件

- [ ] transcript レコードの TypeScript 型定義
- [ ] JSONL 行 → 型付きレコードのパース関数
- [ ] assistant テキスト応答の抽出（`"\n\n"` のみのブロック除外）
- [ ] tool_use 情報の抽出（ツール名・入力）
- [ ] 不要レコードのフィルタリング（thinking, tool_result, progress, file-history-snapshot）
- [ ] ユニットテスト
- [ ] `npm run build` / `npm run lint` / `npm test` パス

## スコープ外

- say コマンドのキュー管理（排他制御）
- 長文テキストの切り詰め処理
- 常駐デーモンとしての起動・停止
- デバウンス処理（同一 requestId のグループ化）

## 作業ログ

- 2026-02-15: タスク作成
