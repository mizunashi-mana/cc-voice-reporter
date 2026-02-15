# プロジェクト切り替え時の案内と再生優先

## 目的

監視対象のプロジェクトが切り替わった時にプロジェクト名を音声で案内し、既存キューの消化を優先する。（Issue #17）

## ゴール

- 異なるプロジェクトの transcript からメッセージが来た時、プロジェクト名を音声で案内する
- Speaker キューから同一プロジェクトのメッセージを優先的に取り出す
- プロジェクト変更時はアナウンスを先に再生してからメッセージを再生する
- ファイルパスからプロジェクト名を抽出するユーティリティが提供される

## 実装方針

1. **プロジェクト名抽出**（watcher.ts）: ファイルパスからプロジェクトディレクトリを抽出し、エンコードされたパスをファイルシステムで照合して人間が読めるプロジェクト名に変換
2. **Speaker のプロジェクト対応**（speaker.ts）: キューアイテムにプロジェクト情報をタグ付け。取り出し時に同一プロジェクト優先。プロジェクト変更時はアナウンスを先に再生
3. **Daemon のプロジェクト情報伝達**（daemon.ts）: filePath からプロジェクト情報を抽出し、Speaker に渡す。プロジェクト追跡や遅延バッファは不要（Speaker が担当）
4. **テスト追加**: プロジェクト名抽出、Speaker の優先取り出し・アナウンス、Daemon のプロジェクト情報伝達

## 完了条件

- [x] `extractProjectDir` がファイルパスからプロジェクトディレクトリを正しく抽出する
- [x] `resolveProjectDisplayName` がエンコードされたディレクトリ名を人間が読めるプロジェクト名に変換する
- [x] Speaker が同一プロジェクトのメッセージを優先的に取り出す
- [x] プロジェクト切り替え時に「プロジェクト: {name}」が先に再生される
- [x] テストが追加されている
- [x] `npm run build` が通る
- [x] `npm run lint` が通る
- [x] `npm test` が通る（102テスト全通過）

## 作業ログ

- watcher.ts: `extractProjectDir` と `resolveProjectDisplayName` を追加
- speaker.ts: `ProjectInfo` インターフェース追加、キューを `QueueItem[]` に変更、`dequeueNext` で同一プロジェクト優先取り出し、プロジェクト変更時のアナウンス再生
- daemon.ts: `SpeakFn` に `ProjectInfo` パラメータ追加、`requestProject` マップで requestId ごとのプロジェクト情報を追跡、`flushText` で Speaker にプロジェクト情報を伝達
- watcher.test.ts: `extractProjectDir` テスト4件、`resolveProjectDisplayName` テスト6件追加
- speaker.test.ts: プロジェクト対応キューのテスト7件追加
- daemon.test.ts: プロジェクト情報伝達のテスト3件追加
- structure.md: モジュール説明を更新
