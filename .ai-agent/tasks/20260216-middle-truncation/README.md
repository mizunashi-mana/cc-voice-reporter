# 長文テキストの省略方式を中間省略に変更

## 目的

Speaker の長文切り詰め処理を末尾省略から中間省略に変更し、応答の導入と結論の両方を音声で確認できるようにする。（Issue #16）

## ゴール

- `truncate()` が中間省略（先頭 + 「、中略、」 + 末尾）を行う
- デフォルト suffix が「、中略、」
- 既存テストが更新されている
- `npm run build` / `npm run lint` / `npm test` が通る

## 実装方針

1. **speaker.ts の `truncate()` メソッドを変更**: `message.slice(0, half) + suffix + message.slice(-half)` の中間省略に変更
2. **デフォルト `truncationSuffix` を変更**: 「、以下省略」→「、中略、」
3. **speaker.test.ts のテストを更新**: 中間省略の期待値に変更

## 完了条件

- [x] `truncate()` が中間省略を行う
- [x] デフォルト suffix が「、中略、」
- [x] テストが全通過（106テスト全通過）
- [x] `npm run build` が通る
- [x] `npm run lint` が通る
- [x] `npm test` が通る

## 作業ログ

- speaker.ts: `truncate()` を中間省略に変更、デフォルト suffix を「、中略、」に変更
- speaker.test.ts: truncation テストを中間省略の期待値に更新
