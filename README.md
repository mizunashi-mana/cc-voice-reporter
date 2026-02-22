# cc-voice-reporter

[![CI Lint](https://github.com/mizunashi-mana/cc-voice-reporter/actions/workflows/ci-lint.yml/badge.svg)](https://github.com/mizunashi-mana/cc-voice-reporter/actions/workflows/ci-lint.yml)
[![CI Test](https://github.com/mizunashi-mana/cc-voice-reporter/actions/workflows/ci-test.yml/badge.svg)](https://github.com/mizunashi-mana/cc-voice-reporter/actions/workflows/ci-test.yml)

Real-time voice reporting for Claude Code — hear what Claude is doing without watching the screen.

cc-voice-reporter runs as a background daemon that monitors Claude Code's transcript files and speaks out what's happening: when Claude finishes a task, when it needs your confirmation, and periodic summaries of its activity. You can step away from your desk and still know exactly what Claude is up to.

> **Status**: Under active development.

## When is this useful?

- **Multitasking** — You're working on something else while Claude runs a long task. Voice notifications tell you when it's done or needs input.
- **Hands-free monitoring** — You want to follow Claude's progress without constantly switching windows.
- **Quick reaction to prompts** — Claude asks a confirmation question; you hear it immediately instead of discovering it minutes later.

## Quick Start

```bash
# 1. Clone and build
git clone https://github.com/mizunashi-mana/cc-voice-reporter.git
cd cc-voice-reporter
npm install
npm run build

# 2. Make the command available globally
npm link -w packages/cc-voice-reporter

# 3. Make sure Ollama is running (required for summaries)
ollama pull gemma3

# 4. Start the daemon
cc-voice-reporter monitor
```

That's it. Open Claude Code in another terminal and start a session — you'll hear voice notifications as Claude works.

## Features

- **Turn-complete notification** — "入力待ちです" when Claude finishes and awaits input
- **AskUserQuestion readout** — Reads aloud confirmation prompts so you know when Claude needs your attention
- **Periodic summary** (optional) — Ollama generates a natural-language digest of recent operations at a configurable interval
- **Customizable speech command** — Use any TTS engine (`say`, `espeak`, VOICEVOX, etc.) via `speaker.command`
- **Multi-project support** — Project-switch announcements, per-project/session queue priority
- **Project filtering** — Include/exclude patterns to watch only specific projects

## Requirements

- Node.js v22+
- A TTS command (defaults to macOS `say`; configurable for Linux `espeak`, etc.)
- [Ollama](https://ollama.com/) (required — used for periodic activity summaries)

### Recommended Ollama models

| Model | Size | Summary quality | Speed | Notes |
|-------|------|:---------------:|:-----:|-------|
| **gemma3** | 4B | Excellent | 4–15 s | Best overall quality and speed. Recommended. |
| **gemma3:1b** | 1B | Good | 2–6 s | Fastest option. |
| **llama3.2** | 3B | Good | 3–30 s | Acceptable alternative. |

> **Tip**: For the best experience, use **gemma3**. Install it with `ollama pull gemma3`.

## Installation

> **Note**: Not yet published to npm. Use the "build from source" method below.

```bash
git clone https://github.com/mizunashi-mana/cc-voice-reporter.git
cd cc-voice-reporter
npm install
npm run build
npm link -w packages/cc-voice-reporter
```

## Usage

```bash
# Start the daemon
cc-voice-reporter monitor

# Watch only specific projects
cc-voice-reporter monitor --include my-project --exclude scratch

# Use a custom config file
cc-voice-reporter monitor --config /path/to/config.json

# Initialize a config file
cc-voice-reporter config init

# Show config file path
cc-voice-reporter config path

# Manage tracked projects
cc-voice-reporter tracking list
cc-voice-reporter tracking add /path/to/project
cc-voice-reporter tracking remove /path/to/project
```

### Commands

| Command | Description |
|---------|-------------|
| `monitor` | Start the voice reporter daemon |
| `config` | Manage configuration file (`init`, `path`) |
| `tracking` | Manage tracked projects (`add`, `remove`, `list`) |

### Monitor Options

| Option | Description |
|--------|-------------|
| `--include <pattern>` | Only watch projects matching the pattern (repeatable) |
| `--exclude <pattern>` | Exclude projects matching the pattern (repeatable) |
| `--config <path>` | Path to config file |

## Configuration

Place a config file at `~/.config/cc-voice-reporter/config.json` (follows [XDG Base Directory](https://specifications.freedesktop.org/basedir-spec/latest/) spec). All fields are optional.

### Minimal example

```json
{}
```

With no configuration, the daemon announces turn completion and confirmation prompts using macOS `say`.

### Full example

```json
{
  "logLevel": "info",
  "language": "ja",
  "filter": {
    "include": ["my-project"],
    "exclude": ["scratch"]
  },
  "speaker": {
    "command": ["say", "-v", "Kyoko"],
    "maxLength": 200,
    "truncationSeparator": "、中略、"
  },
  "ollama": {
    "model": "gemma3",
    "baseUrl": "http://localhost:11434",
    "timeoutMs": 60000
  },
  "summary": {
    "intervalMs": 5000
  }
}
```

### Options reference

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `logLevel` | `"debug" \| "info" \| "warn" \| "error"` | `"info"` | Log verbosity |
| `language` | `string` | `"en"` | Output language code (used by voice messages and summary) |
| `projectsDir` | `string` | `~/.claude/projects` | Directory to watch for transcript files |
| `filter.include` | `string[]` | — | Only watch projects matching these patterns |
| `filter.exclude` | `string[]` | — | Exclude projects matching these patterns |
| `speaker.command` | `string[]` | `["say"]` | Speech command and fixed arguments. Message is appended as the last argument |
| `speaker.maxLength` | `number` | *(no limit)* | Max characters before middle-truncation |
| `speaker.truncationSeparator` | `string` | `"、中略、"` | Separator inserted when truncating |
| `ollama.model` | `string` | *(required if ollama used)* | Ollama model name (e.g., `"gemma3"`) |
| `ollama.baseUrl` | `string` | `"http://localhost:11434"` | Ollama API URL |
| `ollama.timeoutMs` | `number` | `60000` | Ollama request timeout (ms) |
| `summary.intervalMs` | `number` | `5000` | Summary interval (ms) |

> **Note**: Ollama is required for operation. The daemon validates Ollama connectivity at startup and will fail if unavailable.

## Development

```bash
# Using devenv (requires Nix)
devenv shell

# Build
npm run build

# Lint
npm run lint

# Test
npm test
```

## License

This project is dual-licensed under your choice of either:

- [Apache License, Version 2.0](LICENSE.Apache-2.0.txt)
- [Mozilla Public License, Version 2.0](LICENSE.MPL-2.0.txt)

See [LICENSE](LICENSE) for details.
