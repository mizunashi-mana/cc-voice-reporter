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

2つの方式が共存しており、transcript .jsonl 監視方式への移行を進めている。

### 方式 1: フックベース（Phase 1・稼働中）

Claude Code のフック機構を利用し、ツール実行・通知・完了イベントを音声報告する。

```
Claude Code ──フックイベント──→ cc-voice-reporter（stdin JSON）──→ say コマンド
```

- 標準入力からフックイベント JSON を受け取り、イベント種別に応じたメッセージを生成
- macOS `say` コマンドで音声出力
- 全 12 イベント対応（PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest, Notification, SubagentStart, SubagentStop, Stop, TaskCompleted, SessionStart, SessionEnd, UserPromptSubmit）

### 方式 2: transcript .jsonl 監視（Phase 2・開発中）

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

**実装済み:**
- `TranscriptWatcher` クラス（`src/watcher.ts`）: chokidar v5 でディレクトリ監視 + tail ロジック
- ファイルポジション追跡による差分読み取り
- サブエージェント .jsonl の監視対応
- 不完全行の安全な処理、ファイルトランケーション検出

**未実装:**
- JSONL パーサー（行分割 + JSON.parse によるメッセージ抽出）
- メッセージ抽出・フィルタリング（assistant テキスト応答、tool_use 情報の抽出）
- say コマンドのキュー管理（排他制御）
- 常駐デーモンとしての起動・停止

### 音声出力

- macOS `say` コマンドによる音声合成
- Phase 1: イベントごとに `execFile` で直接実行
- Phase 2: キュー管理で読み上げの排他制御（予定）、長文の切り詰め処理（予定）

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
