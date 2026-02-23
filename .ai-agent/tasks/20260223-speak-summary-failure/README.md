# 要約失敗時にその旨とイベント件数を音声で報告する

Issue: https://github.com/mizunashi-mana/cc-voice-reporter/issues/92

## 目的・ゴール

Ollama による要約生成が失敗した場合、失敗した旨と要約対象だったイベントの件数を音声で報告する。

## 実装方針

1. `messages.ts` の `Messages` インターフェースに `summaryFailed` メッセージを追加
2. `summarizer.ts` で `getMessages` を使って Messages を取得し、catch ブロックで `speakFn` を呼び出す
3. テストを更新

## 完了条件

- [x] `messages.ts` に `summaryFailed` メッセージが追加されている
- [x] `summarizer.ts` の catch ブロックで音声報告が行われる
- [x] 既存テストが通る
- [x] 新規テスト（失敗時に音声報告されること）が追加されている
- [x] `npm run build` が通る
- [x] `npm run lint` が通る
- [x] `npm test` が通る

## 作業ログ

- `messages.ts`: `Messages` インターフェースに `summaryFailed: (eventCount: number) => string` を追加。日本語・英語の両メッセージを定義
- `summarizer.ts`: `getMessages` をインポートし、コンストラクタで `messages` を保持。`doFlush` の catch ブロックで `this.speakFn(this.messages.summaryFailed(events.length))` を呼び出し
- `messages.test.ts`: 日本語・英語の `summaryFailed` テストを追加（2件）
- `summarizer.test.ts`: 失敗時の既存テスト 3 件を更新（音声報告の検証追加）、新規テスト 3 件追加（件数検証、日本語メッセージ、英語メッセージ）
- Build / Test (320 passed) / Lint 全てパス
