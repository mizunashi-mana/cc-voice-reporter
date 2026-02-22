# cc-voice-reporter ディレクトリ構成

## ルートディレクトリ

```
cc-voice-reporter/
├── .ai-agent/              # AI エージェント向けドキュメント
│   ├── steering/           # 戦略的ガイドドキュメント
│   │   ├── product.md      # プロダクトビジョン・戦略
│   │   ├── tech.md         # 技術アーキテクチャ・スタック
│   │   ├── market.md       # 市場分析・競合調査
│   │   ├── plan.md         # 実装計画・ロードマップ
│   │   └── work.md         # 開発ワークフロー・規約
│   ├── structure.md        # このファイル（ディレクトリ構成）
│   ├── projects/           # 長期プロジェクト管理
│   ├── tasks/              # 個別タスク管理
│   └── surveys/            # 技術調査・検討
├── .claude/                # Claude Code 設定
│   ├── settings.json       # パーミッション・フック設定
│   └── skills/             # autodev スキル
│       ├── autodev-create-issue/
│       ├── autodev-create-pr/
│       ├── autodev-discussion/
│       ├── autodev-import-review-suggestions/
│       ├── autodev-review-pr/
│       ├── autodev-start-new-project/
│       ├── autodev-start-new-survey/
│       ├── autodev-start-new-task/
│       ├── autodev-start-new-team-task/
│       ├── autodev-steering/
│       └── autodev-switch-to-default/
├── .github/                # GitHub 設定
│   ├── actions/            # composite actions
│   │   ├── setup-devenv/   # Nix + devenv セットアップ
│   │   └── setup-node/     # Node.js + npm セットアップ
│   ├── workflows/          # GitHub Actions ワークフロー
│   │   ├── ci-lint.yml     # ビルド + リント
│   │   └── ci-test.yml     # ビルド + テスト
│   ├── dependabot.yml      # Dependabot 設定
│   └── PULL_REQUEST_TEMPLATE.md  # PR テンプレート
├── packages/               # npm workspaces パッケージ群
│   ├── cc-voice-reporter/  # メインパッケージ（@mizunashi_mana/cc-voice-reporter, publishable）
│   │   ├── src/            # ソースコード
│   │   │   ├── index.ts    # パッケージエクスポート
│   │   │   ├── monitor/    # コアライブラリ（監視・解析・音声出力）
│   │   │   │   ├── index.ts      # monitor エクスポート
│   │   │   │   ├── daemon.ts     # 常駐デーモン（watcher + parser + speaker + summarizer 統合）
│   │   │   │   ├── logger.ts     # Logger インターフェース定義
│   │   │   │   ├── messages.ts   # 多言語メッセージカタログ
│   │   │   │   ├── parser.ts     # JSONL パーサー + メッセージ抽出（zod バリデーション）
│   │   │   │   ├── speaker.ts    # 音声出力キュー管理（設定可能なコマンド）+ 長文切り詰め
│   │   │   │   ├── summarizer.ts # Ollama を使った定期要約通知モジュール
│   │   │   │   ├── watcher.ts    # transcript .jsonl ファイル監視モジュール（chokidar v5）
│   │   │   │   └── *.test.ts     # 各モジュールのテスト
│   │   │   └── cli/        # CLI（エントリポイント・設定・コマンド）
│   │   │       ├── cli.ts        # CLI エントリポイント（サブコマンド振り分け）
│   │   │       ├── config.ts     # 設定ファイル読み込み・マージ（XDG 対応、zod バリデーション）
│   │   │       ├── locale.ts     # システムロケール検出（macOS: AppleLanguages / その他: locale コマンド・環境変数）
│   │   │       ├── logger.ts     # Logger クラス実装（レベル制御）
│   │   │       ├── ollama.ts     # Ollama モデル解決（API 問い合わせ・自動検出・バリデーション）
│   │   │       ├── speaker-command.ts # TTS コマンド自動検出（say → espeak-ng → espeak フォールバック）
│   │   │       ├── index.ts      # 内部バレルファイル（#cli subpath imports）
│   │   │       ├── commands/     # サブコマンド実装
│   │   │       │   ├── monitor.ts   # monitor サブコマンド（デーモン起動）
│   │   │       │   ├── config.ts    # config サブコマンド（設定ファイル管理）
│   │   │       │   ├── tracking.ts  # tracking サブコマンド（追跡プロジェクト管理）
│   │   │       │   └── output.ts    # CLI 出力ヘルパー（println, errorln, CliError）
│   │   │       └── *.test.ts     # 各モジュールのテスト
│   │   ├── dist/           # ビルド出力（.gitignore）
│   │   ├── package.json    # パッケージ定義
│   │   ├── tsconfig.json   # TypeScript 設定（リント・typecheck 用、テスト含む）
│   │   ├── tsconfig.build.json  # TypeScript ビルド設定（テスト除外）
│   │   ├── vitest.config.ts     # Vitest 設定（cc-voice-reporter-dev 条件）
│   │   └── eslint.config.js     # ESLint flat config
│   └── eslint-config/      # 共有 ESLint 設定（@cc-voice-reporter/eslint-config）
│       ├── src/            # ESLint 設定ソース
│       ├── tests/          # ESLint 設定のテスト
│       ├── dist/           # ビルド出力
│       ├── package.json    # パッケージ定義
│       ├── tsconfig.json   # TypeScript 設定
│       └── tsup.config.ts  # tsup ビルド設定
├── scripts/                # 開発用スクリプト
│   ├── cc-edit-lint-hook.mjs  # Claude Code 編集時 lint hook
│   └── run-script.mjs      # スクリプト実行ユーティリティ
├── package.json            # ルート npm workspaces 定義
├── package-lock.json       # npm 依存ロック
├── eslint.config.js        # ルートレベル ESLint 設定
├── LICENSE                 # ライセンス概要（英語）
├── LICENSE.Apache-2.0.txt  # Apache License 2.0 全文（英語）
├── LICENSE.MPL-2.0.txt     # Mozilla Public License 2.0 全文（英語）
├── README.md               # プロジェクト概要・セットアップ手順（英語）
├── CLAUDE.md               # Claude Code 向け指示
├── .gitignore              # Git 除外設定
├── .envrc                  # direnv 設定（devenv shell の自動ロード）
├── devenv.nix              # devenv 開発環境定義
├── devenv.yaml             # devenv 入力ソース設定
└── devenv.lock             # devenv 依存ロックファイル
```

