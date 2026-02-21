# cc-voice-reporter

[![CI Lint](https://github.com/mizunashi-mana/cc-voice-reporter/actions/workflows/ci-lint.yml/badge.svg)](https://github.com/mizunashi-mana/cc-voice-reporter/actions/workflows/ci-lint.yml)
[![CI Test](https://github.com/mizunashi-mana/cc-voice-reporter/actions/workflows/ci-test.yml/badge.svg)](https://github.com/mizunashi-mana/cc-voice-reporter/actions/workflows/ci-test.yml)

Real-time voice reporting for Claude Code — hear what Claude is doing without watching the screen.

Monitors Claude Code's transcript `.jsonl` files and reads aloud Claude's responses, tool executions, and session events using macOS's built-in `say` command. Optionally uses [Ollama](https://ollama.com/) for translation and periodic activity summaries.

> **Status**: Under active development.

## Features

- **Voice narration** — Claude's text responses and AskUserQuestion prompts are read aloud in real time
- **Turn-complete notification** — "入力待ちです" when Claude finishes and awaits input
- **Periodic summary** (optional) — Ollama generates a natural-language digest of recent operations at a configurable interval
- **Translation** (optional) — Translate Claude's responses to a target language via Ollama before reading aloud
- **Multi-project support** — Project-switch announcements, per-project/session queue priority
- **Project filtering** — Include/exclude patterns to watch only specific projects

## Requirements

- macOS
- Node.js v24+
- [Ollama](https://ollama.com/) (optional, for translation and summary features)

## Installation

> **Note**: Not yet published to npm. Use the "build from source" method below.

```bash
git clone https://github.com/mizunashi-mana/cc-voice-reporter.git
cd cc-voice-reporter
npm install
npm run build
npm link
```

## Usage

```bash
# Start the daemon
cc-voice-reporter

# Watch only specific projects
cc-voice-reporter --include my-project --exclude scratch

# Use a custom config file
cc-voice-reporter --config /path/to/config.json
```

### CLI Options

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

With no configuration, the daemon reads aloud all Claude Code responses using macOS `say`.

### Full example

```json
{
  "logLevel": "info",
  "debounceMs": 500,
  "filter": {
    "include": ["my-project"],
    "exclude": ["scratch"]
  },
  "speaker": {
    "maxLength": 100,
    "truncationSeparator": "、中略、"
  },
  "ollama": {
    "model": "gemma3",
    "baseUrl": "http://localhost:11434",
    "timeoutMs": 30000
  },
  "translation": {
    "use": "ollama",
    "outputLanguage": "ja"
  },
  "summary": {
    "enabled": true,
    "intervalMs": 60000
  },
  "narration": false
}
```

### Options reference

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `logLevel` | `"debug" \| "info" \| "warn" \| "error"` | `"info"` | Log verbosity |
| `debounceMs` | `number` | `500` | Debounce interval (ms) for combining rapid text updates |
| `projectsDir` | `string` | `~/.claude/projects` | Directory to watch for transcript files |
| `filter.include` | `string[]` | — | Only watch projects matching these patterns |
| `filter.exclude` | `string[]` | — | Exclude projects matching these patterns |
| `speaker.maxLength` | `number` | `100` | Max characters before middle-truncation |
| `speaker.truncationSeparator` | `string` | `"、中略、"` | Separator inserted when truncating |
| `ollama.model` | `string` | *(required if ollama used)* | Ollama model name (e.g., `"gemma3"`) |
| `ollama.baseUrl` | `string` | `"http://localhost:11434"` | Ollama API URL |
| `ollama.timeoutMs` | `number` | `30000` | Ollama request timeout (ms) |
| `translation.use` | `"ollama"` | — | Translation backend |
| `translation.outputLanguage` | `string` | — | Target language (e.g., `"ja"`, `"en"`) |
| `summary.enabled` | `boolean` | `false` | Enable periodic summary notifications |
| `summary.intervalMs` | `number` | `60000` | Summary interval (ms) |
| `narration` | `boolean` | auto | Per-message narration. Defaults to `false` when summary is enabled, `true` otherwise |

> **Note**: `summary` and `translation` both require the `ollama` section to be configured. Enabling `summary` without `ollama` will cause an error at startup.

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
