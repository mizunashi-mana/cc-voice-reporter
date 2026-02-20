# Ollama による翻訳機能の追加

Issue: https://github.com/mizunashi-mana/cc-voice-reporter/issues/35

## 目的・ゴール

Claude の応答テキストを、Ollama を使ってローカルで出力言語に翻訳してから読み上げる。
Ollama の設定がある場合のみ翻訳を有効化し、モデル名も指定可能にする。

## 検討した選択肢

### 翻訳バックエンド

| 方式 | npm依存サイズ | モデルサイズ | EN→JA品質 | 速度 | 特徴 |
|------|-------------|------------|----------|------|------|
| **Ollama** (採用) | 追加なし (fetch使用) | 3-5 GB | 高（LLM） | ~1-3s | ローカルサービス。npm側は軽い |
| node-llama-cpp | ~670 MB | 3-5 GB | 高（LLM） | ~1-3s | 完全埋め込みだがパッケージ巨大 |
| @huggingface/transformers | ~270 MB | 30-45 MB | 低〜中 | ~100-500ms | 軽量だが OPUS-MT 2020年モデルで品質低い |
| OpenAI互換API | 追加なし | - | 高 | ~1-3s | クラウド依存 |

**Ollama を採用した理由**: npm 依存追加なし（Node.js 組み込み fetch で直接呼び出し）、品質が高い、ローカル完結、開発者向けツールなのでユーザーが自分で管理するのが自然。

### 設定スキーマ

当初は `translation.ollama.*` にモデル設定を含める案だったが、Ollama を将来サマライズ等にも使用する可能性があるため、`ollama` をトップレベルの共有設定として分離し、`translation.use` で参照する方式に変更。

## 実装方針

### 設定スキーマ

`config.ts` の `ConfigSchema` に `ollama` と `translation` セクションを追加:

```json
{
  "ollama": {
    "model": "gemma3",
    "baseUrl": "http://localhost:11434"
  },
  "translation": {
    "use": "ollama",
    "outputLanguage": "ja"
  }
}
```

- `ollama` — トップレベルの Ollama 設定（将来の機能でも共有可能）
  - `model` — 使用するモデル名（必須）
  - `baseUrl` — Ollama API のベース URL（オプション、デフォルト: `http://localhost:11434`）
- `translation` — 翻訳設定（オプション。設定がなければ翻訳なし）
  - `use` — 翻訳バックエンド（現在は `"ollama"` のみ）
  - `outputLanguage` — 出力言語（必須）
- `translation.use === "ollama"` かつ `ollama` 設定がある場合のみ翻訳が有効化

### 新規モジュール: `src/translator.ts`

- Node.js 組み込みの `fetch` で Ollama の `/api/chat` エンドポイントを直接呼び出し（npm依存追加なし）
- システムプロンプトで翻訳指示（言語検出、コード要素の保持）
- 翻訳失敗時は原文をそのまま返す（graceful degradation）
- `Translator` クラスとして実装、`onWarn` コールバックでログ出力

### Daemon への統合

- `DaemonOptions` に `translation` と `translateFn`（テスト用）を追加
- `flushText` で speak する前に翻訳を挟む（非同期）
- `AskUserQuestion` の質問テキストも翻訳対象
- 「入力待ちです」などの固定文言は翻訳不要
- `handleTurnComplete` で翻訳完了を待ってから通知を発話（順序保証）
- `activeFlushes` で進行中の翻訳 Promise を追跡、`stop()` 時に全完了を待機

## 完了条件

- [x] `config.ts` に `ollama` / `translation` スキーマ追加
- [x] `config.test.ts` に設定スキーマ・resolveOptions テスト追加
- [x] `src/translator.ts` 新規作成（Ollama fetch + graceful degradation）
- [x] `src/translator.test.ts` テスト（8テスト）
- [x] `daemon.ts` に翻訳統合（translateFn, activeFlushes, speakTranslated）
- [x] `daemon.test.ts` に翻訳関連テスト追加（7テスト）
- [x] `npm run build` 成功
- [x] `npm run lint` 成功
- [x] `npm test` 成功（205テスト全通過）

## 作業ログ

- 2026-02-21: Issue #35 の内容確認、翻訳バックエンドの選択肢を調査
- 2026-02-21: Ollama 方式を採用、設定スキーマを検討
- 2026-02-21: ユーザーフィードバックにより設定構造を変更（ollama をトップレベルに分離）
- 2026-02-21: translator.ts, config.ts, daemon.ts の実装とテスト完了
- 2026-02-21: build / lint / test 全通過を確認
