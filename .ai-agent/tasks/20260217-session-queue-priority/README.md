# セッション単位の speak キュー優先制御

Issue: https://github.com/mizunashi-mana/cc-voice-reporter/issues/29

## 目的・ゴール

Speaker のキュー優先制御を現在のプロジェクト単位からセッション単位に細分化し、同じプロジェクト内でも同じセッションのメッセージ再生を優先する。

## 背景

現在の Speaker は「同一プロジェクトのメッセージを優先取り出し」する仕組みだが、同一プロジェクト内で複数セッションが同時に動いている場合（例: 複数ターミナルで同じプロジェクトの Claude Code を実行）、異なるセッションのメッセージが混在して再生される。セッション単位で優先制御すれば、文脈の一貫性がより高まる。

## 実装方針

### 1. セッション識別情報の抽出（watcher.ts）

transcript ファイルパスの構造:
```
~/.claude/projects/{project-dir}/{session-uuid}/session.jsonl
~/.claude/projects/{project-dir}/{session-uuid}/subagents/agent-{id}.jsonl
```

ファイルパスからセッションディレクトリ（session-uuid）を抽出する `extractSessionDir()` 関数を追加。

### 2. Speaker の拡張（speaker.ts）

- `QueueItem` に `session: string | null` を追加
- `speak()` に `session?: string` パラメータを追加
- `currentSession: string | null` でアクティブセッションを追跡
- `dequeueNext()` の優先順位を変更:
  1. 同一プロジェクト + 同一セッション
  2. 同一プロジェクト（別セッション）
  3. FIFO（別プロジェクト）
- セッション切り替え時のアナウンスは **不要** とする（プロジェクト切り替えと異なり、セッション切り替えはユーザーに有益な情報が少ないため）

### 3. Daemon の更新（daemon.ts）

- `SpeakFn` インターフェースに `session` パラメータを追加
- `resolveProject()` でセッション情報も合わせて解決し、Speaker に渡す

## 完了条件

- [x] `extractSessionId()` が正しくセッション UUID を抽出する
- [x] Speaker がプロジェクト優先の中でさらにセッション優先でデキューする
- [x] Daemon がファイルパスからセッション情報を Speaker に渡す
- [x] 既存のプロジェクト切り替えアナウンスが壊れない
- [x] 全テストが通る（137 tests passed）
- [x] `npm run build` / `npm run lint` がエラーなし

## 作業ログ

### 2026-02-17

- watcher.ts: `extractSessionId()` 関数を追加
  - メインセッション: `{project-dir}/{session-uuid}.jsonl` → `session-uuid`
  - サブエージェント: `{project-dir}/{session-uuid}/subagents/agent-{id}.jsonl` → `session-uuid`
- speaker.ts: セッション対応キュー優先制御を実装
  - `QueueItem` に `session: string | null` を追加
  - `speak()` に `session?: string` パラメータを追加
  - `currentSession` で直近のセッションを追跡
  - `dequeueNext()` を3段階優先に変更（同一プロジェクト+同一セッション > 同一プロジェクト > FIFO）
- daemon.ts: セッション情報の抽出と Speaker への受け渡しを追加
  - `SpeakFn` に `session` パラメータを追加
  - `requestSession` Map でリクエストごとのセッション情報を管理
  - text, AskUserQuestion, turn_complete 全てでセッション情報を渡す
- テスト: 全モジュールのテストを追加（137 tests passed）
