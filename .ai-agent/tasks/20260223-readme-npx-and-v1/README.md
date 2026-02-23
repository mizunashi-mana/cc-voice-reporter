# README の npx ベース化 + v1.0.0 リリース準備

## 目的・ゴール

README のコマンド例を `cc-voice-reporter` から `npx @mizunashi_mana/cc-voice-reporter` に変更し、npx で直接実行できることを明示する。また、"Under active development." のステータス表記を削除し、バージョンを 1.0.0 に変更する。

## 実装方針

1. README.md の Usage セクションのコマンド例を全て `npx @mizunashi_mana/cc-voice-reporter` ベースに変更
2. Configuration セクションのコマンド例も同様に変更
3. `> **Status**: Under active development.` の行を削除
4. `packages/cc-voice-reporter/package.json` の version を `"1.0.0"` に変更

## 完了条件

- [x] README の全コマンド例が `npx @mizunashi_mana/cc-voice-reporter` ベースになっている
- [x] "Under active development." が削除されている
- [x] package.json の version が `"1.0.0"` になっている
- [x] `npm run build` が成功する
- [x] `npm run lint` が成功する
- [x] `npm test` が成功する

## 作業ログ

- README.md: Usage セクションの全コマンド例を `npx @mizunashi_mana/cc-voice-reporter` に変更
- README.md: Configuration セクションの `cc-voice-reporter config init` を `npx @mizunashi_mana/cc-voice-reporter config init` に変更
- README.md: `> **Status**: Under active development.` を削除
- packages/cc-voice-reporter/package.json: version を `"0.3.0"` → `"1.0.0"` に変更
- ビルド・リント・テスト全て成功
