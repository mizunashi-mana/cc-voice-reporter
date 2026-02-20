# config-file-support

## 概要

オプションを設定ファイルで受け取れるようにする。

## 背景

現在、cc-voice-reporter のオプションは CLI 引数（`--include`, `--exclude`）のみで設定できる。
設定ファイルに対応することで、以下の利点が得られる:

- 毎回 CLI 引数を指定する必要がなくなる
- Speaker の maxLength、debounceMs などの詳細オプションも設定可能になる
- フェーズ 4/5 の機能拡充（多言語対応、音声設定）の基盤になる

## 現在の設定可能項目

- `WatcherOptions`: `projectsDir`, `filter.include`, `filter.exclude`
- `SpeakerOptions`: `maxLength`, `truncationSeparator`
- `DaemonOptions`: `debounceMs`

## 設計上の判断ポイント

- 設定ファイルのフォーマット（JSON / TOML / YAML など）
- 設定ファイルの配置場所（XDG Base Directory 準拠、~/.config/ など）
- CLI 引数と設定ファイルの優先順位
- 設定ファイルが存在しない場合のデフォルト動作

## ステータス

- [x] タスク作成
- [ ] 設計
- [ ] 実装
- [ ] レビュー
- [ ] 完了
