# 防御的パースの実装

## 目的

Claude Code バージョンアップ時のフォーマット変更に対し、パーサーが壊れずに動作し続けるよう防御的パースを実装する。

## ゴール

- 未知の content block type が来ても assistant レコードの既知コンテンツ（text, tool_use）は正常に抽出される
- パース失敗時にデバッグ用の警告ログが出力される
- 防御的パースの動作を検証するテストが追加されている

## 実装方針

1. `AssistantContentBlockSchema` を `z.discriminatedUnion` から catch-all 付きの構成に変更
2. `parseLine` にオプショナルな警告コールバックを追加
3. daemon.ts で警告を stderr に出力
4. テスト追加（未知 content type、フィールド欠落シナリオ等）
5. plan.md にチェック追加

## 完了条件

- [x] 未知の content type を含む assistant レコードが正常にパースできる
- [x] パース失敗時に警告ログが出力される
- [x] 防御的パースのテストが追加されている
- [x] `npm run build` が通る
- [x] `npm run lint` が通る
- [x] `npm test` が通る
- [x] plan.md が更新されている

## 作業ログ

- parser.ts: 2層バリデーション方式に変更（レコード層: LooseContentBlockSchema、抽出層: 個別 safeParse）
- parser.ts: ParseOptions（onWarn コールバック）を parseLine/processLines に追加
- parser.ts: ThinkingContentSchema を削除（抽出で使用しないため）、ThinkingContent 型は直接定義に変更
- daemon.ts: processLines に onWarn を接続し、パース警告を stderr に出力
- parser.test.ts: 防御的パースのテスト9件追加（未知 content type、onWarn、content block バリデーション失敗）
- plan.md: Phase 3 の4項目全てにチェック追加
- `npm run build` 成功
- `npm run lint` 成功
- `npm test` 94/94 通過
