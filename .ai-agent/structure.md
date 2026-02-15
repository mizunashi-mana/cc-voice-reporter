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
├── .devenv/                # devenv 内部ファイル（自動生成）
├── .devenv.flake.nix       # devenv 生成の Flake 定義（自動生成）
├── .envrc                  # direnv 設定（devenv shell の自動ロード）
├── .gitignore              # Git 除外設定
├── devenv.nix              # devenv 開発環境定義（JavaScript/npm 有効）
├── devenv.yaml             # devenv 入力ソース設定
└── devenv.lock             # devenv 依存ロックファイル
```

## 各ディレクトリの詳細

### .ai-agent/

AI エージェントによる開発を支援するドキュメント群。steering/ 配下にプロダクト・技術戦略を、tasks/ と projects/ で作業管理を行う。

### .claude/skills/

Claude Code のスキル定義。`/autodev:*` コマンドで呼び出せる開発ワークフロースキルを格納。

### devenv 関連ファイル

devenv (Nix ベース) による開発環境定義。`devenv.nix` で JavaScript/Node.js + npm を有効化している。

## 備考

- ソースコード（`src/` 等）はまだ作成されていない（新規開発開始段階）
- `package.json` や `tsconfig.json` もこれから作成予定
