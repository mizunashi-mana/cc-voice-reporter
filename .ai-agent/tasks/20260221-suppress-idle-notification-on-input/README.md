# suppress-idle-notification-on-input

## 目的

ユーザーが既に次のプロンプトを入力済みで新しいターンが開始されている場合に「入力待ちです」の通知を抑制する。

関連 Issue: #38

## 実装方針

キャンセレーショントークン（generation counter）方式:

1. `Daemon` に `turnCompleteGeneration: number` フィールドを追加
2. `handleTurnComplete()` 呼び出し時にインクリメントし、現在値をキャプチャ
3. `handleLines()` で新しい `text` / `tool_use` / `ask_user` メッセージを検出したらインクリメント
4. 非同期チェーン完了後の `speakNotification()` 実行前にトークンが一致するか確認し、不一致ならスキップ

## 完了条件

- [x] 通常の turn_complete 通知が引き続き正常動作する
- [x] 新しいターンが開始された場合に通知が抑制される
- [x] サブエージェントの turn_complete は引き続き無視される
- [x] テストが追加されている
- [x] 全テスト通過（316 tests）

## 作業ログ

- daemon.ts に `turnCompleteGeneration` カウンターを追加
- `handleLines()` で text / tool_use メッセージ到着時にカウンターをインクリメント
- `handleTurnComplete()` でカウンターをキャプチャし、speakNotification 実行前に照合
- テスト4件追加: 同期パスの正常動作、翻訳待ち中のtext/tool_useによる抑制、新規アクティビティなしの正常通知
