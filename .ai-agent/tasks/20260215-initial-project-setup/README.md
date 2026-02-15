# プロジェクト初期セットアップ

## 目的・ゴール

cc-voice-reporter プロジェクトの TypeScript / npm 基盤をセットアップし、ビルド・リント・テストが動作する状態にする。

## 実装方針

1. `package.json` を作成（プロジェクト情報、scripts、依存関係）
2. `tsconfig.json` を作成（TypeScript 設定）
3. ESLint を設定（リンター）
4. Vitest を設定（テストフレームワーク）
5. `src/index.ts` にエントリポイントのスケルトンを作成
6. 最初のテストを作成して動作確認
7. `.gitignore` に `node_modules/` や `dist/` を追加

## 完了条件

- [ ] `npm install` が成功する
- [ ] `npm run build` で TypeScript コンパイルが成功する
- [ ] `npm run lint` でリンターが動作する
- [ ] `npm test` でテストが通る
- [ ] `src/index.ts` にエントリポイントのスケルトンが存在する
- [ ] `.gitignore` に必要な除外パターンが含まれている

## 作業ログ

（作業開始後に記録）
