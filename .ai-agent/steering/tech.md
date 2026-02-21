# 技術アーキテクチャ

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| 言語 | TypeScript |
| ランタイム | Node.js |
| ファイル監視 | chokidar v5 |
| バリデーション | zod |
| 音声合成 | 設定可能（デフォルト: macOS say コマンド） |
| テスト | Vitest |
| リンター | ESLint (typescript-eslint) |
| pre-commit | prek |
| CI | GitHub Actions |
| 開発環境 | devenv (Nix) |
| パッケージマネージャ | npm |
| ライセンス | Apache-2.0 OR MPL-2.0 |

## アーキテクチャ概要

Claude Code の transcript .jsonl ファイルをリアルタイム監視し、Claude の応答やツール実行を音声で報告する常駐デーモン。

```
Claude Code ──書き込み──→ ~/.claude/projects/{path}/{session}.jsonl
                                    │
                          cc-voice-reporter（常駐デーモン）
                                    │
                    ┌───────┬───────┼───────┐
                    │       │       │       │
                chokidar  JSONL  Summarizer Speaker
               ファイル監視 パーサー (Ollama)  音声出力キュー
                                            (設定可能なコマンド)
```

### モジュール構成

ソースコードは `packages/cc-voice-reporter/src/` 配下に配置（npm workspaces による monorepo 構成）。

- **TranscriptWatcher**（`src/watcher.ts`）: chokidar v5 でディレクトリ監視 + tail ロジック。ファイルポジション追跡による差分読み取り、サブエージェント .jsonl の監視対応、不完全行の安全な処理、ファイルトランケーション検出
- **JSONL パーサー**（`src/parser.ts`）: transcript .jsonl の各行を zod スキーマでバリデーションし、assistant テキスト応答・tool_use 情報を抽出。thinking・progress・tool_result 等は除外
- **Speaker**（`src/speaker.ts`）: 設定可能な音声出力コマンド（デフォルト: `say`）の FIFO キュー管理。排他制御（1つずつ順番に実行）、長文メッセージの中間省略（設定で `maxLength` を指定した場合のみ適用、デフォルトは中略なし）、プロジェクト・セッション対応キュー（同一プロジェクト+同一セッション > 同一プロジェクト > FIFO の3段階優先取り出し、プロジェクト切り替えアナウンス）、graceful shutdown
- **Summarizer**（`src/summarizer.ts`）: Ollama の `/api/chat` を使った定期要約通知。Daemon からイベント（tool_use, text）を蓄積し、設定された間隔で自然な日本語の要約文を生成して音声で通知。イベントが無い期間はスキップ
- **Daemon**（`src/daemon.ts`）: TranscriptWatcher + parser + Speaker + Summarizer を統合。AskUserQuestion の即時読み上げ、ターン完了通知（「入力待ちです」）、ファイルパスからプロジェクト情報を抽出して Speaker に伝達
- **Config**（`src/config.ts`）: 設定ファイル（XDG 準拠）の読み込み・バリデーション（zod）・CLI 引数とのマージ。logLevel、filter、speaker（command 含む）、summary、ollama 等を管理
- **Logger**（`src/logger.ts`）: 軽量ロガーモジュール（外部依存なし）。ログレベル（debug/info/warn/error）に応じた出力制御
- **CLI**（`src/cli.ts`）: デーモンの CLI エントリポイント。Daemon の起動と SIGINT/SIGTERM での graceful shutdown + 強制シャットダウン

### 音声出力

- 設定可能な音声出力コマンド（`speaker.command`、デフォルト: `["say"]`）
- Speaker クラスによるキュー管理で読み上げの排他制御
- 長文テキストの中間省略（設定で `speaker.maxLength` を指定した場合のみ適用）
- プロジェクト切り替え時の音声アナウンス

## 開発環境

### セットアップ

```bash
# devenv を使用（Nix が必要）
devenv shell

# または npm のみ
npm install
```

### 開発コマンド

```bash
npm run build    # TypeScript コンパイル
npm run lint     # リンター実行
npm test         # テスト実行
```

## テスト戦略

- ユニットテスト: JSONL パース、メッセージ抽出・フィルタリング
- 統合テスト: say コマンドとの連携（モック使用）
- ファイル監視テスト: chokidar + tail ロジック（テスト用 .jsonl ファイルで検証）

## リファレンス

- [Claude Code CLI リファレンス](https://code.claude.com/docs/en/cli-reference)
- [chokidar](https://github.com/paulmillr/chokidar) — ファイル監視ライブラリ
- [transcript .jsonl 監視方式調査](./../surveys/20260215-transcript-jsonl-watcher/README.md)
