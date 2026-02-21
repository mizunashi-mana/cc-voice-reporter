# 読み上げモード（narration）の削除

Issue: https://github.com/mizunashi-mana/cc-voice-reporter/issues/68

## 目的・ゴール

読み上げモード（narration）を削除し、サマリモードのみの構成に簡素化する。
narration 削除に伴い、翻訳（translation）機能も不要となるため合わせて削除する。

## 残すもの

- **入力待ちアナウンス**（turn_complete → 「入力待ちです」）
- **確認待ちアナウンス**（AskUserQuestion → 「確認待ち: {質問}」）
- **定期要約通知**（Summarizer による Ollama 要約）
- **Speaker**（上記通知の音声出力）

## 実装方針

### 削除対象

1. **narration 関連**
   - `config.ts`: ConfigSchema から `narration` フィールドを削除
   - `daemon.ts`: `narration` プロパティ・分岐ガードを削除
   - `daemon.ts`: テキスト逐次読み上げのためのデバウンス/バッファロジック全体を削除
     - `textBuffer`, `debounceTimers`, `requestProject`, `requestSession`
     - `bufferText()`, `flushText()`, `flushAllPendingText()`, `cancelPendingTimers()`
     - `debounceMs` オプション
   - `daemon.ts`: `DaemonOptions.narration`, `DaemonOptions.debounceMs` フィールド削除

2. **translation 関連**（narration 削除で不要に）
   - `translator.ts` / `translator.test.ts`: ファイル削除
   - `config.ts`: `translation` 設定フィールドと解決ロジック削除
   - `daemon.ts`: `translateFn`, `translationQueue`, translation drain ロジック全体削除
   - `daemon.ts`: `speakTranslated` メソッド削除

3. **summary.enabled 廃止**
   - `config.ts`: `summary.enabled` を削除し、`summary` オブジェクトの存在で有効判定に変更
   - `config.ts`: `resolveOptions` の summary 解決ロジック簡素化

4. **テスト整理**
   - `config.test.ts`: narration / translation / summary.enabled 関連テストの削除・修正
   - `daemon.test.ts`: narration disabled / translation / debounce テストの削除・修正

5. **ドキュメント更新**
   - `.ai-agent/steering/tech.md`: narration / translation 記述の更新

### 残す部分の簡素化

- `handleAskUserQuestion`: 翻訳なしで直接読み上げ（`speakTranslated` → 直接 `speakFn`）
- `handleTurnComplete`: translation drain 待ちを削除、summary flush → 通知のシンプルなフロー

## 完了条件

- [x] narration 関連コードが完全に削除されている
- [x] translation 関連コード・ファイルが完全に削除されている
- [x] 入力待ち・確認待ちアナウンスが正常に動作する
- [x] summary.enabled が廃止され、summary オブジェクトの有無で判定されている
- [x] `npm run build` が通る
- [x] `npm run lint` が通る
- [x] `npm test` が通る

## 作業ログ

- narration フィールド・分岐ガード、テキストデバウンス/バッファリングロジックを daemon.ts から削除
- translator.ts / translator.test.ts を削除
- config.ts から narration, translation, debounceMs, summary.enabled を削除
- daemon.ts から translateFn, translationQueue, drain ロジック, speakTranslated を削除
- 入力待ち・確認待ちアナウンスは維持
- テストを整理（255 tests passed）
- steering ドキュメント（tech.md, plan.md, structure.md）を更新
