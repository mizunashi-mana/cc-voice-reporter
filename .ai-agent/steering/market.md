# 市場分析

最終更新: 2026-02-22

## 市場概要

Claude Code の利用体験を改善する開発者向けツール市場。AI コーディングアシスタントの普及に伴い、実行状況の音声フィードバックや通知に対するニーズが高まっている。2025年後半から2026年にかけて市場は急速に拡大し、10以上のツールが登場。Claude Code のフック API の成熟（17種のイベント対応、Plugin/Prompt/Agent フック等）がエコシステムの成長を後押ししている。

## ターゲットセグメント

- Claude Code を日常的に使用する開発者
- マルチタスクで作業しながら Claude Code の進捗を把握したい開発者
- 画面を離れていても Claude Code の状況を知りたい開発者

## 競合分析

### カテゴリ A: 音声レポート型（AI 要約 + TTS）

状況を言葉で要約して読み上げるツール。cc-voice-reporter と最も直接的に競合。

| ツール | 技術 | Stars | 特徴 | 課題 |
|--------|------|-------|------|------|
| [cc-hooks](https://github.com/husniadil/cc-hooks) | Python (uv) | 14 | 多数の TTS プロバイダ（Google TTS / ElevenLabs / プリレコード）、AI コンテキスト付き通知、マルチインスタンス対応、ステータスライン統合、Plugin / Standalone 2モード | 依存が多い（Python 3.12+、外部 API）。設定が複雑 |
| [clarvis](https://github.com/nickpending/clarvis) | TypeScript (Bun) | 5 | JARVIS 風音声通知、LLM（OpenAI/Ollama）で応答を1-3文に要約、verbosity モード（terse/brief/normal/full）、lspeak 連携 | Alpha 段階。初回起動に27秒遅延。複数依存（Bun, lspeak, OpenAI API） |
| [claude-code-voice-handler](https://github.com/markhilton/claude-code-voice-handler) | Node.js | — | OpenAI TTS、GPT-4o-mini でテキスト圧縮、パーソナリティモード | クラウド API 必須（OpenAI） |

### カテゴリ B: 効果音型（コンテキスト音効果）

ツール実行やイベントに応じた効果音を再生するツール。

| ツール | 技術 | Stars | 特徴 | 課題 |
|--------|------|-------|------|------|
| [claudio](https://github.com/ctoth/claudio) | Go | 55 | コマンド認識（git, npm, docker 等）でコンテキスト別音効果、カスタム Soundpack、クロスプラットフォーム、プリロードで低遅延 | 音声レポートではなく効果音のみ |
| [claude-code-voice-hooks](https://github.com/shanraisshan/claude-code-voice-hooks) | Python / HTML | 45 | 全18フックイベント対応、PreToolUse/PostToolUse で効果音、カスタムサウンド | 効果音中心で音声レポートではない。Python 依存 |
| [claude-code-audio-hooks](https://github.com/ChanMeng666/claude-code-audio-hooks) | Node.js | 20 | ElevenLabs 音声 + UI サウンドの2セット（各14音）、14フック個別トグル、30秒セットアップ | プリレコード音声のみ、動的な音声生成なし |

### カテゴリ C: 通知型（デスクトップ通知 + 通知音）

タスク完了や入力待ちをデスクトップ通知で知らせるツール。

| ツール | 技術 | Stars | 特徴 | 課題 |
|--------|------|-------|------|------|
| [claude-code-notification](https://github.com/wyattjoh/claude-code-notification) | Rust | — | 高性能 Rust CLI、クロスプラットフォーム通知、Homebrew 配布 | 通知のみ、音声レポートなし |
| [CCNotify](https://github.com/dazuiba/CCNotify) | — | — | デスクトップ通知、VS Code 自動ジャンプ、経過時間表示 | macOS のみ |
| [ccnudge](https://github.com/RonitSachdev/ccnudge) | CLI | — | 全フックイベント対応、イベント別カスタム音、デスクトップ通知 | 音声レポートではない |
| [homebrew-claude-sounds](https://github.com/daveschumaker/homebrew-claude-sounds) | CLI | — | ランダム効果音再生、シンプル | 最小限の機能 |
| ~~[claude-code-notify-mcp](https://github.com/nkyy/claude-code-notify-mcp)~~ | ~~TypeScript / MCP~~ | — | ~~デスクトップ通知 + コンテキスト音~~ | **非推奨**: `cat-ccnotify-hook` に移行済み |

### カテゴリ D: 双方向音声型（音声入力 + 音声出力）

音声で指示を出し、音声で結果を受け取る双方向ツール。

| ツール | 技術 | Stars | 特徴 | 課題 |
|--------|------|-------|------|------|
| [voicemode](https://github.com/mbailey/voicemode) | Python | 770 | 双方向音声会話、Whisper STT + Kokoro TTS、Operator モード（自律実行）、Plugin 対応、wake word | 最大の競合。ただし音声入力がメインで、レポート機能は副次的 |
| [mcp-voice-hooks](https://github.com/johnmatthewtennant/mcp-voice-hooks) | TypeScript / MCP | — | 双方向音声対話、ブラウザベース STT/TTS、トリガーワードモード | ⚠️ リポジトリ非公開化の可能性あり（2026-02 時点でアクセス不可） |
| [claude-voice](https://github.com/jvosloo/claude-voice) | Python | 1 | Push-to-talk 入力、Whisper STT + Kokoro TTS、AFK モード（Telegram 連携）、多言語切り替え | macOS のみ。小規模プロジェクト |

## 差別化ポイント

- **音声レポート特化**: 効果音や通知ではなく、何が起きているかを音声で説明する。カテゴリ A の直接競合は少数
- **ローカル完結**: 設定可能な TTS コマンド（デフォルト: macOS say）+ Ollama でクラウド API 不要
- **シンプルな構成**: Node.js/TypeScript + Ollama のみ、Python や MCP サーバー不要
- **transcript .jsonl 監視**: Claude の全出力をリアルタイム監視し、フック API に依存しない独立したアーキテクチャ（フック API の変更に影響されにくい）
- **マルチプロジェクト対応**: 複数プロジェクトの監視・切り替え案内は競合にない機能

### 差別化の注意点

- voicemode（Stars 770）が市場リーダーとして台頭。ただし音声入力がメインユースケースであり、レポート機能では直接競合しない
- claudio（Stars 55）が効果音カテゴリで存在感。Go 製で高性能
- 「ローカル完結」は依然として差別化要因だが、Kokoro TTS（ローカル高品質 TTS）の普及により、他ツールもローカル TTS を採用し始めている

## 市場動向

### エコシステムの成熟

- Claude Code フック API が17種のイベントに拡大（SessionStart, UserPromptSubmit, PreToolUse, PermissionRequest, PostToolUse, PostToolUseFailure, Notification, SubagentStart, SubagentStop, Stop, TeammateIdle, TaskCompleted, ConfigChange, WorktreeCreate, WorktreeRemove, PreCompact, SessionEnd）
- **Prompt / Agent フック**: シェルコマンドだけでなく、LLM プロンプトやサブエージェントをフックとして実行可能に
- **Plugin システム**: `hooks/hooks.json` でフックをプラグインとしてバンドル・配布可能に
- **Skill / Agent frontmatter**: スキルやサブエージェント内でライフサイクルスコープ付きフックを定義可能

### ツールカテゴリの分化

- **効果音型**が最も多い（参入障壁が低い）
- **音声レポート型**は AI 要約が必要なため競合が少ない（cc-voice-reporter の差別化領域）
- **双方向音声型**は voicemode が独走。音声入力 + TTS 出力の統合体験
- **通知型**は成熟段階。Rust 製高性能ツールなど品質が向上

### 技術トレンド

- **Kokoro TTS** の普及: オープンソースのローカル高品質 TTS として複数ツールが採用
- **Whisper STT** との組み合わせ: 音声入力 + 音声出力の双方向化が進行
- マルチモーダル（テキスト＋音声）インターフェースへのトレンド継続
- AI コーディングアシスタントの急速な普及に伴うエコシステム拡大
