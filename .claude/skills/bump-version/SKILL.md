---
description: Bump the package version. Use when you want to update the version number in package.json.
allowed-tools: Read, Edit, "Bash(npm install)", "Bash(git log*)", "Skill(autodev-create-pr)"
---

# バージョン更新

`packages/cc-voice-reporter/package.json` のバージョンを更新し、PR を作成します。

## 手順

### 1. 現在のバージョンを確認

`packages/cc-voice-reporter/package.json` を読み込み、現在のバージョンを確認する。

### 2. 前回リリースからの変更履歴を取得

`git log v{現在のバージョン}..HEAD --oneline` を実行し、前回リリース以降のコミット一覧を取得する。

### 3. 新しいバージョンを決定

ユーザーが具体的なバージョン番号を指定している場合はそれを使用する。
指定がない場合は、変更履歴の概要（主な変更点を箇条書きで要約）を提示した上で、ユーザーにどのバージョンに上げるか確認する。

### 4. ブランチを作成

`bump-version-{新バージョン}` ブランチを作成する。

### 5. バージョンを更新

`packages/cc-voice-reporter/package.json` の `"version"` フィールドを新しいバージョンに更新する。

### 6. package-lock.json を更新

`npm install` を実行し、`package-lock.json` に反映する。

### 7. コミット

変更をコミットする。メッセージ: `バージョンを {新バージョン} に更新`

### 8. PR を作成

`/autodev-create-pr` スキルを使って PR を作成する。

### 9. 結果を報告

更新前後のバージョンと PR の URL をユーザーに伝える。
