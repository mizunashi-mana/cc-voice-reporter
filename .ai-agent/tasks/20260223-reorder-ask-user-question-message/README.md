# AskUserQuestion メッセージ順序改善

## 目的・ゴール

`AskUserQuestion` の音声通知で「確認待ち」プレフィックスが質問内容より先に読み上げられ、文脈が掴みづらい問題を修正する（Issue #94）。

## 実装方針

`messages.ts` のメッセージテンプレートを変更し、質問内容を先に読み上げた後に「確認待ちです」を案内する形式にする。

- 日本語: `確認待ち: ${question}` → `${question}。確認待ちです`
- 英語: `Confirmation: ${question}` → `${question}. Awaiting confirmation`

## 完了条件

- [x] `messages.ts` のテンプレート変更
- [x] `messages.test.ts` のテスト期待値更新
- [x] `npm run build` 成功
- [x] `npm run lint` 成功
- [x] `npm test` 成功

## 作業ログ

- `messages.ts`: 日本語・英語両方のテンプレートを質問先読み形式に変更
- `messages.test.ts`: テスト期待値を新形式に更新
- `daemon.test.ts`: 6箇所の期待値を新形式に更新
- ビルド・リント・テスト全て成功
