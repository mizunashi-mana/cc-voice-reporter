# migrate-eslint-config-refined

## 目的・ゴール

ローカルの `packages/eslint-config/` パッケージを外部パッケージ `@mizunashi_mana/eslint-config-refined` に置き換える。ESLint 設定のメンテナンスコストを削減し、複数プロジェクト間で設定を共有できるようにする。

## 実装方針

参考PR: https://github.com/mizunashi-mana/mcp-html-artifacts-preview/pull/34

1. `packages/eslint-config/` ディレクトリを削除
2. ESLint を v9 → v10 にアップグレード（`@mizunashi_mana/eslint-config-refined` の peer dep 要件）
3. `@mizunashi_mana/eslint-config-refined` ^0.2.0 と `jiti` をインストール
4. ルート `eslint.config.js` → `eslint.config.ts` に変更し、インポート元を変更
5. パッケージ `eslint.config.js` → `eslint.config.ts` に変更
6. `tsconfig.base.json` をルートに作成し、各パッケージの tsconfig を簡素化（target を ES2024 に）
7. ルート `tsconfig.json` を作成（eslint.config.ts の型チェック用）
8. root `package.json` のビルドスクリプトから eslint-config ビルドステップを除去
9. `devenv.nix` から eslint-config 用の git-hooks 設定を更新
10. 新しい lint ルールへの対応（正規表現 `v` フラグ、名前付きキャプチャなど）

## 完了条件

- [x] `packages/eslint-config/` が削除されている
- [x] `@mizunashi_mana/eslint-config-refined` が devDependency として追加されている
- [x] ESLint v10 にアップグレードされている
- [x] `eslint.config.ts` が新パッケージの `buildConfig` を使用している
- [x] `npm run build` が通る
- [x] `npm run lint` が通る（lint エラーの修正を含む）
- [x] `npm test` が通る

## 作業ログ

- `packages/eslint-config/` を削除し、root `package.json` のビルドスクリプトから eslint-config ビルドステップを除去
- ESLint を v9 → v10 にアップグレード、`@mizunashi_mana/eslint-config-refined` ^0.2.0 をインストール
- `eslint.config.js` → `eslint.config.ts` に変更、インポート元を `@mizunashi_mana/eslint-config-refined` に
- `tsconfig.base.json` をルートに作成（target: ES2024）、各パッケージの tsconfig を `extends` で簡素化
- `devenv.nix` から eslint-config 用 hook を root 用 hook に変更
- 新しい lint ルールへの対応:
  - `require-unicode-regexp`: 正規表現に `v` フラグを追加
  - `prefer-named-capture-group`: キャプチャグループを名前付きに変更
  - `@typescript-eslint/strict-void-return`: コールバックをブロック構文に変更
  - `preserve-caught-error`: catch で cause を付与
  - `@mizunashi_mana/promise/prefer-await-to-then`: then/catch を await に変更
- TypeScript target を `ES2022` → `ES2024` に変更（`v` フラグのサポートに必要）
- `v` フラグモードでの正規表現文字クラス内の特殊文字をエスケープ（`/` → `\/`、`-` → `\-`）
