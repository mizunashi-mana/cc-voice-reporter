# remove-hook-permission-feature

## 目的・ゴール

hook でのパーミッション案内がうまく機能していないため、パーミッション確認案内機能を削除する。また、`config init` での hook-receiver 設定機能も削除し、README からも hook の記述を消す。hook-receiver コマンド自体はデバッグ用に残す。

## 実装方針

### 削除対象

1. **ファイル全体を削除**
   - `src/monitor/hook-watcher.ts` + テスト
   - `src/cli/claude-code-settings.ts` + テスト

2. **daemon.ts から hook 関連コードを削除**
   - HookWatcher の import・初期化・start/stop・handleHookEvents メソッド
   - DaemonOptions から hooksDir を削除

3. **messages.ts から permissionRequest を削除**

4. **wizard.ts から askHooksRegistration を削除**

5. **config command から hook 登録機能を削除**

6. **cli/index.ts から claude-code-settings エクスポートを削除**

7. **config.ts の resolveOptions から hooksDir を削除**

8. **monitor/index.ts から HookEvent エクスポートを削除**

9. **README.md から Claude Code Hooks セクションを削除**

### 残す対象

- `src/cli/commands/hook-receiver.ts` + テスト（デバッグ用）
- hook-receiver コマンドのルーティング（cli.ts）
- hook-receiver が使う config 関数（getHooksDir 等）

## 完了条件

- [x] hook 関連ファイル・コードの削除
- [x] テストが全て通る（395 passed）
- [x] ビルドが通る
- [x] lint が通る

## 作業ログ

- hook-watcher.ts, hook-watcher.test.ts を削除
- claude-code-settings.ts, claude-code-settings.test.ts を削除
- daemon.ts から HookWatcher 関連コード（import, フィールド, 初期化, start/stop, handleHookEvents）を削除
- messages.ts から permissionRequest を削除（インターフェース・ja・en）
- monitor/index.ts から HookEvent エクスポートを削除
- wizard.ts から askHooksRegistration と registerHooks フィールドを削除
- config command から tryRegisterHooks と hook 登録依存を削除
- cli/index.ts から claude-code-settings エクスポートを削除
- config.ts の resolveOptions から hooksDir を削除
- README.md から Claude Code Hooks セクションと hook 関連記述を削除
- daemon.test.ts から handleHookEvents テストと HookEvent import を削除
- messages.test.ts から permissionRequest テストを削除
- wizard.test.ts から hook 関連テストを削除し、回答数を調整
- config.test.ts から hook 関連テストを削除
