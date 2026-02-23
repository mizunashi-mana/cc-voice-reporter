# version コマンドと help コマンドを追加する

## 目的・ゴール

CLI に `--version` と `--help` (`-h`) コマンドオプションを追加する（Issue #101）。
また、バージョンを 0.3.0 に変更し、publish workflow 名を `publish` → `Publish` にする。

## 実装方針

1. `cli.ts` に `--version` ケースを追加し、package.json の version を表示する
2. USAGE テキストに `--version` と `--help` オプションの説明を追加
3. package.json の version を `0.2.0` → `0.3.0` に変更
4. publish.yml の workflow 名を `publish` → `Publish` に変更
5. `cli.test.ts` を新規作成し、`--version` と `--help` の動作を検証

## 完了条件

- [ ] `cc-voice-reporter --version` で `0.3.0` が表示される
- [ ] `cc-voice-reporter --help` / `-h` で使い方が表示される
- [ ] USAGE テキストに `--version` が含まれる
- [ ] package.json の version が `0.3.0`
- [ ] publish.yml の name が `Publish`
- [ ] テストが通る
- [ ] ビルドが通る
- [ ] リントが通る

## 作業ログ

