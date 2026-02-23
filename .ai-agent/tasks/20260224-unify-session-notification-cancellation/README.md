# unify-session-notification-cancellation

## 目的・ゴール

AskQuestion / turn complete / hook notification の3種類のセッション通知イベントハンドリングを統一し、キャンセルの仕組みを確実に動作させる。

## 現状の問題

1. **Speaker キューに入った後キャンセルできない**: `cancelActivity` で generation を進めても、既に Speaker の queue に入ったメッセージは取り消せない
2. **deferredAskQuestions でキャンセル漏れ**: 同一バッチ内で AskUserQuestion と user_response が来た場合、deferred 処理時点で generation が一致してしまいスピーチが実行される
3. **中途半端に独立した仕組み**: turn_complete / AskUserQuestion / hook notification がそれぞれ似たようなパターン（summary flush → generation check → speak）を個別に実装しており、可読性が低く競合バグが起きやすい

## 実装方針

1. **Speaker に cancelTag ベースのキャンセル機能を追加**: `speak()` にオプショナルな `cancelTag` パラメータを追加し、`cancelByTag(tag)` メソッドで該当タグのキュー内アイテムだけを除去。サマリーメッセージはタグなしで enqueue されるためキャンセル対象外
2. **Daemon の `cancelActivity` で通知メッセージのみキャンセル**: 通知系メッセージ（turn_complete, AskUserQuestion, permission_prompt）に `notification:{sessionKey}` タグを付けて enqueue し、`cancelActivity` から `cancelByTag` を呼ぶ
3. **統一的な通知ディスパッチ関数の作成**: summary flush → generation check → priority check → speak のパターンを `dispatchNotification` に共通化
4. **deferredAskQuestions のバッチ内キャンセル**: 同一バッチ内の user_response を `userRespondedInBatch` フラグで追跡し、deferred AskUserQuestion を抑制

## 完了条件

- [x] Speaker に cancelTag ベースのキャンセル API (`cancelByTag`) が追加されている
- [x] 通知メッセージのみにタグが付き、サマリーはキャンセル対象外
- [x] `cancelActivity` が Speaker キューから該当セッションの通知メッセージを除去する
- [x] turn_complete / AskUserQuestion / hook notification の通知パターンが `dispatchNotification` に共通化されている
- [x] 同一バッチ内の AskUserQuestion → user_response でスピーチがキャンセルされる
- [x] Speaker キューに入った後でもキャンセルが効く
- [x] 既存テストが全て通る
- [x] 新しいキャンセル動作のテストが追加されている
- [x] `npm run build` / `npm run lint` / `npm test` が通る

## 作業ログ

- Speaker に cancelTag フィールドと cancelByTag メソッドを追加
- SpeakFn 型に cancelTag パラメータを追加
- Daemon の全通知メッセージに `notification:{sessionKey}` タグを付与
- `cancelActivity` から `speaker.cancelByTag` を呼び出すよう変更
- `handleTurnComplete` / `handleAskUserQuestion` / `handleHookEvents` を `dispatchNotification` に統合
- 同一バッチ内の user_response で deferred AskUserQuestion を抑制する `userRespondedInBatch` フラグを追加
- テスト追加: Speaker.cancelByTag (5件)、バッチ内キャンセル (1件)、cancelTag 伝搬確認 (3件)
- キャンセル関連テストを `daemon-cancellation.test.ts` に分離（max-lines 対応）
