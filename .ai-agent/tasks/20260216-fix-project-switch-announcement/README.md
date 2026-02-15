# プロジェクト切り替え時の案内が特定条件下で発生しない

## 目的

プロジェクト切り替え時の音声案内（「プロジェクト X の実行内容を再生します」）が特定条件下で発生しないバグを修正する。（Issue #21）

## ゴール

- プロジェクト切り替え時に毎回案内が再生される
- キューの状態（空/非空）に関わらず案内が正しく動作する
- テストが追加されている
- `npm run build` / `npm run lint` / `npm test` が通る

## 実装方針

1. **テスト駆動で再現確認**: 記載されたシナリオの再現テストを記述
2. **Speaker 層の防御的改善**: null-project メッセージ後のプロジェクト追跡を強化
3. **Daemon 層の確認**: resolveProject → flushText のプロジェクト情報フローを確認・テスト追加
4. **テスト充実**: 既存テストではカバーされていないエッジケースを追加

## 完了条件

- [x] 再現テストが追加されている
- [x] バグが修正されている
- [x] テストが全通過（113テスト全通過）
- [x] `npm run build` が通る
- [x] `npm run lint` が通る
- [x] `npm test` が通る

## 作業ログ

### 根本原因

`daemon.ts` の `this.projectsDir` が `options?.watcher?.projectsDir ?? ""` で空文字列にデフォルトされていた。`cli.ts` では `new Daemon()` を引数なしで呼ぶため、`this.projectsDir` は常に空文字列となり、`resolveProject()` が `!this.projectsDir` → `true` で即座に `null` を返していた。

一方、`TranscriptWatcher` は独自に `path.join(os.homedir(), ".claude", "projects")` をデフォルトに持つため、ファイル監視自体は正しく動作するが、Daemon 側でプロジェクト情報の解決に失敗していた。

### 修正内容

- `watcher.ts`: `DEFAULT_PROJECTS_DIR` 定数をエクスポート
- `daemon.ts`: `this.projectsDir` のデフォルト値を `DEFAULT_PROJECTS_DIR` に変更
- `daemon.test.ts`: `projectsDir` 未指定時のプロジェクト解決テスト、AskUserQuestion のプロジェクト情報テストを追加
- `speaker.test.ts`: プロジェクト切り替えのエッジケーステスト5件を追加（キュー空後の切り替え、連続切り替え、null-project 挟み、復帰、3プロジェクト切り替え）
