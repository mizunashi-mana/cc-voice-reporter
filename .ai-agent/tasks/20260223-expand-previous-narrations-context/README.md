# expand-previous-narrations-context

GitHub Issue: https://github.com/mizunashi-mana/cc-voice-reporter/issues/91

## 目的・ゴール

ナレーション生成時に直前2つ分のナレーションをプロンプトのコンテキストとして渡し、口調のブレを抑え、ストーリーの流れをより正確に把握できるようにする。

## 実装方針

`packages/cc-voice-reporter/src/monitor/summarizer.ts` の以下を変更:

1. **`lastSummaryBySession`** の型を `Map<string, string>` → `Map<string, string[]>` に変更（最大2件を保持）
2. **`buildPrompt()`** のシグネチャを `previousSummary?: string | null` → `previousSummaries?: string[]` に変更
3. **プロンプト構築** で2つの履歴を時系列順に含める（`Previous narration (older):` / `Previous narration (recent):`、1件の場合は `Previous narration:`）
4. **`buildSystemPrompt()`** を「previous narrations」（複数形）に対応するよう調整
5. **`doFlush()`** 内の履歴取得・保存ロジックを配列ベースに変更（FIFO で最大2件管理）

## 完了条件

- [x] `lastSummaryBySession` が直前2つのナレーションを保持する
- [x] `buildPrompt()` が複数の過去ナレーションを受け取り、時系列順にプロンプトへ含める
- [x] `buildSystemPrompt()` が複数履歴に対応した文言になっている
- [x] `doFlush()` が履歴を配列として管理し、最大2件を保持する
- [x] 既存テストが全て更新・通過する
- [x] `npm run build` / `npm run lint` / `npm test` が全てパスする

## 作業ログ

- `lastSummaryBySession` を `lastSummariesBySession: Map<string, string[]>` に変更し、最大2件を FIFO で保持
- `buildPrompt()` のシグネチャを `previousSummaries?: string[]` に変更。1件の場合は `Previous narration:` ラベル、2件の場合は `(older)` / `(recent)` ラベルで出力
- `buildSystemPrompt()` の文言を「previous narrations」（複数形）に更新
- `doFlush()` で履歴を配列ベースで管理し、2件を超えたら `shift()` で古いものを削除
- テストを更新: 既存テストの修正 + 2件・3件以上のフラッシュ時の履歴管理テスト追加
- build / lint / test 全てパス（324 tests passed）
