# publish フローの Claude スキル化

## 目的・ゴール

publish ワークフロー（`gh workflow run publish.yml` → 進捗監視 → 完了確認）を Claude スキルとして `/run-publish-workflow` で実行できるようにする。

## 実装方針

`.claude/skills/run-publish-workflow/SKILL.md` を作成し、以下のフローを定義:

1. main ブランチにいることを確認
2. 未コミットの変更がないことを確認
3. package.json からバージョンを取得し、タグが未作成であることを確認
4. `gh workflow run publish.yml --ref main` でワークフローをトリガー
5. `gh run watch` で進捗を監視
6. 結果をユーザーに報告

## 完了条件

- [x] `.claude/skills/run-publish-workflow/SKILL.md` が作成されている
- [x] スキル一覧に `run-publish-workflow` が表示される
- [x] `.ai-agent/structure.md` が更新されている

## 作業ログ

- スキル名を `run-publish-workflow` に決定（ユーザー指定）
- `.claude/skills/run-publish-workflow/SKILL.md` を作成
- `.ai-agent/structure.md` にスキルディレクトリを追加
- スキル一覧への反映を確認済み