## 各ディレクトリの詳細

### packages/cc-voice-reporter/src/monitor/（コアライブラリ）

transcript .jsonl 監視・解析・音声出力のコアロジック。CLI から `#lib` subpath imports で利用される:

- `daemon.ts` — 常駐デーモン。TranscriptWatcher + parser + Speaker + Summarizer を統合。AskUserQuestion の読み上げ（同一バッチ内の他メッセージより後に処理）、ターン完了通知（「入力待ちです」）、ファイルパスからプロジェクト情報を抽出して Speaker に伝達。
- `logger.ts` — Logger インターフェース定義。実装は `src/cli/logger.ts` が提供。
- `messages.ts` — 多言語メッセージカタログ。音声通知の文言を言語コードに応じて切り替え。
- `watcher.ts` — `~/.claude/projects/` 配下の .jsonl ファイルを chokidar v5 で監視し、新規追記行をコールバックで通知する。tail ロジック、サブエージェント対応、トランケーション検出、プロジェクト名抽出ユーティリティを実装済み。
- `parser.ts` — transcript .jsonl の各行を zod スキーマでバリデーションし、assistant テキスト応答・tool_use 情報を抽出する。thinking・progress・tool_result 等は除外。
- `speaker.ts` — 設定可能な音声出力コマンド（デフォルト: `say`、`speaker.command` でカスタマイズ可能）の FIFO キュー管理。排他制御（1つずつ順番に実行）、プロジェクト・セッション対応キュー（同一プロジェクト+同一セッション > 同一プロジェクト > FIFO の3段階優先取り出し、プロジェクト切り替えアナウンス）、graceful shutdown（dispose）を提供。
- `summarizer.ts` — Ollama の `/api/chat` を使った定期要約通知。Daemon からイベント（tool_use, text）を蓄積し、設定された間隔で自然言語の要約文を生成して音声で通知。イベントが無い期間はスキップ。

### packages/cc-voice-reporter/src/cli/（CLI）

CLI エントリポイント・設定・ロガー・Ollama モデル解決を担当。`#cli` subpath imports で commands からインポート:

- `cli.ts` — CLI エントリポイント。サブコマンド（monitor, config, tracking）の振り分け。
- `config.ts` — 設定ファイル（XDG 準拠）の読み込み・バリデーション（zod）・CLI 引数とのマージ。logLevel、filter、speaker、ollama、summary 等を管理。
- `locale.ts` — システムロケール検出。macOS では `defaults read -g AppleLanguages`、その他では `locale` コマンドや `LANG`/`LC_ALL` 環境変数から言語コードを取得。`language` 未設定時のデフォルト言語決定に使用。
- `logger.ts` — Logger クラス実装。ログレベル（debug/info/warn/error）に応じた出力制御。
- `ollama.ts` — Ollama モデル解決。起動時に Ollama API（`GET /api/tags`）に問い合わせ、モデル指定時はバリデーション、未指定時は自動検出。Ollama は動作に必須。
- `speaker-command.ts` — TTS コマンド自動検出。`speaker.command` 未設定時に `say` → `espeak-ng` → `espeak` の順でプローブし、利用可能なコマンドを選択。いずれも見つからない場合はエラー。
- `index.ts` — 内部バレルファイル。`#cli` subpath imports で commands からのインポートを一元管理。
- `commands/monitor.ts` — monitor サブコマンド。Daemon の起動と graceful shutdown。
- `commands/config.ts` — config サブコマンド。設定ファイルのテンプレート生成（init）・パス表示（path）。
- `commands/tracking.ts` — tracking サブコマンド。監視対象プロジェクトの追加・削除・一覧表示。
- `commands/output.ts` — CLI 出力ヘルパー。`println`/`errorln` 関数と `CliError` クラスを提供。

### packages/eslint-config/

共有 ESLint 設定パッケージ。typescript-eslint、import-x、unused-imports、promise、n、stylistic 等のプラグインを統合した厳密なルール構成。

### .ai-agent/

AI エージェントによる開発を支援するドキュメント群。steering/ 配下にプロダクト・技術戦略を、tasks/ と projects/ で作業管理を行う。

### .claude/

Claude Code の設定。`settings.json` でパーミッション設定を管理。`skills/` に `/autodev-*` コマンドで呼び出せる開発ワークフロースキルを格納。

### .github/

GitHub Actions の CI ワークフローと composite actions。`setup-devenv` で Nix/devenv 環境を、`setup-node` で Node.js + npm 環境をセットアップする。

### scripts/

開発補助スクリプト。Claude Code のファイル編集時に自動実行される lint hook など。

### devenv 関連ファイル

devenv (Nix ベース) による開発環境定義。`devenv.nix` で JavaScript/Node.js + npm を有効化し、ESLint / actionlint の git-hooks を設定している。
