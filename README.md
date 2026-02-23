# cc-voice-reporter

[![CI Lint](https://github.com/mizunashi-mana/cc-voice-reporter/actions/workflows/ci-lint.yml/badge.svg)](https://github.com/mizunashi-mana/cc-voice-reporter/actions/workflows/ci-lint.yml)
[![CI Test](https://github.com/mizunashi-mana/cc-voice-reporter/actions/workflows/ci-test.yml/badge.svg)](https://github.com/mizunashi-mana/cc-voice-reporter/actions/workflows/ci-test.yml)
[![npm](https://img.shields.io/npm/v/@mizunashi_mana/cc-voice-reporter)](https://www.npmjs.com/package/@mizunashi_mana/cc-voice-reporter)

Real-time voice reporting for Claude Code — hear what Claude is doing without watching the screen.

cc-voice-reporter runs as a background daemon that monitors Claude Code's transcript files and speaks out what's happening: when Claude finishes a task, when it needs your confirmation, and periodic summaries of its activity. You can step away from your desk and still know exactly what Claude is up to.

## When is this useful?

- **Multitasking** — You're working on something else while Claude runs a long task. Voice notifications tell you when it's done or needs input.
- **Hands-free monitoring** — You want to follow Claude's progress without constantly switching windows.
- **Quick reaction to prompts** — Claude asks a confirmation question; you hear it immediately instead of discovering it minutes later.

## Quick Start

```bash
# 1. Install Ollama (https://ollama.com/) and pull a model
ollama pull gemma3

# 2. Run the setup wizard (creates config & registers Claude Code hooks)
npx @mizunashi_mana/cc-voice-reporter config init

# 3. Start the daemon
npx @mizunashi_mana/cc-voice-reporter monitor
```

That's it. Open Claude Code in another terminal and start a session — you'll hear voice notifications as Claude works.

### Global install (optional)

If you prefer not to use `npx` every time, install the package globally:

```bash
npm install -g @mizunashi_mana/cc-voice-reporter

# Then use directly
cc-voice-reporter config init
cc-voice-reporter monitor
```

## Requirements

- Node.js v22+
- A TTS command — auto-detected at startup (`say` on macOS, `espeak-ng` or `espeak` on Linux); override via `speaker.command` in config
- [Ollama](https://ollama.com/) (required — used for periodic activity summaries)

### Recommended Ollama models

| Model | Size | Summary quality | Speed | Notes |
|-------|------|:---------------:|:-----:|-------|
| **gemma3** | 4B | Excellent | 4–15 s | Best overall quality and speed. Recommended. |
| **gemma3:1b** | 1B | Good | 2–6 s | Fastest option. |
| **llama3.2** | 3B | Good | 3–30 s | Acceptable alternative. |

> **Tip**: For the best experience, use **gemma3**. Install it with `ollama pull gemma3`.

## Usage

> **Note**: The examples below use `npx`. If you installed globally, replace `npx @mizunashi_mana/cc-voice-reporter` with `cc-voice-reporter`.

```bash
# Show help
npx @mizunashi_mana/cc-voice-reporter --help
npx @mizunashi_mana/cc-voice-reporter monitor --help

# Start the daemon
npx @mizunashi_mana/cc-voice-reporter monitor

# Watch only specific projects
npx @mizunashi_mana/cc-voice-reporter monitor --include my-project --exclude scratch

# Use a custom config file
npx @mizunashi_mana/cc-voice-reporter monitor --config /path/to/config.json

# Initialize a config file
npx @mizunashi_mana/cc-voice-reporter config init

# Manage tracked projects
npx @mizunashi_mana/cc-voice-reporter tracking list
npx @mizunashi_mana/cc-voice-reporter tracking add /path/to/project
npx @mizunashi_mana/cc-voice-reporter tracking remove /path/to/project
```

### Commands

| Command | Description |
|---------|-------------|
| `monitor` | Start the voice reporter daemon |
| `config` | Manage configuration file (`init`, `path`) |
| `tracking` | Manage tracked projects (`add`, `remove`, `list`) |

### Global Options

| Option | Description |
|--------|-------------|
| `--help`, `-h` | Show help message |
| `--version` | Show version number |

### Monitor Options

| Option | Description |
|--------|-------------|
| `--include <pattern>` | Only watch projects matching the pattern (repeatable) |
| `--exclude <pattern>` | Exclude projects matching the pattern (repeatable) |
| `--config <path>` | Path to config file |

## Configuration

The setup wizard creates a config file and registers [Claude Code hooks](https://docs.anthropic.com/en/docs/claude-code/hooks):

```bash
npx @mizunashi_mana/cc-voice-reporter config init
```

The wizard detects your system locale, available TTS commands, and Ollama models, then generates a config file at `~/.config/cc-voice-reporter/config.json`. It also registers hooks in `~/.claude/settings.json` for real-time event notifications (e.g., permission prompts). See `config init --help` for additional options.

The config file follows the [XDG Base Directory](https://specifications.freedesktop.org/basedir-spec/latest/) spec. All fields are optional.

### Example

```json
{
  "logLevel": "info",
  "language": "ja",
  "filter": {
    "include": ["my-project"],
    "exclude": ["scratch"]
  },
  "speaker": {
    "command": ["say", "-v", "Kyoko"]
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
| `language` | `string` | *(auto-detected from system locale; `"en"` fallback)* | Output language code (used by voice messages and summary) |
| `projectsDir` | `string` | `~/.claude/projects` | Directory to watch for transcript files |
| `filter.include` | `string[]` | — | Only watch projects matching these patterns |
| `filter.exclude` | `string[]` | — | Exclude projects matching these patterns |
| `speaker.command` | `string[]` | *(auto-detected: `say` / `espeak-ng` / `espeak`)* | Speech command and fixed arguments. Message is appended as the last argument |
| `ollama.model` | `string` | *(auto-detected if omitted)* | Ollama model name (e.g., `"gemma3"`) |
| `ollama.baseUrl` | `string` | `"http://localhost:11434"` | Ollama API URL |
| `ollama.timeoutMs` | `number` | `60000` | Ollama request timeout (ms) |
| `summary.intervalMs` | `number` | `5000` | Summary interval (ms) |

> **Note**: Ollama is required for operation. The daemon validates Ollama connectivity at startup and will fail if unavailable.

### Claude Code Hooks

`config init` registers the following hooks in `~/.claude/settings.json`:

| Hook event | Matcher | Purpose |
|------------|---------|---------|
| `SessionStart` | — | Notifies the daemon when a new Claude Code session begins |
| `Notification` | `permission_prompt` | Notifies the daemon immediately when Claude asks for permission |

Both hooks run `npx -y @mizunashi_mana/cc-voice-reporter hook-receiver`, which receives event data from Claude Code via stdin and writes it to a local state directory. The daemon picks up these events and speaks them aloud.

If you skipped hook registration during `config init`, you can add hooks manually to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx -y @mizunashi_mana/cc-voice-reporter hook-receiver"
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": "permission_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "npx -y @mizunashi_mana/cc-voice-reporter hook-receiver"
          }
        ]
      }
    ]
  }
}
```

> **Tip**: If you installed globally, you can use `cc-voice-reporter hook-receiver` instead.

## Development

```bash
# Clone and build from source
git clone https://github.com/mizunashi-mana/cc-voice-reporter.git
cd cc-voice-reporter

# Using devenv (requires Nix)
devenv shell

# Install dependencies and build
npm install
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
