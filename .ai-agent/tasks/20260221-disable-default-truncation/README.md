# デフォルトでテキスト中略を無効化 (Issue #37)

## 目的・ゴール

Speaker の `maxLength` デフォルト値を無制限に変更し、設定で明示的に指定した場合のみ中略を適用する。

## 実装方針

1. `src/speaker.ts`: `maxLength` のデフォルト値を `100` → `Infinity` に変更
2. `src/speaker.test.ts`: デフォルト中略テストを「デフォルトでは中略しない」テストに書き換え
3. `src/config.ts`: コメントの「default: 100」を更新
4. ドキュメント更新（`tech.md`, `structure.md`）

## 完了条件

- [x] `maxLength` 未指定時にテキストが中略されないこと
- [x] `maxLength` を設定した場合は従来通り中略が動作すること
- [x] `npm run build` / `npm run lint` / `npm test` がすべてパスすること
- [x] ドキュメントが更新されていること

## 作業ログ

- `speaker.ts`: デフォルト `maxLength` を `100` → `Infinity` に変更
- `speaker.test.ts`: デフォルト100文字テスト2件を「デフォルトでは中略しない」テスト1件に置き換え
- `config.ts`: コメント更新
- `tech.md`, `structure.md`: Speaker の説明を更新
- build / lint / test すべてパス（300 tests passed）
