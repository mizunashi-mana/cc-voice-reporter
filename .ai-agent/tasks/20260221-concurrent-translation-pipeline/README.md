# concurrent-translation-pipeline

## 関連 Issue

- https://github.com/mizunashi-mana/cc-voice-reporter/issues/42

## 目的・ゴール

翻訳処理の実行タイミングを、現在のフラッシュ時（音声出力直前）からキュー追加時の並行実行に変更し、音声出力までの待機時間を短縮する。また、翻訳前後のメッセージを debug レベルのログに出力する。

## 背景

現在、翻訳はフラッシュ時（テキストを音声出力する直前）に実行されている。翻訳には Ollama への API コールが伴うため、音声出力を待たされる。音声出力中にネットワーク/GPU リソースは空いているため、この空き時間を活用して次のメッセージの翻訳を先行実行する。

## 実装方針

### 現在のフロー

```
デバウンス完了 → flushText → translateFn(text) → speakFn(translated)
                                ^^^ ここで待機
```

### 改善後のフロー

```
デバウンス完了 → translateFn(text) 開始（並行）→ 順番待ちキュー → speakFn(translated)
                  ↕ 音声出力中に次の翻訳を実行
```

### 主な変更点

1. **順番付き翻訳キュー（`translationQueue`）の導入**（daemon.ts）
   - 翻訳開始時に Promise をキューに追加
   - キューの先頭から順番に翻訳完了を待ち、完了順ではなく追加順で音声出力
   - `isDraining` フラグによる再入防止

2. **`activeFlushes` の置き換え**
   - 既存の `activeFlushes`（Set<Promise>）を `translationQueue` で代替
   - `stop()` と `handleTurnComplete()` はキューの drain を待つ

3. **翻訳前後の debug ログ追加**
   - 翻訳開始時: `translation start: <原文>`
   - 翻訳完了時: `translation done: <原文> -> <翻訳結果>`

4. **`speakTranslated`（AskUserQuestion 用）も同じキューを使用**
   - メッセージの順序を保証

## 完了条件

- [x] 翻訳がデバウンス後すぐに並行開始される
- [x] メッセージの追加順序が音声出力で維持される
- [x] 翻訳前後の debug ログが出力される
- [x] `npm run build` が通る
- [x] `npm run lint` が通る
- [x] `npm test` が通る
- [x] 既存テストが引き続きパスする（220テスト全パス）

## 作業ログ

- daemon.ts の `activeFlushes`（Set<Promise>）を `translationQueue`（順番付き配列）に置き換え
- `enqueueTranslation` / `startDrain` / `doDrain` / `waitForTranslations` メソッドを追加
- `flushText` と `speakTranslated` で翻訳開始を即座に行い、キューに追加する方式に変更
- `handleTurnComplete` と `stop` は `drainPromise` の完了を待つ方式に変更
- 翻訳前後の debug ログ（`translation start:` / `translation done:`）を追加
- ビルド・リント・テスト全パス確認
