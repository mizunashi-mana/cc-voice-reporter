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
│       └── autodev-steering/
├── .github/                # GitHub 設定
│   ├── actions/            # composite actions
│   │   ├── setup-devenv/   # Nix + devenv セットアップ
│   │   └── setup-node/     # Node.js + npm セットアップ
│   ├── workflows/          # GitHub Actions ワークフロー
│   │   ├── ci-lint.yml     # ビルド + リント
│   │   └── ci-test.yml     # ビルド + テスト
│   └── dependabot.yml      # Dependabot 設定
├── src/                    # ソースコード
│   ├── index.ts            # エントリポイント（JSON パース → メッセージ生成 → say）
│   └── index.test.ts       # テスト
├── scripts/                # 開発用スクリプト
│   └── cc-edit-lint-hook.mjs  # Claude Code 編集時 lint hook
├── dist/                   # ビルド出力（.gitignore）
├── package.json            # npm パッケージ定義
├── package-lock.json       # npm 依存ロック
├── tsconfig.json           # TypeScript 設定（リント用、テスト含む）
├── tsconfig.build.json     # TypeScript ビルド設定（テスト除外）
├── eslint.config.js        # ESLint flat config
├── LICENSE                 # ライセンス概要
├── LICENSE.Apache-2.0.txt  # Apache License 2.0 全文
├── LICENSE.MPL-2.0.txt     # Mozilla Public License 2.0 全文
├── CLAUDE.md               # Claude Code 向け指示
├── .gitignore              # Git 除外設定
├── .envrc                  # direnv 設定（devenv shell の自動ロード）
├── devenv.nix              # devenv 開発環境定義
├── devenv.yaml             # devenv 入力ソース設定
└── devenv.lock             # devenv 依存ロックファイル
```

## 各ディレクトリの詳細

### src/

メインのソースコード。Claude Code フックの JSON を標準入力で受け取り、イベント種別に応じたメッセージを生成し、macOS `say` コマンドで音声出力する。

### .ai-agent/

AI エージェントによる開発を支援するドキュメント群。steering/ 配下にプロダクト・技術戦略を、tasks/ と projects/ で作業管理を行う。

### .claude/

Claude Code の設定。`settings.json` でパーミッションとフック設定を管理。`skills/` に `/autodev:*` コマンドで呼び出せる開発ワークフロースキルを格納。

### .github/

GitHub Actions の CI ワークフローと composite actions。`setup-devenv` で Nix/devenv 環境を、`setup-node` で Node.js + npm 環境をセットアップする。

### scripts/

開発補助スクリプト。Claude Code のファイル編集時に自動実行される lint hook など。

### devenv 関連ファイル

devenv (Nix ベース) による開発環境定義。`devenv.nix` で JavaScript/Node.js + npm を有効化し、ESLint / actionlint の git-hooks を設定している。
