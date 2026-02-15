# 市場分析

## 市場概要

Claude Code の利用体験を改善する開発者向けツール市場。AI コーディングアシスタントの普及に伴い、実行状況の音声フィードバックや通知に対するニーズが高まっている。

## ターゲットセグメント

- Claude Code を日常的に使用する開発者
- マルチタスクで作業しながら Claude Code の進捗を把握したい開発者
- 画面を離れていても Claude Code の状況を知りたい開発者

## 競合分析

| ツール | 技術 | 特徴 | 課題 |
|--------|------|------|------|
| [mcp-voice-hooks](https://github.com/johnmatthewtennant/mcp-voice-hooks) | TypeScript / MCP サーバー | 双方向音声対話、ブラウザベース STT/TTS、トリガーワードモード | 音声入力がメイン。MCP サーバーとして動作し、セットアップが重い |
| [cc-hooks](https://github.com/husniadil/cc-hooks) | Python + Node.js | 多数の TTS プロバイダ対応（Google TTS / ElevenLabs）、AI コンテキスト付き通知、マルチインスタンス対応 | 依存が多い（Python 3.12+、外部 API）。設定が複雑 |
| [claude-code-notify-mcp](https://github.com/nkyy/claude-code-notify-mcp) | TypeScript / MCP サーバー | デスクトップ通知 + コンテキスト音、自動イベント検出、クロスプラットフォーム | 音声レポートではなく通知音のみ |
| [claude-code-voice-hooks](https://github.com/shanraisshan/claude-code-voice-hooks) | Python / HTML | 全15フックイベント対応、PreToolUse/PostToolUse で効果音 | 効果音中心で音声レポートではない。Python 依存 |

## 差別化ポイント

- **音声レポート特化**: 効果音や通知ではなく、何が起きているかを音声で説明する
- **軽量**: macOS say コマンドのみ使用、外部 API・追加サービス不要
- **シンプルな構成**: Node.js/TypeScript のみ、Python や MCP サーバー不要
- **transcript .jsonl 監視**: Claude の全出力をリアルタイム監視し、MCP サーバーを介さないシンプルなアーキテクチャ

## 市場動向

- AI コーディングアシスタントの急速な普及
- Claude Code のフック・MCP エコシステムの拡大
- 開発者の作業効率化ツールへの関心の高まり
- マルチモーダル（テキスト＋音声）インターフェースへのトレンド
