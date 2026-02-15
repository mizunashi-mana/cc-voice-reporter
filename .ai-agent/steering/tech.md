# 技術アーキテクチャ

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| 言語 | TypeScript |
| ランタイム | Node.js |
| ファイル監視 | chokidar v5 |
| 音声合成 | macOS say コマンド |
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
                            ┌───────┼───────┐
                            │       │       │
                        chokidar  JSONL   say コマンド
                       ファイル監視 パーサー  音声出力キュー
```

### transcript .jsonl 監視

- `~/.claude/projects/` 配下の .jsonl ファイルを chokidar v5 で監視
- アクティブセッションの自動検出（更新時刻ベース）
- ファイルポジション追跡による差分読み取り（tail ロジック）

### メッセージ抽出・フィルタリング

1. 新しい行を JSON.parse でパース
2. `type === "assistant"` かつ `content.type === "text"` のブロックを抽出
3. ツール実行情報（`content.type === "tool_use"`）からツール名・概要を抽出
4. 不要な情報（thinking, tool_result, progress）を除外

### 音声出力

- macOS `say` コマンドによる音声合成
- キュー管理で読み上げの排他制御
- 長文の切り詰め処理

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
