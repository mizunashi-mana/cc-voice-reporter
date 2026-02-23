# improve-summary-prompt-structure

## 目的・ゴール

要約用プロンプトの構造を改善し、LLM がプロンプトの各セクションをより正確に解析できるようにする（Issue #106）。

## 実装方針

### 1. Previous narration の統合

**現状**: older と recent が2行に分かれている
```
Previous narration (older): ...
Previous narration (recent): ...
```

**改善後**: 1行に結合
```
Previous narration: {older} {recent}
```

### 2. アクティビティの区切り改善

**現状**: 番号付きリストで連続
```
Recent actions:
1. Read: /src/app.ts
2. Edit: /src/config.ts
3. Text output: テストを実行します
```

**改善後**: 各アクティビティ間に `---` 区切りを入れる
```
Recent actions:
---
1. Read: /src/app.ts
---
2. Edit: /src/config.ts
---
3. Text output: テストを実行します
```

## 変更対象ファイル

- `packages/cc-voice-reporter/src/monitor/summarizer.ts` — `buildPrompt` 関数の修正
- `packages/cc-voice-reporter/src/monitor/summarizer.test.ts` — テストの更新

## 完了条件

- [x] `buildPrompt` で Previous narration が1行に統合される
- [x] `buildPrompt` でアクティビティ間に区切りが入る
- [x] 既存テストが更新され、すべてパスする
- [x] `npm run build` が成功する
- [x] `npm run lint` が成功する
- [x] `npm test` が成功する

## 作業ログ

- `buildPrompt` の Previous narration 部分を `join(' ')` で1行に統合
- 各アクティビティの前に `---` セパレータを追加
- テスト 6 件を新フォーマットに合わせて更新、全 342 テストパス
