# improve-readme-clarity

## 目的・ゴール

Issue #80: README をもっと分かりやすくする。初見のユーザーが「このツールが何をするのか」「どういう体験が得られるのか」をすぐに理解できるようにする。

## 実装方針

### 構成変更

1. **Quick Start セクションを追加** — 最短で動かす手順
2. **ユースケースの追加** — 「こういうときに便利」を箇条書きで示す
3. **導入テキストの改善** — 動作の流れをテキストで簡潔に説明
4. **不要セクションの削除** — Features（Quick Start + Requirements でカバー）、Installation（Quick Start に統合）、Configuration の Minimal example
5. **古い記述の修正** — 自動検出機能の反映、存在しない設定パラメータの削除
6. **Steering ドキュメントの更新** — 新機能の反映

### 変更しないもの

- Configuration の Options reference テーブル構成（フラットテーブルを維持）
- フロー図（テキスト説明で十分）
- asciinema デモ（今回のスコープ外）

## 完了条件

- [x] Quick Start セクションが追加されている
- [x] ユースケースが箇条書きで記載されている
- [x] 導入部分が改善されている
- [x] 古い記述が修正されている（自動検出機能、存在しない設定パラメータ）
- [x] Steering ドキュメントが更新されている
- [x] `npm run build` が通る
- [x] `npm run lint` が通る
- [x] `npm test` が通る

## 作業ログ

- README に以下の変更を実施:
  - 導入テキストを改善（ツールの動作を具体的に説明する段落を追加）
  - 「When is this useful?」セクションを追加（3つのユースケース）
  - Quick Start セクションを追加（4ステップの最短手順、Ollama インストールリンク付き）
  - Features セクションを削除（Quick Start + Requirements でカバー）
  - Installation セクションを削除（Quick Start に統合）
  - Usage にヘルプ表示オプションを追加
  - Configuration の Minimal example を削除
- 古い記述を修正:
  - language / speaker.command / ollama.model のデフォルト値を自動検出に更新
  - Requirements の TTS 説明を全プラットフォーム自動検出に更新
  - 存在しない設定パラメータ（speaker.maxLength, speaker.truncationSeparator）を削除
- Steering ドキュメントを更新:
  - plan.md: Issue #76, #72 を完了、Issue #83, #82 を追加
  - structure.md / tech.md: locale.ts, speaker-command.ts を追加
  - product.md: ロケール自動検出・TTS 自動フォールバック機能を追加
- PR レビュー実施（COMMENT: Critical 0, Warning 1, Info 1）
