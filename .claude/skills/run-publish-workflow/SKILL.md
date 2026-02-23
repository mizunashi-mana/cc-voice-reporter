---
description: Run the publish workflow to publish the npm package and create a GitHub release. Use when you want to publish a new version.
allowed-tools: "Bash(gh *)", "Bash(git *)", "Bash(node *)", "Bash(sleep *)", Read
---

# npm パッケージの公開

publish ワークフローを実行して npm パッケージを公開し、GitHub リリースを作成します。

## 手順

### 1. 事前チェック

以下を並列で確認:

- `git branch --show-current` で main ブランチにいることを確認
  - main でなければ、先にデフォルトブランチに切り替えるよう案内して中止
- `git status --short` で未コミットの変更がないことを確認
  - 変更がある場合は、先にコミットまたはスタッシュするよう案内して中止
- パッケージバージョンの確認:
  - `node -p "require('./packages/cc-voice-reporter/package.json').version"` でバージョンを取得
  - `git ls-remote --tags origin "refs/tags/v{version}"` でタグが未作成であることを確認
  - タグが既に存在する場合は、バージョンを上げてからリトライするよう案内して中止

### 2. ユーザーに確認

公開するバージョンを表示し、実行してよいか確認を取る。

### 3. ワークフロー実行

```bash
gh workflow run publish.yml --ref main
```

### 4. 進捗監視

ワークフロー実行直後は Run がまだ取得できないため、少し待ってから取得する:

```bash
sleep 3 && gh run list --workflow=publish.yml --limit=1
```

表示された Run ID を使って進捗を監視する:

```bash
gh run watch <run-id>
```

### 5. 結果報告

- **成功**: 公開されたバージョンと GitHub リリースの URL を報告
  - `gh release view v{version} --json url -q .url` でリリース URL を取得
- **失敗**: エラーの詳細を報告
  - `gh run view <run-id> --log-failed` で失敗ログを取得

## 注意事項

- main ブランチからのみ実行可能（ワークフロー側の `if: github.ref == 'refs/heads/main'` で制御）
- publish ジョブは npm provenance 付きで公開する
- タグとリリースはワークフロー内で自動作成される
