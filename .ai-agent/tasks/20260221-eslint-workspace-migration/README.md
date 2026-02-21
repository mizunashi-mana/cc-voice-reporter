# ESLint ルール強化と npm workspace 化

## 目的・ゴール

Issue #53: ESLint ルールを強化し、npm workspace による multi-package 構成に移行する。

picstash の `@picstash/eslint-config` を参考に、以下のプラグインを導入:
- `eslint-plugin-import-x` + `eslint-import-resolver-typescript` — import の順序・整理
- `eslint-plugin-unused-imports` — 未使用 import の検出・自動削除
- `eslint-plugin-promise` — Promise の適切な使用
- `eslint-plugin-n` — Node.js 固有のルール
- `@eslint-community/eslint-plugin-eslint-comments` — ESLint コメントの適切な使用
- `@stylistic/eslint-plugin` — コードスタイルの統一

## 実装方針

### 1. npm workspace 化

ルートに `workspaces: ["packages/*"]` を設定し、以下の構成にする:

```
packages/
├── eslint-config/        # 共有 ESLint 設定パッケージ
│   ├── src/
│   │   ├── index.ts      # エントリポイント（buildConfig エクスポート）
│   │   ├── globals.ts    # 言語・環境設定
│   │   ├── js.ts         # JavaScript ルール
│   │   ├── ts.ts         # TypeScript ルール
│   │   ├── imports.ts    # import 整理ルール
│   │   ├── node.ts       # Node.js ルール
│   │   ├── promise.ts    # Promise ルール
│   │   ├── comments.ts   # ESLint コメントルール
│   │   └── stylistic.ts  # コードスタイルルール
│   ├── package.json
│   └── tsconfig.json
└── cc-voice-reporter/    # メインアプリケーション（既存ソースを移動）
    ├── src/
    ├── scripts/
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.build.json
    └── eslint.config.js
```

### 2. eslint-config パッケージ

picstash の builder パターンを参考に、`buildConfig({ ruleSets: [...] })` 形式でモジュラーな設定を提供。

### 3. 既存コードの移動

`src/`, `scripts/`, `tsconfig*.json` などを `packages/cc-voice-reporter/` に移動し、ルートの eslint.config.js を新パッケージ経由に置き換え。

### 4. CI 更新

GitHub Actions ワークフローのパスを workspace 構成に合わせて更新。

## 完了条件

- [x] npm workspace 構成が動作する
- [x] eslint-config パッケージがビルド・エクスポートできる
- [x] 全プラグインが導入され、ルールが適用される
- [x] 既存のソースコードが lint を通過する
- [x] `npm run build` / `npm run lint` / `npm test` が通る
- [ ] CI が通る

## 作業ログ

- npm workspace 化: ルート package.json に workspaces を設定、既存ソースを packages/cc-voice-reporter/ に移動
- eslint-config パッケージ作成: picstash のパターンに従い、buildConfig() ビルダー関数と8つのモジュラー設定ファイルを作成
- tsup でビルド、postinstall で自動ビルド
- 導入プラグイン: import-x, unused-imports, promise, n, eslint-comments, @stylistic
- スタイル設定: double quotes, 1tbs brace style, arrow parens always
- 既存コードの lint 修正: type imports、import 順序、optional chain の型修正、promise/always-return
