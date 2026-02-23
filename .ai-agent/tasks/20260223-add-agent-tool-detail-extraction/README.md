# タスク: エージェント関連ツールの詳細情報抽出を追加

Issue: https://github.com/mizunashi-mana/cc-voice-reporter/issues/115

## 目的・ゴール

`extractToolDetail()` が TaskCreate, TaskUpdate, TeamCreate, SendMessage に対応していないため、要約プロンプトにツール名のみが渡され意味のある要約が生成されない問題を修正する。

## 実装方針

`packages/cc-voice-reporter/src/monitor/summarizer.ts` の `extractToolDetail()` に以下のケースを追加:

| ツール | 抽出フィールド | 出力例 |
|---|---|---|
| TaskCreate | `subject` | `TaskCreate: PR #123 をレビュー` |
| TaskUpdate | `status`, `subject`（存在する場合） | `TaskUpdate: completed` / `TaskUpdate: completed PR #123 をレビュー` |
| TeamCreate | `team_name` | `TeamCreate: review-pr-123` |
| SendMessage | `recipient`, `summary` | `SendMessage: researcher へ「コード調査完了の報告」` |

## 完了条件

- [x] `extractToolDetail()` が上記4ツールに対応
- [x] 各ツールのユニットテストが追加済み
- [x] `npm run build` 成功
- [x] `npm run lint` 成功
- [x] `npm test` 成功

## 作業ログ

- 単純なフィールド抽出（Read, Write, Edit, NotebookEdit, Bash, TaskCreate, TeamCreate）をマップベースに統合し、`extractToolDetail()` の複雑度を削減
- TaskUpdate（status + subject）、SendMessage（recipient + summary）は複合ロジックのため switch 文で処理
- テストは `it.each` を活用して行数を抑制（max-lines: 900 制約対応）
