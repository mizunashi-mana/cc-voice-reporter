# フック方式コード削除 + switch-to-default スキル改修

## 目的

Phase 2 への移行に伴い、不要になったフック方式のコードを削除し、デーモン方式のエントリポイントに切り替える。また、switch-to-default スキルのマージ時の確認ステップを簡略化する。

## ゴール

- switch-to-default スキルでマージ方法を確認せず常にマージコミットでマージする
- `src/index.ts`（フック方式エントリポイント）を削除
- `src/index.test.ts`（フック方式テスト）を削除
- `package.json` の `bin` を `./dist/cli.js` に変更
- plan.md の完了済み項目にチェック
- structure.md を更新

## 実装方針

1. SKILL.md のマージ確認ステップを変更
2. src/index.ts, src/index.test.ts を削除
3. package.json の bin エントリを更新
4. plan.md にチェック追加
5. structure.md を更新

## 完了条件

- [ ] switch-to-default SKILL.md が更新されている
- [ ] `src/index.ts` が削除されている
- [ ] `src/index.test.ts` が削除されている
- [ ] `package.json` の bin が `./dist/cli.js` を指している
- [ ] `npm run build` が通る
- [ ] `npm run lint` が通る
- [ ] `npm test` が通る
- [ ] plan.md が更新されている
- [ ] structure.md が更新されている

## 作業ログ

- switch-to-default SKILL.md: マージ方法確認を削除、常にマージコミットでマージするよう変更
- `src/index.ts`, `src/index.test.ts` を削除
- `package.json` の bin を `./dist/cli.js` に変更
- plan.md: Phase 2 完了済み項目にチェック追加
- structure.md: index.ts 関連を削除、src/ 説明をデーモン方式のみに更新
- `npm run build` 成功
- `npm run lint` 成功
- `npm test` 85/85 通過
