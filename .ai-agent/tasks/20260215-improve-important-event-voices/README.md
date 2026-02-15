# improve-important-event-voices

## 目的・ゴール

重要なフックイベント（PermissionRequest, Notification, SubagentStart, SubagentStop, TaskCompleted, Stop）の音声読み上げを改善する。これらのイベントでは、これから始まる内容やここまでの内容が発信されるため、それらを音声で読み上げて状況がわかるようにする。

## 実装方針

### 対象イベントと改善内容

1. **PermissionRequest** (新規対応)
   - tool_name と tool_input から「何の許可が必要か」を具体的に読み上げ
   - 例: 「Bashコマンドの実行許可が必要です。テストを実行」「index.ts の編集許可が必要です」

2. **Notification** (改善)
   - permission_prompt: message フィールドも活用して具体的に
   - title がある場合はそれも活用

3. **SubagentStart** (新規対応)
   - agent_type から「どんなエージェントが起動したか」を読み上げ
   - 例: 「Explore エージェントを起動しました」

4. **SubagentStop** (新規対応)
   - agent_type から「どのエージェントが完了したか」を読み上げ
   - 例: 「Explore エージェントが完了しました」

5. **TaskCompleted** (新規対応)
   - task_subject を読み上げ
   - 例: 「タスク完了: ユーザー認証の実装」

6. **Stop** (改善)
   - stop_hook_active の場合は null を返す（既存）
   - 通常時は「処理が完了しました」のまま（十分）

### 技術的変更

- HookInput インターフェースに不足フィールドを追加
- 各イベント用のメッセージ生成関数を追加
- generateMessage のスイッチケースに新イベントを追加
- テストを追加

## 完了条件

- [x] HookInput に PermissionRequest / SubagentStart / SubagentStop / TaskCompleted 用フィールドを追加
- [x] PermissionRequest のメッセージ生成を実装
- [x] Notification のメッセージ生成を改善
- [x] SubagentStart のメッセージ生成を実装
- [x] SubagentStop のメッセージ生成を実装
- [x] TaskCompleted のメッセージ生成を実装
- [x] 全イベントのテストを追加
- [x] npm run build / lint / test が通る

## 作業ログ

- 2026-02-15: 全項目実装完了。ビルド・リント・テスト (60件) 全パス。動作確認済み。
