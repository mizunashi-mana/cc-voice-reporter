# README / LICENSE を publish 対象に含め、バージョンを 0.2.0 にする

## 目的・ゴール

npm publish 時に README.md / LICENSE ファイルがパッケージに含まれていないため、含めるようにする。また、バージョンを 0.2.0 に更新する。

## 実装方針

- `packages/cc-voice-reporter/package.json` に `prepack` スクリプトを追加し、ルートの README.md / LICENSE / LICENSE.Apache-2.0.txt / LICENSE.MPL-2.0.txt をコピー
- `files` フィールドに LICENSE.Apache-2.0.txt / LICENSE.MPL-2.0.txt を追加（README.md / LICENSE は npm が自動的に含める）
- バージョンを 0.2.0 に更新（パッケージの package.json のみ）

## 完了条件

- [x] prepack スクリプトがルートからファイルをコピーする
- [x] files フィールドにライセンスファイルが含まれる
- [x] バージョンが 0.2.0 に更新されている
- [x] ビルド・lint・テストが通る
- [x] `npm pack` で README / LICENSE が含まれることを確認

## 作業ログ

- `packages/cc-voice-reporter/package.json` を編集:
  - `version` を `0.1.0` → `0.2.0` に更新
  - `files` に `LICENSE.Apache-2.0.txt`, `LICENSE.MPL-2.0.txt` を追加
  - `prepack` スクリプトを追加（ルートの README.md / LICENSE / LICENSE.*.txt をコピー）
- ビルド・lint・テストすべて通過
- `npm pack --dry-run` で README.md, LICENSE, LICENSE.Apache-2.0.txt, LICENSE.MPL-2.0.txt がパッケージに含まれることを確認
