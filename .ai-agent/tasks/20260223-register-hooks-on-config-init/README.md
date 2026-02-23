# register-hooks-on-config-init

## 目的・ゴール

`cc-voice-reporter config init` 実行時に、Claude Code のグローバル設定（`~/.claude/settings.json`）にフック設定を自動登録する。これにより、ユーザーが手動で hooks 設定を追記する手間を省く。

## 登録するフック

| イベント | matcher | 用途 |
|---------|---------|------|
| `SessionStart` | なし（全トリガー） | セッション開始の検知 |
| `Notification` | `permission_prompt` | パーミッション確認の読み上げ |

## 実装方針

1. Claude Code 設定ファイルの読み書きユーティリティを作成
2. ウィザードにフック登録ステップを追加（Step 4）
3. config init 完了後にフックを `~/.claude/settings.json` にマージ
4. 既存のフック設定を壊さないよう安全にマージ
5. non-interactive モードでもフック登録を行う

### 具体的な変更ファイル

- `src/cli/claude-code-settings.ts`（新規）: Claude Code settings.json の読み書き・マージ
- `src/cli/wizard.ts`: フック登録ステップの追加
- `src/cli/commands/config.ts`: config init 後にフック登録を実行
- テストファイル

## 完了条件

- [ ] `config init` のウィザードでフック登録の確認ステップがある
- [ ] 確認後 `~/.claude/settings.json` にフック設定がマージされる
- [ ] 既存の hooks 設定がある場合は安全にマージ（上書きしない）
- [ ] 既に hook-receiver が登録済みの場合はスキップ
- [ ] non-interactive モードでもフック登録される
- [ ] テストが通る
- [ ] ビルド・リントが通る

## 作業ログ

（作業中に記録）
