# create-team-task-skill

## 目的・ゴール

`/autodev:start-new-team-task` スキルを作成する。Claude Code Team 機能を活用し、複数エージェントが役割分担・相談しながらタスクを進めるワークフローを定義する。

## 実装方針

- 既存の `autodev-start-new-task` の準備手順（タスクディレクトリ・ブランチ作成）を踏襲
- 実行部分を Team ベースのワークフローに置き換え
- **ロールカタログ**: 利用可能な役割と推奨モデルの一覧を定義
- **コラボレーションパターン**: タスク特性に応じた構成テンプレートを提供
- **柔軟な判断**: lead がタスクを分析して最適な構成を選択
- **コスト最適化**: opus が不要な役割は sonnet/haiku を使用

### チーム構成の考え方

固定構成ではなく、ロールカタログからタスクに応じて選択する方式:
- researcher (Explore, haiku): コードベース・Web 調査
- architect (general-purpose, sonnet, plan mode): 設計・方針策定
- implementer (general-purpose, sonnet/opus): コード実装
- reviewer (general-purpose, sonnet): コードレビュー
- tester (general-purpose, sonnet): テスト作成・実行

### コラボレーションパターン例

- **Quick Fix**: lead + implementer（小さな修正）
- **Standard**: lead + researcher + implementer + reviewer（一般的なタスク）
- **Design-Heavy**: lead + researcher + architect + implementer + reviewer（設計が重要なタスク）

## 完了条件

- [ ] `.claude/skills/autodev-start-new-team-task/SKILL.md` が作成されている
- [ ] ロールカタログが定義されている
- [ ] コラボレーションパターンが定義されている
- [ ] モデル選択のガイダンスが含まれている
- [ ] settings.json にチーム機能の有効化設定が含まれている
- [ ] `.ai-agent/structure.md` が更新されている

## 作業ログ

- 2026-02-21: タスク開始。Claude Code Team の調査完了、設計方針決定
