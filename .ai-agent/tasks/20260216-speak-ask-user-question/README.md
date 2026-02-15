# AskUserQuestion の音声再生

## 目的

Claude が `AskUserQuestion` で確認プロンプトを提示した際に質問内容を音声再生し、ユーザーが応答待ち状態に気づけるようにする。（Issue #18）

## ゴール

- `AskUserQuestion` tool_use を検知した際に質問内容を音声再生する
- 「確認待ち: {質問内容}」のプレフィックス付きで通常の応答と区別する
- 他の tool_use（Bash, Read 等）は再生しない
- テストが追加されている

## 実装方針

1. **daemon.ts の `handleLines` 拡張**: `msg.kind === "tool_use"` かつ `toolName === "AskUserQuestion"` の場合に質問内容を抽出して即時読み上げ
2. **質問テキスト抽出**: `extractAskUserQuestion` ヘルパーで `input.questions` 配列から `question` フィールドを取得・連結
3. **テスト追加**: daemon.test.ts に AskUserQuestion 再生テスト4件を追加

## 完了条件

- [x] `AskUserQuestion` tool_use 検知時に質問内容が音声再生される
- [x] 他の tool_use（Bash, Read 等）は再生されない
- [x] テストが追加されている（4件追加、計106テスト全通過）
- [x] `npm run build` が通る
- [x] `npm run lint` が通る
- [x] `npm test` が通る

## 作業ログ

- daemon.ts: `handleLines` に `AskUserQuestion` tool_use の処理を追加、`extractAskUserQuestion` ヘルパー関数を追加
- daemon.test.ts: AskUserQuestion 再生テスト4件追加（単一質問、複数質問、空質問、他ツール非再生）
