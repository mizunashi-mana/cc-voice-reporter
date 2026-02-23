# npm パッケージとして公開する

Issue: https://github.com/mizunashi-mana/cc-voice-reporter/issues/98

## 目的・ゴール

`@mizunashi_mana/cc-voice-reporter` を npm レジストリに公開し、`npx` や `npm install -g` で簡単にインストール・実行できるようにする。

## 実装方針

### 1. package.json の公開設定追加 (`packages/cc-voice-reporter/package.json`)

- `files`: `["dist"]` — 公開対象を dist ディレクトリに限定
- `publishConfig`: `{"registry": "https://registry.npmjs.org/", "access": "public", "provenance": true}`
- `repository`: `{"type": "git", "url": "https://github.com/mizunashi-mana/cc-voice-reporter"}` — Sigstore 検証に必須。`git+` プレフィックスや `.git` サフィックスは不可
- `description`, `homepage`, `keywords` 等のメタデータ追加

### 2. GitHub Actions による OIDC ベース自動公開 CI (`.github/workflows/publish.yml`)

npm の Trusted Publishing（OIDC）を使用。長寿命の NPM_TOKEN シークレットは不要。

**トリガー**: 手動実行 (`on: workflow_dispatch`)、main ブランチのみ publish 可能

**ワークフロー構成**:
- `build-and-test` ジョブ: ビルド + テスト実行、成果物を artifact で upload
- `publish` ジョブ: `if: github.ref == 'refs/heads/main'` でブランチ制限、artifact を download して publish
- `permissions: id-token: write` — OIDC トークン生成に必須
- `actions/setup-node` に `registry-url: 'https://registry.npmjs.org/'` を指定 — .npmrc 生成に必要
- npm >= 11.5.1 が必要（Node 24.x なら標準搭載）
- `npm publish --provenance --access public` で公開（`NODE_AUTH_TOKEN` は設定しない）
- workspace 内のパッケージなので `-w packages/cc-voice-reporter` を指定
- package.json の version からタグ重複チェック → publish → タグ・リリースノート自動作成

**npmjs.com 側の設定（手動、初回のみ）**:
- 初回は手動で `npm publish` してパッケージを作成する必要がある（Trusted Publishing はパッケージが既に存在していることが前提）
- その後 npmjs.com でパッケージの Settings → Trusted Publisher に GitHub Actions を設定:
  - Organization/User: `mizunashi-mana`
  - Repository: `cc-voice-reporter`
  - Workflow filename: `publish.yml`

### 3. README にインストール手順を追記

- Quick Start を `npx` ベースに変更
- 既存の clone & build 手順は Development セクションに残す

## 完了条件

- [x] package.json に公開用フィールドが設定されている
- [x] GitHub Actions の publish ワークフローが作成されている
- [x] README にインストール手順が記載されている
- [x] `npm run build` が通る
- [x] `npm run lint` が通る
- [x] `npm test` が通る

## 作業ログ

- package.json に files, publishConfig, repository, description, homepage, keywords を追加
- OIDC Trusted Publishing ベースの .github/workflows/publish.yml を作成
- README の Quick Start を npm install -g ベースに更新、clone & build は Development に移動
- npm badge を追加
- build / lint / test 全て通過確認済み
