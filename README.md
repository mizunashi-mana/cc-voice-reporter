# cc-voice-reporter

[![CI Lint](https://github.com/mizunashi-mana/cc-voice-reporter/actions/workflows/ci-lint.yml/badge.svg)](https://github.com/mizunashi-mana/cc-voice-reporter/actions/workflows/ci-lint.yml)
[![CI Test](https://github.com/mizunashi-mana/cc-voice-reporter/actions/workflows/ci-test.yml/badge.svg)](https://github.com/mizunashi-mana/cc-voice-reporter/actions/workflows/ci-test.yml)

A tool that provides real-time voice reporting of Claude Code's execution status.

Uses macOS's built-in `say` command to announce tool executions, completions, notifications, and more — no external APIs or services required.

## Requirements

- macOS
- Node.js v24+

## Installation

> **Note**: Not yet published to npm. Use the "build from source" method below.

```bash
npm install -g cc-voice-reporter
```

Or build from source:

```bash
git clone https://github.com/mizunashi-mana/cc-voice-reporter.git
cd cc-voice-reporter
npm install
npm run build
npm link
```

## Setup

Add the following hook configuration to your `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "cc-voice-reporter"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "cc-voice-reporter"
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "cc-voice-reporter"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "cc-voice-reporter"
          }
        ]
      }
    ]
  }
}
```

## Supported Hook Events

| Event | Voice Message |
|-------|---------------|
| PreToolUse | "ツール {name} を実行します" |
| PostToolUse | "ツール {name} が完了しました" |
| Notification | "通知: {message}" |
| Stop | "処理が完了しました" |

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
