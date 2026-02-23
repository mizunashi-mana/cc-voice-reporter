# interactive-config-init

## 目的・ゴール

`config init` コマンドを対話式ウィザードにし、ユーザーの環境・用途に合った設定ファイルを生成できるようにする（Issue #82）。

## 実装方針

### 対話式ウィザードのフロー

1. **言語設定** — システムロケールを検出してデフォルト提案。`ja` / `en` を選択
2. **音声出力** — OS に応じた TTS コマンドを自動検出して提案（macOS: `say`, Linux: `espeak-ng` / `espeak`）
3. **Ollama セットアップ案内** — Ollama API に接続確認、未導入時はインストール手順を案内、モデル選択
4. 最終的に生成される設定 JSON を表示し、確認後にファイルを書き出す

### 技術的アプローチ

- Node.js 組み込みの `readline/promises` を使用（外部依存なし）
- `src/cli/wizard.ts` にウィザードロジックを新規作成
- `commands/config.ts` を修正して `--non-interactive` フラグで従来動作を維持
- 既存の `detectSystemLanguage()`, `detectSpeakerCommand()`, `resolveOllamaModel()` を活用

### フラグ

- デフォルト: 対話式ウィザード
- `--non-interactive`: 従来のテンプレート生成動作

## 完了条件

- [x] `config init` で対話式ウィザードが起動する
- [x] 各設定項目について質問し、デフォルト値を提案する
- [x] Ollama 未導入時にインストール手順を案内する
- [x] `--non-interactive` で従来のテンプレート生成が動作する
- [x] 最終設定を表示し、確認後にファイル書き出し
- [x] テストが追加されている
- [x] `npm run build`, `npm run lint`, `npm test` が通る

## 作業ログ

- wizard.ts 新規作成（readline/promises ベースの対話式ウィザード）
- commands/config.ts に --non-interactive フラグ追加、デフォルトでウィザード起動
- ollama.ts の listModels / DEFAULT_BASE_URL を export 化してウィザードから再利用
- ConfigInitDeps による DI パターンでテスタビリティ確保
- wizard.test.ts に 10 テスト、config.test.ts に 8 テスト（IO クローズ確認含む）
