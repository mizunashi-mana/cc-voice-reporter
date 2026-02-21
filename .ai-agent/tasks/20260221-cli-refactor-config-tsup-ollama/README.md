# CLI リファクタリング: config 移動・tsup 導入・ollama モデル解決

## 目的・ゴール

- `packages/cc-voice-reporter`（monitor パッケージ）から旧 CLI エントリポイントを削除
- `config.ts` と `logger.ts` を `packages/cli/` に移動し、設定・ロガーの責務を CLI パッケージに集約
- monitor パッケージには Logger インターフェースのみ残す
- `packages/cli/` に tsup を導入してビルドを高速化
- ollama オプションのデフォルト解決を CLI パッケージで行う
  - モデル未指定時: ollama API からモデル一覧を取得し最初のモデルを選択
  - モデル指定時: そのモデルが利用可能かチェック

## 実装方針

### 1. 旧 CLI 削除
- `packages/cc-voice-reporter/src/cli.ts` を削除
- `packages/cc-voice-reporter/eslint.config.js` の `entrypointFiles` を更新

### 2. Logger の分離
- `packages/cc-voice-reporter/src/logger.ts` を Logger インターフェースのみに変更
- Logger クラス・`resolveLogLevel`・`parseLogLevel` を `packages/cli/src/logger.ts` に移動
- テストも CLI パッケージに移動
- monitor パッケージのテストはモックロガーオブジェクトを使用するよう更新

### 3. config.ts の移動
- `packages/cc-voice-reporter/src/config.ts` → `packages/cli/src/config.ts`
- `packages/cc-voice-reporter/src/config.test.ts` → `packages/cli/src/config.test.ts`
- `packages/cc-voice-reporter/src/index.ts` から config 関連のエクスポートを削除
- monitor パッケージの `index.ts` に `SummarizerOptions`, `ProjectFilter` の型エクスポートを追加
- config.ts の内部インポートを `@cc-voice-reporter/monitor` からのインポートに変更
- CLI パッケージの各コマンドは `#lib` (Node.js subpath imports) 経由でインポート
- `zod` を `packages/cli/` の依存に追加

### 4. tsup 導入
- `packages/cli/` に `tsup` を devDependencies に追加
- `tsup.config.ts` を作成（entry: `src/cli.ts`, format: esm, shebang バナー付き）
- `noExternal: ['@cc-voice-reporter/monitor']` で monitor パッケージをバンドルに含める
- `package.json` の build スクリプトを tsup に変更
- tsc は typecheck 用に残す

### 5. ollama モデル解決
- `ConfigSchema` の `ollama.model` を optional に変更
- `packages/cli/src/ollama.ts` を新規作成
  - `GET /api/tags` でモデル一覧取得
  - `resolveOllamaModel(config)`: モデル未指定時は一覧の最初を選択、指定時は存在チェック
- `resolveOptions` に `ollamaModel` パラメータを追加

## 完了条件

- [x] `packages/cc-voice-reporter/src/cli.ts` が削除されている
- [x] `config.ts` と `config.test.ts` が `packages/cli/src/` に移動されている
- [x] `logger.ts` が CLI に移動、monitor には interface のみ
- [x] `packages/cli/` が tsup でビルドされる（monitor バンドル含む）
- [x] Node.js subpath imports (`#lib`) で commands からのインポートを整理
- [x] ollama モデル未指定時に API から自動選択される
- [x] ollama モデル指定時に利用可能性がチェックされる
- [x] `npm run build` が成功する
- [x] `npm run lint` が成功する
- [x] `npm test` が成功する（296 テスト全パス）

## 作業ログ

- 2026-02-21: 実装完了。全ビルド・リント・テスト成功。
