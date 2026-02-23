# hook-receiver によるパーミッション確認プロンプト読み上げ

Issue: https://github.com/mizunashi-mana/cc-voice-reporter/issues/23

## 目的・ゴール

Claude Code がツール実行時にパーミッション確認プロンプトを表示して入力待ちになった際、その状態を音声で即座にユーザーに通知する。transcript .jsonl にはパーミッション確認イベントが記録されないため、Claude Code の Hooks 機構を利用して検出する。

## 実装方針

### 概要

1. **`hook-receiver` サブコマンドの追加**: Claude Code の Hook から呼び出される CLI コマンド。stdin で受け取った Hook データをセッション固有のファイルに書き込む
2. **Hook データファイルの管理**: セッション ID ごとにファイルを作成し、Hook データを JSONL 形式で追記する
3. **`config init` の拡張**: ウィザードで Claude Code の Hook 設定（`Notification` イベントの `permission_prompt` マッチャー）を自動生成する案内を追加
4. **Daemon の拡張**: Hook データファイルも監視し、`permission_prompt` を検出したら即座にフラッシュ音声通知を行う
5. **transcript との重複排除**: Hook データのうち transcript と重複するイベントを除外するフィルタリング機構

### アーキテクチャ

```
Claude Code ──Hook──→ cc-voice-reporter hook-receiver (stdin: JSON)
                              │
                              ↓
                      $XDG_STATE_HOME/cc-voice-reporter/hooks/{session_id}.jsonl
                              │
                      Daemon (chokidar で監視)
                              │
                              ↓
                      Speaker (フラッシュ通知: 「パーミッション確認です」)
```

### 使用する Hook

- **`Notification`** イベント + **`permission_prompt`** マッチャー
  - 非ブロッキング（副作用のみ）で、パーミッションダイアログ表示時に発火
  - stdin で `session_id`, `message`, `notification_type` 等を受信

### Hook 設定例（`.claude/settings.json`）

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "permission_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "cc-voice-reporter hook-receiver"
          }
        ]
      }
    ]
  }
}
```

## 完了条件

- [x] `hook-receiver` サブコマンドが追加され、stdin の Hook JSON を解析してセッション固有ファイルに書き込む
- [x] Daemon が Hook データファイルを監視し、permission_prompt を検出して音声通知を行う
- [ ] `config init` ウィザードで Hook 設定の案内が追加される（次タスクへ延期）
- [x] messages.ts に permission_prompt 用のメッセージが追加される
- [x] テストが通る（407テスト全パス）
- [x] ビルド・リントが通る

## 作業ログ

### 2026-02-23

#### 新規ファイル
- `src/cli/commands/hook-receiver.ts` - hook-receiver サブコマンド
- `src/cli/commands/hook-receiver.test.ts` - テスト
- `src/monitor/hook-watcher.ts` - HookWatcher モジュール（chokidar + tail）
- `src/monitor/hook-watcher.test.ts` - テスト

#### 変更ファイル
- `src/monitor/messages.ts` - `permissionRequest` メッセージ追加（ja/en）
- `src/monitor/daemon.ts` - HookWatcher 統合、`handleHookEvents` メソッド追加
- `src/cli/config.ts` - `stateDir` 設定項目、`getDefaultStateDir()`、`getHooksDir()` 追加
- `src/cli/cli.ts` - `hook-receiver` サブコマンド追加
- `src/cli/index.ts` - 新エクスポート追加
- `src/monitor/index.ts` - `HookEvent` 型エクスポート追加

#### 備考
- `config init` ウィザードでの Hook 設定案内は別タスクとして延期
- Hook データは `$XDG_STATE_HOME/cc-voice-reporter/hooks/` に保存（`stateDir` 設定でカスタマイズ可能）
