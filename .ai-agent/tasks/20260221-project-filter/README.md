# 監視対象プロジェクトフィルタリング機能

## タスク情報

- **Issue**: https://github.com/mizunashi-mana/cc-voice-reporter/issues/30
- **ブランチ**: `project-filter`
- **開始日**: 2026-02-21

## 目的

特定のプロジェクトのみを監視対象にする（または除外する）フィルタリング機能を追加する。

## 背景

現在の TranscriptWatcher は `~/.claude/projects/` 配下の全 `.jsonl` ファイルを監視するため、関心のないプロジェクトのメッセージも音声再生されてしまう。複数プロジェクトで Claude Code を使用する場合、特定のプロジェクトだけを監視対象にしたいケースがある。

## チーム構成

```
lead
├── researcher      (Explore, sonnet)  ... プロジェクトパスのエンコーディング調査、フィルタリング UX 設計
├── architect       (general-purpose, opus, plan)  ... フィルタリング機能の設計・方針策定
├── implementer     (general-purpose, sonnet)  ... watcher + CLI + テストの実装
└── reviewer        (general-purpose, opus)  ... コードレビュー
```

- パターン: Sequential Handoff（researcher → architect → implementer → reviewer）
- Review Loop（implementer ↔ reviewer）

## 影響範囲

- `src/watcher.ts` — フィルタリングロジック追加、`WatcherOptions` 拡張
- `src/cli.ts` — CLI 引数パース追加
- `src/daemon.ts` — `DaemonOptions` 経由で設定を渡す
- テストファイル — 新機能のテスト追加

## 完了条件

- [ ] CLI オプションで監視対象プロジェクトを指定できる
- [ ] include/exclude のフィルタリングが動作する
- [ ] プロジェクトパスまたはプロジェクト名でフィルタ指定できる
- [ ] 既存のテストが通る
- [ ] 新機能のテストが追加されている
- [ ] `npm run build` でコンパイルエラーがない
- [ ] `npm run lint` でリンターエラーがない
- [ ] `npm test` でテストが通る
