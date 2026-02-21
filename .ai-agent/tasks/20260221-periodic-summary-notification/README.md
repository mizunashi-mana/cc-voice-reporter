# periodic-summary-notification

## 目的・ゴール

Claude Code の実行状況を一定間隔で要約し、音声で定期通知する機能を追加する（Issue #27）。

個々のメッセージやツール実行を逐次読み上げる既存方式に加え、「今何をしているか」のダイジェストを定期的に音声通知することで、画面を見なくても全体の進捗を把握できるようにする。

## 実装方針

### 新規モジュール: `src/summarizer.ts`

- **ActivityTracker**: Daemon から受け取ったイベント（tool_use, text）を蓄積する
  - tool_use: ツール名 + 入力情報（ファイルパスなど）
  - text: テキスト応答の冒頭部分
- **Ollama ベースの要約生成**: 蓄積されたイベントを Ollama に渡し、自然な日本語の要約文を生成する
  - 既存の `translator.ts` の Ollama 連携パターンを踏襲
  - プロンプト例: 「以下の Claude Code の操作を1文で要約して: Read: src/parser.ts, Edit: src/config.ts, Bash: npm test」
  - 生成例: 「設定ファイルを修正し、関連コードを確認した後、テストを実行しました」
- **定期タイマー**: 設定された間隔で要約を生成し、Speaker に送信する
- イベントが無い期間はスキップ（無音）
- 要約生成に失敗した場合は警告ログのみ（graceful degradation）

### Daemon 連携

- `daemon.ts` の `handleLines` でパースされたメッセージを ActivityTracker にも渡す
- Daemon の start/stop に合わせてタイマーの開始・停止を管理

### 読み上げ（narration）の無効化

- `narration` 設定で逐次読み上げの有効/無効を切り替え可能
- デフォルト動作:
  - `summary.enabled: true` → narration は自動的に **無効**（サマリーのみ通知）
  - `summary.enabled: false` または未設定 → narration は **有効**（従来どおり）
- `narration: true / false` を明示指定すればデフォルトを上書き可能
- narration 無効時も turn_complete（「入力待ちです」）は常に通知される

### 設定

- `config.ts` に `summary` セクションを追加:
  - `summary.enabled`: 有効/無効（デフォルト: false）
  - `summary.intervalMs`: 通知間隔ミリ秒（デフォルト: 60000）
- `narration`: 逐次読み上げの有効/無効（デフォルト: auto）
- **バリデーション**: `summary.enabled: true` かつ `ollama` 設定が無い場合はエラーを投げる

## 完了条件

- [x] `src/summarizer.ts` の実装とユニットテスト
- [x] `src/daemon.ts` への ActivityTracker 連携と narration 制御
- [x] `src/config.ts` への summary / narration 設定追加
- [x] `npm run build` が通る
- [x] `npm run lint` が通る
- [x] `npm test` が通る (277 tests passed)

## 作業ログ

- 2026-02-21: `src/summarizer.ts` 新規作成（Ollama ベースの要約生成、定期タイマー、イベント収集）
- 2026-02-21: `src/config.ts` に summary / narration 設定を追加、バリデーション実装
- 2026-02-21: `src/daemon.ts` に Summarizer 統合、narration 制御を追加
- 2026-02-21: テスト作成（summarizer.test.ts 33件、config.test.ts +12件、daemon.test.ts +3件）
- 2026-02-21: 全テスト通過、ビルド・リント成功
