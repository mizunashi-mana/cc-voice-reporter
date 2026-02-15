# 全基本フックイベントの本格対応

## 目的・ゴール

現在スケルトン実装の4イベント（PreToolUse, PostToolUse, Notification, Stop）を本格的なメッセージ生成に改善し、未対応の基本イベント（SessionStart, SessionEnd, UserPromptSubmit, PostToolUseFailure）を新規追加する。

## 実装方針

### 新規追加イベント

| イベント | メッセージ例 |
|---------|------------|
| SessionStart | 「セッションを開始しました」（source に応じて変化） |
| SessionEnd | 「セッションを終了します」 |
| UserPromptSubmit | 「プロンプトを受け付けました」 |
| PostToolUseFailure | 「ツール X が失敗しました」 |

### 既存イベントの改善

- **PreToolUse**: ツール種別ごとに具体的なメッセージを生成
  - Bash: 実行するコマンドの概要
  - Write: 作成するファイル名
  - Edit: 編集するファイル名
  - Read: 読み取るファイル名
  - Grep/Glob: 検索内容
  - Task: サブエージェントの起動
  - その他ツール: 汎用メッセージ
- **PostToolUse**: ツール種別ごとの完了メッセージ
- **Notification**: notification_type に応じたメッセージ
- **Stop**: stop_hook_active を考慮

### HookInput 型の更新

Claude Code フックの全フィールドに対応するよう型定義を拡充する。

## 完了条件

- [ ] HookInput 型が全基本イベントのフィールドを網羅
- [ ] 8 つの基本イベントすべてに対応
- [ ] PreToolUse / PostToolUse で主要ツールごとの具体的メッセージ生成
- [ ] 全メッセージ生成ロジックのユニットテスト
- [ ] `npm run build` / `npm run lint` / `npm test` が通る

## 作業ログ

（作業開始後に記録）
