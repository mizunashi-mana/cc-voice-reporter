---
description: Bump the package version. Use when you want to update the version number in package.json.
allowed-tools: Read, Edit, Skill
---

# バージョン更新

`packages/cc-voice-reporter/package.json` のバージョンを更新し、PR を作成します。

## 手順

### 1. 現在のバージョンを確認

`packages/cc-voice-reporter/package.json` を読み込み、現在のバージョンを確認する。

### 2. 新しいバージョンを決定

ユーザーが具体的なバージョン番号を指定している場合はそれを使用する。
指定がない場合は、ユーザーにどのバージョンに上げるか確認する。

### 3. ブランチを作成

`bump-version-{新バージョン}` ブランチを作成する。

### 4. バージョンを更新

`packages/cc-voice-reporter/package.json` の `"version"` フィールドを新しいバージョンに更新する。

### 5. コミット

変更をコミットする。メッセージ: `バージョンを {新バージョン} に更新`

### 6. PR を作成

`/autodev-create-pr` スキルを使って PR を作成する。

### 7. 結果を報告

更新前後のバージョンと PR の URL をユーザーに伝える。
