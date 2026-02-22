# TTS コマンド自動フォールバック (Issue #83)

## 目的・ゴール

`speaker.command` が設定ファイルで明示的に指定されていない場合、利用可能な TTS コマンドを自動検出してフォールバックする。Linux 環境でも設定なしで音声出力が使えるようにする。

## 検出優先順

1. `say` — macOS 標準
2. `espeak-ng` — Linux で広く利用可能
3. `espeak` — espeak-ng がない環境向け
4. いずれも不可 → 起動時にエラー

## 実装方針

- CLI 層（`src/cli/speaker-command.ts`）にコマンド検出ロジックを追加
  - PATH を探索して各コマンドの実行可能ファイルの存在を確認（サブプロセス不要）
- Speaker モジュール（`src/monitor/speaker.ts`）の `DEFAULT_COMMAND` を削除し、`command` を必須に変更
- `resolveOptions` に `speakerCommand` パラメータを追加し、CLI 側で検出したコマンドを必ず渡す
- Daemon 構築時に `speakFn` も `speaker` も提供されない場合はエラーを投げる

## 完了条件

- [x] 設定ファイルに `speaker.command` がない場合、利用可能な TTS コマンドを自動検出する
- [x] `say` → `espeak-ng` → `espeak` の優先順でフォールバックする
- [x] いずれも利用不可の場合、明確なエラーメッセージで起動を中止する
- [x] 設定ファイルで `speaker.command` が指定されている場合は自動検出をスキップする
- [x] テストが通る
- [x] ビルド・リントが通る

## 作業ログ

### 2026-02-22

- `speaker.ts`: `DEFAULT_COMMAND` を削除、`SpeakerOptions.command` を必須化
- `speaker-command.ts`: 新規作成。`detectSpeakerCommand()` と `resolveSpeakerCommand()` を実装
- `config.ts`: `resolveOptions` に `speakerCommand` パラメータを追加
- `daemon.ts`: `speaker` 未提供かつ `speakFn` 未提供時にエラーを投げる処理を追加
- `commands/monitor.ts`: `resolveSpeakerCommand` を呼び出すよう更新
- `speaker-command.test.ts`: 新規テスト（8 件）
- 既存テスト更新: `speaker.test.ts`, `config.test.ts`
- ビルド・リント・テスト（302 件）全て成功
