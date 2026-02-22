# 音声言語をシステムロケールから自動検出する

Issue: https://github.com/mizunashi-mana/cc-voice-reporter/issues/76

## 目的・ゴール

`config.json` で `language` が未設定の場合、OS のシステムロケールから音声言語を自動検出し、デフォルト言語として使用する。日本語環境のユーザーが初回セットアップ時に設定なしで日本語音声が出るようにする。

## 実装方針

### 新規モジュール `src/cli/locale.ts`

システムロケールを検出する関数 `detectSystemLanguage()` と、config 値と組み合わせて言語を決定する `resolveLanguage()` を作成:

- **macOS** (`process.platform === 'darwin'`): `defaults read -g AppleLanguages` コマンドを実行し、先頭の言語コード（例: `ja-JP` → `ja`）を抽出
- **その他のプラットフォーム**: まず `locale` コマンドで LANG 値を取得、失敗時は `LC_ALL` / `LANG` 環境変数からロケールを取得（例: `ja_JP.UTF-8` → `ja`）
- **フォールバック**: 検出できない場合は `'en'` をデフォルトとする

### `config.ts` の変更

`resolveOptions` のパラメータを `ResolvedDeps` オブジェクトに統合（`ollamaModel`, `speakerCommand`, `language`）。言語は外部で解決済みの値をそのまま使用。

### `commands/monitor.ts` の変更

`resolveLanguage(config.language)` を呼び出し、検出した言語をデバッグログに出力。結果を `ResolvedDeps` 経由で `resolveOptions` に渡す。

## 完了条件

- [x] `detectSystemLanguage()` が macOS でシステム言語を正しく検出する
- [x] `detectSystemLanguage()` が locale コマンド / LANG/LC_ALL 環境変数から言語を検出する
- [x] 検出失敗時に `'en'` にフォールバックする
- [x] `config.language` が設定されている場合はそちらが優先される
- [x] 検出した言語をデバッグログに出力する
- [x] `npm run build` が通る
- [x] `npm run lint` が通る
- [x] `npm test` が通る

## 作業ログ

- `src/cli/locale.ts` を新規作成: `extractLanguageCode()`, `detectSystemLanguage()`, `resolveLanguage()` を実装
- `src/cli/config.ts` をリファクタリング: `resolveOptions` のパラメータを `ResolvedDeps` オブジェクトに統合（max-params lint 対応）
- `src/cli/commands/monitor.ts` を更新: `resolveLanguage()` 呼び出しとデバッグログ出力を追加
- `src/cli/locale.test.ts` を新規作成: `extractLanguageCode` と `resolveLanguage` のテスト 14 件
- `src/cli/config.test.ts` を更新: `resolveOptions` テストを新シグネチャに対応、言語パラメータのテスト追加
- 全テスト 318 件パス、ビルド・リント成功
