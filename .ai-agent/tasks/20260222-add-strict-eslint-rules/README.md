# eslint-config-love と picstash の厳格な ESLint ルールを追加導入する

Issue: https://github.com/mizunashi-mana/cc-voice-reporter/issues/72

## 目的・ゴール

eslint-config-love と picstash (@picstash/eslint-config) のルールセットを参照し、現在の `@cc-voice-reporter/eslint-config` に不足しているルールを追加導入する。

## 実装方針

### 追加する Core JS ルール

- `no-useless-assignment` — 使われない代入を検出
- `no-useless-concat` — 不要な文字列結合
- `no-useless-return` — 関数末尾の不要な return
- `no-promise-executor-return` — Promise executor での return 禁止
- `no-lonely-if` — `else { if }` → `else if`
- `no-multi-assign` — 多重代入禁止
- `no-script-url` — `javascript:` URL 禁止
- `no-plusplus` — `++`/`--` 禁止
- `operator-assignment` — `x = x + y` → `x += y`
- `prefer-arrow-callback` — コールバックにアロー関数
- `prefer-exponentiation-operator` — `**` 演算子推奨
- `prefer-numeric-literals` — 数値リテラル推奨
- `prefer-object-has-own` — `Object.hasOwn()` 推奨
- `prefer-object-spread` — スプレッド構文推奨
- `prefer-template` — テンプレートリテラル推奨
- `logical-assignment-operators` — `??=`, `||=`, `&&=` 推奨
- `radix` — `parseInt` に基数強制

### 追加する TypeScript ルール

- `@typescript-eslint/no-unnecessary-parameter-property-assignment`
- `@typescript-eslint/no-unnecessary-qualifier`
- `@typescript-eslint/no-unnecessary-type-arguments`
- `@typescript-eslint/no-useless-default-assignment`
- `@typescript-eslint/no-import-type-side-effects`

### 追加する Promise ルール

- `promise/no-multiple-resolved`

### 設定値の更新

- `@typescript-eslint/switch-exhaustiveness-check` — オプション追加
- `@typescript-eslint/triple-slash-reference` — オプション追加
- `@typescript-eslint/unified-signatures` — オプション追加

## 完了条件

- [x] ルールを eslint-config パッケージに追加
- [x] snapshot テストを更新
- [x] プロジェクト全体で lint エラーを修正
- [x] `npm run build` が通る
- [x] `npm run lint` が通る
- [x] `npm test` が通る

## 作業ログ

- 2026-02-22: タスク開始、差分調査完了
- 2026-02-22: ルール追加・lint エラー修正・全テストパス完了
