# CLI パッケージ追加・サブコマンド体系への再編

Issue: https://github.com/mizunashi-mana/cc-voice-reporter/issues/67

## 目的・ゴール

新しい CLI パッケージ `packages/cli` を追加し、`config` / `monitor` / `tracking` の3つのサブコマンドを導入する。

## 実装方針

1. **新パッケージ `packages/cli`（`@mizunashi_mana/cc-voice-reporter`）を作成**
   - サブコマンドパーサーを `node:util` の `parseArgs` で実装
   - 各サブコマンドを個別モジュールとして実装
   - bin エントリポイント: `cc-voice-reporter`

2. **`monitor` サブコマンド**
   - 現在の `packages/cc-voice-reporter/src/cli.ts` の機能を移行
   - `@cc-voice-reporter/monitor` パッケージの公開 API を利用

3. **`config` サブコマンド**
   - 設定ファイルのテンプレート生成（`config init`）
   - 設定ファイルのパス表示（`config path`）

4. **`tracking` サブコマンド**
   - 監視対象プロジェクトの追加（`tracking add <path>`）
   - 監視対象プロジェクトの削除（`tracking remove <path>`）
   - 監視対象プロジェクトの一覧（`tracking list`）

5. **既存パッケージの変更**
   - `@cc-voice-reporter/monitor` から bin を削除（CLI は新パッケージに移行）
   - 必要な型・関数を export する

## 完了条件

- [x] `packages/cli` パッケージが作成されている
- [x] `cc-voice-reporter config init` で設定ファイルテンプレートが生成される
- [x] `cc-voice-reporter config path` で設定ファイルパスが表示される
- [x] `cc-voice-reporter monitor` で既存のデーモン起動機能が動作する
- [x] `cc-voice-reporter tracking add/remove/list` で監視対象が管理できる
- [x] `npm run build` が通る
- [x] `npm run lint` が通る（CLI パッケージは直接 ESLint で確認。prek hook は devenv 再起動後に反映）
- [x] `npm test` が通る（全 277 テスト合格）

## 作業ログ

### 2026-02-21

- `packages/cli` パッケージ（`@mizunashi_mana/cc-voice-reporter`）を作成
- `@cc-voice-reporter/monitor` に `index.ts` を追加し公開 API をエクスポート、`bin` を削除
- サブコマンド実装: `monitor`（既存 daemon 起動）、`config`（init/path）、`tracking`（add/remove/list）
- CLI 出力ユーティリティ（`output.ts`）で ESLint の `no-console` / `n/no-process-exit` に対応
- テスト 15 件追加（config: 5、tracking: 10）
- `devenv.nix` に CLI パッケージ用 ESLint hook を追加
- ルート `package.json` のビルドパイプラインを更新
