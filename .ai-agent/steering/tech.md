# 技術アーキテクチャ

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| 言語 | TypeScript |
| ランタイム | Node.js |
| 音声合成 | macOS say コマンド |
| テスト | Vitest |
| リンター | ESLint (typescript-eslint) |
| pre-commit | prek |
| CI | GitHub Actions |
| 開発環境 | devenv (Nix) |
| パッケージマネージャ | npm |
| ライセンス | Apache-2.0 OR MPL-2.0 |

## アーキテクチャ概要

Claude Code のフック機構を利用し、各イベント発生時にスクリプトを実行して音声レポートを行う。

```
Claude Code
  │
  ├─ Hook: PreToolUse ──→ voice-reporter ──→ say "ツール X を実行します"
  ├─ Hook: PostToolUse ──→ voice-reporter ──→ say "ツール X が完了しました"
  ├─ Hook: Notification ──→ voice-reporter ──→ say "通知: ..."
  ├─ Hook: Stop ──→ voice-reporter ──→ say "処理が完了しました"
  └─ ...
```

### フック設定

Claude Code の `~/.claude/settings.json` にフック設定を記述し、イベント発生時に本ツールのスクリプトを呼び出す。

### 音声レポート処理

1. フックイベントの JSON を標準入力で受け取る
2. イベント種別に応じたメッセージを生成
3. macOS `say` コマンドで音声出力

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

- ユニットテスト: メッセージ生成ロジック
- 統合テスト: say コマンドとの連携（モック使用）

## リファレンス

- [Claude Code Hooks ドキュメント](https://code.claude.com/docs/en/hooks)
