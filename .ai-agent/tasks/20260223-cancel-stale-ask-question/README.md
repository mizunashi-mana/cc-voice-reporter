# 確認待ち音声案内の遅延再生を防止する

Issue: https://github.com/mizunashi-mana/cc-voice-reporter/issues/104

## 目的・ゴール

AskUserQuestion の音声案内が、ユーザーが既に回答した後に遅れて再生される問題を解決する。
ユーザーが回答済みの場合は音声案内をキャンセルし、混乱を防ぐ。

## 原因分析

1. AskUserQuestion 検出 → Summarizer フラッシュ（Ollama API 呼び出し、非同期）→ 音声キューにエンキュー
2. フラッシュ待ちの間にユーザーが回答してしまう
3. `user` レコードは parser で解析されるが `extractMessages` で空配列が返るため、daemon が回答を検知できない
4. 結果、フラッシュ完了後に古い質問が読み上げられてしまう

## 実装方針

セッション毎の boolean フラグ方式で、回答済みの AskUserQuestion をキャンセルする。
入力待ち案内（turnComplete）も同様に boolean 化。

### 変更ファイル

1. **parser.ts**: `user` レコードから `ExtractedUserResponse` メッセージを抽出するように変更
2. **daemon.ts**: `askQuestionCancelled` / `turnCompleteCancelled` boolean フラグを追加し、ユーザー回答・新規アクティビティ時にキャンセル
3. **daemon.test.ts**: 新しいキャンセル動作のテストを追加
4. **parser.test.ts**: `ExtractedUserResponse` の抽出テストを追加

### 詳細設計

#### parser.ts
- `ExtractedUserResponse` 型を追加（`kind: 'user_response'`）
- `ExtractedMessage` union に追加
- `extractMessages` で `user` レコードに対して `{ kind: 'user_response' }` を返す

#### daemon.ts
- `askQuestionCancelled: Map<string, boolean>` を追加（セッションキー別）
- `turnCompleteCancelled: Map<string, boolean>` に変更（旧 `turnCompleteGeneration` カウンター）
- `handleLines` で `user_response` / `text` / `tool_use` メッセージ受信時にフラグを `true` に設定
- `handleAskUserQuestion` / `handleTurnComplete` でフラグを `false` にリセットし、フラッシュ後にチェック

## 完了条件

- [x] `user` レコードが `ExtractedUserResponse` として抽出される
- [x] AskUserQuestion の音声案内がユーザー回答後にキャンセルされる
- [x] Summarizer フラッシュ中にユーザーが回答した場合、フラッシュ後に音声が再生されない
- [x] 新しい assistant 活動（text/tool_use）も AskUserQuestion をキャンセルする
- [x] turnComplete 通知も同様に boolean フラグ方式に変更
- [x] 既存テストが通る
- [x] `npm run build` / `npm run lint` / `npm test` すべて通る

## 作業ログ

- parser.ts に `ExtractedUserResponse` 型を追加し、`extractMessages` で user レコードを処理
- daemon.ts のジェネレーションカウンターを boolean フラグに変更（`askQuestionCancelled`, `turnCompleteCancelled`）
- daemon.test.ts に AskUserQuestion キャンセルテスト（summarizer あり/なし、セッション分離）を追加
- parser.test.ts を `ExtractedUserResponse` に合わせて更新
- ビルド・リント・テスト全て通過（361 tests passed）
