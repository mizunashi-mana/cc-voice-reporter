# タスク完了後のプロンプト待ちを音声で通知する

## 目的

Claude Code がタスクを完了してプロンプト待ち（ユーザー入力待ち）になったことを音声で通知する。（Issue #25）

## ゴール

- ターン完了時に「入力待ちです」と音声通知される
- サブエージェントのターン完了は通知されない
- デバウンス中のテキストは通知前にフラッシュされる
- テストが追加されている
- `npm run build` / `npm run lint` / `npm test` が通る

## 実装方針

### 検出方法

transcript JSONL の `system` レコード（`subtype: "turn_duration"`）がターン完了の確実なマーカー。タイムアウトベースの検出は不要。

### 変更対象

1. **parser.ts**: `ExtractedTurnComplete` 型を追加、`system` + `subtype: "turn_duration"` から抽出
2. **daemon.ts**: `turn_complete` メッセージの処理（サブエージェント除外、バッファフラッシュ、音声通知）
3. **テスト**: parser.test.ts / daemon.test.ts にテスト追加

## 完了条件

- [ ] parser が turn_complete を抽出できる
- [ ] daemon がターン完了時に通知する
- [ ] サブエージェントのターン完了は無視される
- [ ] デバウンス中テキストが通知前にフラッシュされる
- [ ] テストが全通過
- [ ] `npm run build` が通る
- [ ] `npm run lint` が通る
- [ ] `npm test` が通る

## 作業ログ
