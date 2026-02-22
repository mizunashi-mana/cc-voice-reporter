# cc-voice-reporter

[![CI Lint](https://github.com/mizunashi-mana/cc-voice-reporter/actions/workflows/ci-lint.yml/badge.svg)](https://github.com/mizunashi-mana/cc-voice-reporter/actions/workflows/ci-lint.yml)
[![CI Test](https://github.com/mizunashi-mana/cc-voice-reporter/actions/workflows/ci-test.yml/badge.svg)](https://github.com/mizunashi-mana/cc-voice-reporter/actions/workflows/ci-test.yml)

Real-time voice reporting for Claude Code — hear what Claude is doing without watching the screen.

> **Status**: Under active development.

## How It Works

cc-voice-reporter runs as a background daemon that monitors Claude Code's transcript files and speaks out status updates through your system's text-to-speech engine.

```
 Claude Code               cc-voice-reporter daemon
 ───────────               ───────────────────────
     │                              │
     │  writes transcript           │  watches files
     │  (.jsonl files)              │  (chokidar)
     ▼                              ▼
 ~/.claude/projects/    ◄────  File Watcher
     {path}/                        │
     {session}.jsonl                │  parses events
                                    ▼
                               JSONL Parser
                                    │
                         ┌──────────┴──────────┐
                         ▼                      ▼
                    Summarizer              Speaker
                    (Ollama LLM)          (TTS command)
                         │                      │
                         │  periodic             │  turn-complete,
                         │  activity             │  confirmations,
                         │  summaries            │  project-switch
                         ▼                      ▼
                           🔊 Voice output
```

For example:
- Claude finishes a turn → **"Waiting for input"** (or "入力待ちです" in Japanese)
- Claude asks a question → **"Confirmation: Which library should we use?"**
- Switching projects → **"Playing content from another project, my-app"**
- Periodically → **"Read 3 files and ran tests. 2 tests failed."** (Ollama summary)

## Use Cases

- **Multitasking** — Work on something else (reading docs, reviewing PRs, making coffee) while Claude Code runs. You'll hear when it needs your attention.
- **Long-running tasks** — Let Claude handle large refactors or test runs. Periodic voice summaries keep you informed without switching windows.
- **Accessibility** — Get audio feedback instead of relying on visual monitoring of the terminal.

## Quick Start

### 1. Install prerequisites

- **Node.js v22+**
- **A TTS command** — defaults to macOS `say`; configurable for Linux (`espeak`, `festival`, etc.) or other engines (VOICEVOX, etc.)
- **[Ollama](https://ollama.com/)** — required for periodic activity summaries

```bash
# Install the recommended Ollama model
ollama pull gemma3
```

### 2. Build from source

> **Note**: Not yet published to npm.

```bash
git clone https://github.com/mizunashi-mana/cc-voice-reporter.git
cd cc-voice-reporter
npm install
npm run build
npm link -w packages/cc-voice-reporter
```

### 3. Generate a config file (optional)

```bash
cc-voice-reporter config init
```

### 4. Start the daemon

```bash
cc-voice-reporter monitor
```

That's it. Open Claude Code in another terminal and start working — you'll hear voice notifications as Claude responds.

## Features

- **Turn-complete notification** — Announces when Claude finishes and awaits input
- **AskUserQuestion readout** — Reads aloud confirmation prompts so you know when Claude needs your attention
- **Periodic summary** — Ollama generates a natural-language digest of recent operations at a configurable interval
- **Customizable speech command** — Use any TTS engine (`say`, `espeak`, VOICEVOX, etc.) via `speaker.command`
- **Multi-project support** — Project-switch announcements, per-project/session queue priority
- **Project filtering** — Include/exclude patterns to watch only specific projects
- **Multi-language** — Japanese and English voice messages (configurable via `language`)

## Commands

| Command | Description |
|---------|-------------|
| `monitor` | Start the voice reporter daemon |
| `config init` | Generate a config file template |
| `config path` | Show config file path |
| `tracking list` | List tracked projects |
| `tracking add <path>` | Add a project to tracking |
| `tracking remove <path>` | Remove a project from tracking |

### Monitor options

| Option | Description |
|--------|-------------|
| `--include <pattern>` | Only watch projects matching the pattern (repeatable) |
| `--exclude <pattern>` | Exclude projects matching the pattern (repeatable) |
| `--config <path>` | Path to config file |

## Configuration

Place a config file at `~/.config/cc-voice-reporter/config.json` (follows [XDG Base Directory](https://specifications.freedesktop.org/basedir-spec/latest/) spec).

All fields are optional. With no configuration, the daemon announces turn completion and confirmation prompts using macOS `say`.

### Example

```json
{
  "language": "ja",
  "speaker": {
    "command": ["say", "-v", "Kyoko"]
  },
  "ollama": {
    "model": "gemma3"
  }
}
```

### General options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `logLevel` | `"debug" \| "info" \| "warn" \| "error"` | `"info"` | Log verbosity |
| `language` | `string` | `"en"` | Output language code (used by voice messages and summary) |
| `projectsDir` | `string` | `~/.claude/projects` | Directory to watch for transcript files |

### Project filter

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `filter.include` | `string[]` | — | Only watch projects matching these patterns |
| `filter.exclude` | `string[]` | — | Exclude projects matching these patterns |

### Speaker (TTS)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `speaker.command` | `string[]` | `["say"]` | Speech command and fixed arguments. Message is appended as the last argument |
| `speaker.maxLength` | `number` | *(no limit)* | Max characters before middle-truncation |
| `speaker.truncationSeparator` | `string` | `"、中略、"` | Separator inserted when truncating |

### Ollama & summary

Ollama is required for operation. The daemon validates Ollama connectivity at startup and will fail if unavailable.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `ollama.model` | `string` | *(auto-detected)* | Ollama model name (e.g., `"gemma3"`) |
| `ollama.baseUrl` | `string` | `"http://localhost:11434"` | Ollama API URL |
| `ollama.timeoutMs` | `number` | `60000` | Ollama request timeout (ms) |
| `summary.intervalMs` | `number` | `5000` | Summary interval (ms) |

#### Recommended Ollama models

| Model | Size | Summary quality | Speed | Notes |
|-------|------|:---------------:|:-----:|-------|
| **gemma3** | 4B | Excellent | 4–15 s | Best overall quality and speed. Recommended. |
| **gemma3:1b** | 1B | Good | 2–6 s | Fastest option. |
| **llama3.2** | 3B | Good | 3–30 s | Acceptable alternative. |

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
