# 確認待ちメッセージの順序改善

Issue: https://github.com/mizunashi-mana/cc-voice-reporter/issues/34

## 目的・ゴール

`AskUserQuestion` の確認待ちメッセージ（「確認待ち: {質問}」）を、同一バッチ内のテキストメッセージより後にアナウンスするようにする。

## 背景

現在の `handleLines()` は `processLines` の結果を順番に処理するため、同一バッチ内にテキストと `AskUserQuestion` が含まれる場合、出現順でそのまま処理される。しかし通常、Claude はテキストで説明を行った後に `AskUserQuestion` を呼ぶため、テキスト→確認待ちの順序で読み上げるのが自然。

ただし、テキストメッセージは現在読み上げ対象外（サマリモードのみ）なので、実際に影響するのはサマリのフラッシュ順序。テキストイベントを先にサマライザーに記録し、`AskUserQuestion` のフラッシュ時にそのテキストも含めた要約が先に出るようにする。

## 実装方針

`handleLines()` 内で、`AskUserQuestion` の tool_use メッセージの処理を遅延させ、同一バッチ内の他のメッセージ（テキスト・他のツール）を先に処理してから、最後に `AskUserQuestion` を処理する。

具体的には:
1. `processLines` の結果をイテレートする際、`AskUserQuestion` メッセージを一時配列に蓄積
2. 他のメッセージは従来通り即座に処理
3. ループ終了後、蓄積した `AskUserQuestion` メッセージを処理

## 完了条件

- [x] `handleLines()` で `AskUserQuestion` が同一バッチ内の他メッセージより後に処理される
- [x] 既存テストが全て通る
- [x] 新規テスト: テキスト + AskUserQuestion の同一バッチで順序が正しいことを検証
- [x] `npm run build` / `npm run lint` / `npm test` が全て通る

## 作業ログ

- `daemon.ts` の `handleLines()` を修正: `AskUserQuestion` を `deferredAskQuestions` 配列に蓄積し、ループ後にまとめて処理
- テスト追加: 同一バッチ内で AskUserQuestion が他メッセージ（turn_complete 含む）より後に処理されることを検証
- build / lint / test 全パス（294 tests passed）
