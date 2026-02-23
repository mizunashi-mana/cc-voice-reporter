# fix-select-events-for-prompt

Issue: https://github.com/mizunashi-mana/cc-voice-reporter/issues/128

## 目的・ゴール

`selectEventsForPrompt()` のフィルタリングロジックを期待する挙動に修正する。

## 現状の問題

- `FILTER_THRESHOLD`（10）と `DEFAULT_MAX_PROMPT_EVENTS`（30）の二段階閾値がある
- テキストイベントがある場合、テキスト優先＋残りスロットに tool_use も含める
- テキストイベントがない場合、末尾から maxPromptEvents 件を取得
- config.ts 側のデフォルトも 30

## 期待する動作

- 閾値は `maxPromptEvents`（デフォルト 10）の一段階のみ
- テキストイベントが1つでもある場合: テキストイベントのみに限定し、先頭から `maxPromptEvents` 件で切り詰め
- テキストイベントがない場合: イベント全体を先頭から `maxPromptEvents` 件で切り詰め
- 残り何件省略したかを付与する

## 実装方針

1. `summarizer-prompt.ts` の `FILTER_THRESHOLD` 定数を削除
2. `DEFAULT_MAX_PROMPT_EVENTS` を 30 → 10 に変更
3. `selectEventsForPrompt()` のロジックを書き換え:
   - events.length <= maxPromptEvents → そのまま返す
   - テキストイベントがある → テキストのみ、先頭から maxPromptEvents 件
   - テキストイベントがない → 全体を先頭から maxPromptEvents 件
4. `config.ts` の `DEFAULT_MAX_PROMPT_EVENTS` も 30 → 10 に変更
5. テスト・omission メッセージを更新

## 完了条件

- [x] `selectEventsForPrompt()` が期待する挙動で動作する
- [x] デフォルト上限が 10 件になっている
- [x] テスト更新済みで全テスト通過
- [x] `npm run build` / `npm run lint` / `npm test` すべて通過

## 作業ログ

- `summarizer-prompt.ts`: `FILTER_THRESHOLD` 定数を削除、`DEFAULT_MAX_PROMPT_EVENTS` を 10 に変更、`selectEventsForPrompt()` を新ロジックに書き換え（テキストイベントのみに限定、先頭から切り詰め）、omission メッセージを更新
- `config.ts`: `DEFAULT_MAX_PROMPT_EVENTS` を 10 に変更
- `summarizer-prompt.test.ts`: テストを新ロジックに合わせて全面書き換え（7テスト）
- `daemon.test.ts`, `summarizer.test.ts`, `config.test.ts`: `maxPromptEvents: 30` → `10` に更新
- ビルド・リント・テスト（399テスト）すべて通過
