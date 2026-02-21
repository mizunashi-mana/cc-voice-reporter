# merge-packages: cli と monitor パッケージの統合

## 目的・ゴール

npm workspaces による monorepo (packages/cli + packages/cc-voice-reporter) を単一パッケージに統合する。publish 時のデメリット（バンドル複雑性、依存管理の二重化）を解消しつつ、monitor の依存閉包性は維持する。

## 実装方針

- `packages/cc-voice-reporter/src/` → `src/monitor/` に移動
- `packages/cli/src/` → `src/cli/` に移動
- `src/index.ts` を新規作成し、monitor の公開 API を再エクスポート
- `#lib = src/index.ts` として CLI コードは `#lib` 経由でのみ monitor にアクセス
- ESLint の `no-restricted-imports` (`../` 禁止) が既にあるため、index.ts を介した参照制御が自然に実現される
- npm workspaces を廃止し、単一の package.json に統合
- tsup で CLI エントリポイントをバンドル（外部依存は external）
- eslint-config パッケージは維持（devDependency として利用）

## 完了条件

- [ ] `npm run build` が成功する
- [ ] `npm run lint` がエラーなしで通る
- [ ] `npm test` が全テスト通過する
- [ ] monitor コードが `src/monitor/` 配下で自己完結している
- [ ] CLI コードが `#lib` 経由でのみ monitor にアクセスしている
- [ ] `../` による親参照がない（ESLint で保証）

## 作業ログ

（作業中に記録）
