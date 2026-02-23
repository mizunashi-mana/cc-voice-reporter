# reimplement-permission-notification

## 目的・ゴール

PR #126 で削除したパーミッション確認通知を、新しい知見に基づいて再実装する。

### 背景

- `PermissionRequest` hook は `AskUserQuestion` と同じ内容で、transcript JSONL の tool_use で既に取得可能
- 実際のパーミッション確認（Bash, WebFetch 等の承認待ち）は `Notification` hook の `idle_prompt` として発火する
- `permission_prompt` は権限確認ダイアログが表示されたときに発火する
- `turn_complete` は transcript の `system/turn_duration` で既に検出済み

### 新しいアプローチ

`Notification` hook の `idle_prompt` と `permission_prompt` を両方監視し、通知優先度システムで重複を排除:

- AskQuestion (レベル4) > idle_prompt (レベル3) > permission_prompt (レベル2) > turn_complete (レベル1)
- 高い優先度の通知が発話済みなら、低い優先度は抑制
- 新しいアクティビティ（text, tool_use, user_response）で優先度レベルがリセットされる

## 実装方針

1. `messages.ts` に `permissionRequest` メッセージを再追加
2. HookWatcher を再追加（簡略化版）
3. Daemon に HookWatcher 統合と通知優先度システムを追加
4. `config init` に hook 登録を再追加（Notification hook for idle_prompt/permission_prompt）
5. ビルド・lint・テスト全体の検証

## 完了条件

- [x] HookWatcher が hooks ディレクトリの JSONL を監視できる
- [x] idle_prompt / permission_prompt 検出時に「パーミッション確認です」が発話される
- [x] 通知優先度システムにより重複発話が抑制される
- [x] config init で Notification hook が自動登録される（matcher なし）
- [x] テストが全て通る (445 passed)
- [x] ビルド・lint が通る

## 作業ログ

### 2026-02-24

1. `messages.ts` に `permissionRequest` を再追加（日: パーミッション確認です / 英: Permission required）
2. `hook-watcher.ts` を再作成 — chokidar ベースの JSONL 監視、`idle_prompt` パースに対応
3. `daemon.ts` に通知優先度システムを実装:
   - 4段階の優先度レベル（LEVEL_TURN_COMPLETE=1, LEVEL_PERMISSION_PROMPT=2, LEVEL_IDLE_PROMPT=3, LEVEL_ASK_QUESTION=4）
   - `cancelActivity()` で全通知をリセット
   - `handleHookEvents()` で hook イベントを処理
4. `claude-code-settings.ts` を再作成 — Notification hook を matcher なしで登録（idle_prompt + permission_prompt 両方をキャプチャ）
5. `wizard.ts` に hook 登録ステップを追加
6. `commands/config.ts` に hook 自動登録を追加（interactive / non-interactive 両対応）
7. `config.ts` の `resolveOptions` に `hooksDir` を追加
8. テストファイル: `daemon-hooks.test.ts`（13テスト）、`claude-code-settings.test.ts`（18テスト）を新規作成
