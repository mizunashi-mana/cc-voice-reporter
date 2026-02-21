# 市場分析

## 市場概要

Claude Code の利用体験を改善する開発者向けツール市場。Claude Code は $1B+ ARR に到達し、開発者の 85% が AI コーディングツールを日常的に利用する 2026 年現在、実行状況の音声フィードバックへのニーズは確実に拡大している。

Claude Code のフック機能（13 イベント + async: true 対応）の成熟により、音声通知・TTS ツールのエコシステムが急速に発展。hooks 方式を採用するツールが多数登場する一方、当プロジェクトは transcript .jsonl 監視 + Ollama 要約という独自のアプローチで差別化を図る。

## ターゲットセグメント

- Claude Code を日常的に使用する開発者
- マルチタスクで作業しながら Claude Code の進捗を把握したい開発者
- 画面を離れていても Claude Code の状況を知りたい開発者
- 外部 API に依存せず、ローカル完結の音声フィードバックを求める開発者

## 競合分析

### 音声対話型（双方向：音声入力 + 音声出力）

| ツール | Stars | 技術 | 特徴 | 課題 |
|--------|-------|------|------|------|
| [voicemode](https://github.com/mbailey/voicemode) | 761 | Python / MCP | Whisper STT + Kokoro TTS、operator mode でヘッドレス実行、ローカル動作可、v8.2.1 | 音声入力がメイン。MCP サーバーとして動作。Python 依存 |
| [mcp-voice-hooks](https://github.com/johnmatthewtennant/mcp-voice-hooks) | 91 | TypeScript / MCP | ブラウザベース Web Speech API、双方向音声対話、トリガーワードモード | ブラウザ必須。MCP サーバーとしてセットアップが重い |
| [claude-voice](https://github.com/jvosloo/claude-voice) | 1 | Python | Push-to-talk + Narrate mode、Kokoro TTS（54 voices）、daemon アーキテクチャ、AFK mode（Telegram 経由） | macOS 専用。Python 3.12+ 依存。初期段階 |

### 音声通知型（一方向 TTS：Claude の出力を音声で通知）

| ツール | Stars | 技術 | 特徴 | 課題 |
|--------|-------|------|------|------|
| [AgentVibes](https://github.com/paulpreibisch/AgentVibes) | 116 | Node.js / MCP | Piper TTS 914 voices、19 パーソナリティ、BGM 機能、Voice Browser、リモートオーディオストリーミング | 機能過多で複雑。npm パッケージとして配布 |
| [cc-hooks](https://github.com/husniadil/cc-hooks) | 14 | Python + Node.js | 多数 TTS プロバイダ（Google TTS / ElevenLabs）、AI コンテキスト付き通知（OpenRouter）、マルチインスタンス対応 | 依存が多い（Python 3.12+、外部 API）。設定が複雑 |
| [claude-code-voice-notifications](https://github.com/ZeldOcarina/claude-code-voice-notifications) | 9 | TypeScript | ElevenLabs TTS、Flash v2.5 で ~75ms レイテンシ、フォールバック対応 | ElevenLabs API キーが必要。外部 API 依存 |
| [claude-code-tts (ybouhjira)](https://github.com/ybouhjira/claude-code-tts) | 5 | Go / MCP | OpenAI TTS API、6 voices、Worker pool、自動読み上げ | OpenAI API キー + 課金（~$0.015/1K chars）が必要 |
| [claude-code-tts (~cg)](https://git.sr.ht/~cg/claude-code-tts) | - | Shell | Kokoro TTS、async hook 対応、CLAUDE.md に要約指示を自動追加 | Kokoro TTS のインストールが必要 |

### 効果音・通知型（音声レポートではなくサウンド通知）

| ツール | Stars | 技術 | 特徴 | 課題 |
|--------|-------|------|------|------|
| [claude-code-voice-hooks](https://github.com/shanraisshan/claude-code-voice-hooks) | 44 | Python / HTML | 全 18 フックイベント対応、PreToolUse/PostToolUse で効果音 | 効果音中心で音声レポートではない。Python 依存 |
| [claude-code-audio-hooks](https://github.com/ChanMeng666/claude-code-audio-hooks) | 20 | Python | 14 hooks、デスクトップ通知 + TTS、テーマ切替、クロスプラットフォーム、v4.3.1 | 効果音とデスクトップ通知が中心 |
| ~~[claude-code-notify-mcp](https://github.com/nkyy/claude-code-notify-mcp)~~ | 3 | TypeScript / MCP | デスクトップ通知 + コンテキスト音 | **deprecated**（後継: cat-ccnotify-hook） |

## アプローチ比較

### hooks 方式（競合の大多数）

Claude Code の公式フック機能（Stop, Notification, PostToolUse 等）でイベントを受信し、TTS コマンドを実行する方式。

- **利点**: 公式サポート、async: true で非ブロッキング実行、セットアップが比較的簡単
- **制約**: フックイベントに依存するため、取得できる情報はイベントペイロードに限定。Claude の応答全文を自由に処理しにくい

### transcript .jsonl 監視方式（当プロジェクト）

Claude Code の transcript .jsonl ファイルを常駐デーモンで監視し、全出力をリアルタイムに処理する方式。

- **利点**: Claude の全応答・ツール実行をリアルタイムに取得可能。複数イベントを蓄積して Ollama で要約できる。フック機能の制約に縛られない
- **制約**: .jsonl のフォーマット変更リスク。ファイル監視のオーバーヘッド

## 差別化ポイント

- **AI 要約による音声レポート**: Ollama で複数の操作を蓄積・要約し、「何が起きているか」を自然言語で説明。単発のイベント通知ではなく、文脈を持った音声レポートを提供（競合にない独自機能）
- **transcript .jsonl 監視**: hooks 方式と異なり、Claude の全出力をリアルタイムに取得・処理。フックイベントに限定されない柔軟性
- **ローカル完結**: 設定可能な TTS コマンド（デフォルト: macOS say）+ Ollama で外部クラウド API 不要。ElevenLabs / OpenAI 等の API キーや課金が不要
- **マルチプロジェクト対応**: 複数プロジェクトの同時監視、プロジェクト切り替え案内、同一セッション優先キューによる文脈の一貫性維持
- **シンプルな構成**: Node.js/TypeScript のみ。Python や MCP サーバーが不要

## 市場動向

- **Claude Code エコシステムの急拡大**: $1B+ ARR に到達。開発者の 85% が AI コーディングツールを日常利用。Microsoft 含む Fortune 100 の 70% が Claude を利用
- **hooks エコシステムの成熟**: 13 イベント + async: true（2026 年 1 月）で非ブロッキング実行が可能に。音声通知ツールの参入障壁が低下
- **ローカル TTS の台頭**: Kokoro TTS、Piper TTS など無料・ローカル完結の TTS エンジンが普及。クラウド API 不要の選択肢が増加
- **音声対話への進化**: 単純な通知から、双方向音声対話（voicemode: 761 stars）やパーソナリティ付き読み上げ（AgentVibes: 116 stars）へ。ユーザーの期待値が上昇
- **マルチエージェント時代**: Claude Code の Agent Teams 機能でサブエージェントが一般化。複数エージェントの状況を把握するニーズが拡大
- **AI による要約・コンテキスト理解**: 単純な TTS ではなく、AI で内容を理解・要約して通知する方向へ（cc-hooks の OpenRouter 連携、当プロジェクトの Ollama 要約）
