# 多言語対応（i18n）

## 目的・ゴール

音声メッセージを日本語・英語の両方で利用可能にする。ユーザーが設定ファイルの `language` フィールドで言語を切り替えられるようにする。

## 背景

現状、音声メッセージ（daemon/speaker）は日本語でハードコードされている。i18n 基盤がないため、言語の切り替えができない。

## 対象範囲

音声メッセージ（monitor パッケージ）のみ。CLI メッセージは対象外。

- `daemon.ts`: 「入力待ちです」「確認待ち: {質問}」
- `speaker.ts`: 「、中略、」「プロジェクト{name}の実行内容を再生します」

## 実装方針

- 外部 i18n ライブラリは使用せず、軽量な自作メッセージカタログ `messages.ts` を実装
- 既存の `language` config フィールドを拡張して音声メッセージにも適用
- デフォルト言語: `en`

## 完了条件

- [x] メッセージカタログの実装（ja/en）
- [x] config の `language` フィールドで言語切り替え可能
- [x] 既存テストの維持（全パス）
- [x] 新規テストの追加（messages, daemon language, speaker announcement）
- [x] ビルド・リント・テスト通過

## 作業ログ

- messages.ts: `Messages` インターフェースと ja/en ロケール、`getMessages()` 関数を実装
- daemon.ts: `DaemonOptions` に `language` フィールドを追加、ハードコード文字列を `messages` 経由に変更
- speaker.ts: `SpeakerOptions` に `projectSwitchAnnouncement` を追加、ハードコード文字列をカスタマイズ可能に
- config.ts: `resolveOptions` で `language` を `DaemonOptions` に渡すように変更
- index.ts: `getMessages`, `Messages` をエクスポートに追加
- テスト: messages.test.ts（10件）、daemon.test.ts（+3件）、speaker.test.ts（+1件）を追加
