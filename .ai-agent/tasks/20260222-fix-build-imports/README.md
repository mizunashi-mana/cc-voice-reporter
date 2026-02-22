# fix-build-imports

## 目的・ゴール

`package.json` の `imports` フィールド (`#lib`, `#cli`) が `./src/` を指しているため、ビルド後の `dist/` からの CLI 実行時にモジュール解決が失敗する問題を修正する。

## 背景

- TypeScript ソースは `src/` に `.ts` ファイルとして存在
- `tsc` でコンパイルすると `dist/` に `.js` ファイルが出力される
- コンパイル後の `.js` ファイル内に `#cli` / `#lib` サブパスインポートが残る
- Node.js ランタイムは `package.json` の `imports` を参照し、`./src/index.js` を探すが存在しない
- vitest (Vite) は `.js` → `.ts` の自動解決ができるため、テスト時は問題なし

## 実装方針

1. `package.json` の `imports` に条件付きインポートを導入
   - `"cc-voice-reporter-dev"` 条件 → `./src/` (開発・テスト用)
   - `"default"` → `./dist/` (本番ランタイム用)
2. `tsconfig.json` に `customConditions: ["cc-voice-reporter-dev"]` を追加（TypeScript が src を解決）
3. vitest 用に `resolve.conditions` を設定

## 完了条件

- [x] `npm run build` がエラーなく通る
- [x] `npm test` が全テスト通る（315 tests passed）
- [x] `node packages/cc-voice-reporter/dist/cli/cli.js monitor` がモジュール解決エラーなく起動する（`detected language: ja` を確認）
- [x] `npm run lint` がエラーなく通る

## 作業ログ

- `package.json` の `imports` に条件付きインポートを導入（`cc-voice-reporter-dev` → `./src/`, `default` → `./dist/`）
- `tsconfig.json` に `customConditions: ["cc-voice-reporter-dev"]` を追加
- `vitest.config.ts` を新規作成し `resolve.conditions: ["cc-voice-reporter-dev"]` を設定
- `.ai-agent/structure.md` に `vitest.config.ts` を追記
