# cc-voice-reporter

[![CI Lint](https://github.com/mizunashi-mana/cc-voice-reporter/actions/workflows/ci-lint.yml/badge.svg)](https://github.com/mizunashi-mana/cc-voice-reporter/actions/workflows/ci-lint.yml)
[![CI Test](https://github.com/mizunashi-mana/cc-voice-reporter/actions/workflows/ci-test.yml/badge.svg)](https://github.com/mizunashi-mana/cc-voice-reporter/actions/workflows/ci-test.yml)

Real-time voice reporting for Claude Code — hear what Claude is doing without watching the screen.

Monitors Claude Code's transcript `.jsonl` files and reads aloud Claude's responses, tool executions, and session events using macOS's built-in `say` command. No external APIs or services required.

> **Status**: Under active development. Currently transitioning from a hook-based approach to transcript `.jsonl` file monitoring, which enables reading aloud Claude's text responses — something hooks alone cannot provide.

## Requirements

- macOS
- Node.js v24+

## Installation

> **Note**: Not yet published to npm. Use the "build from source" method below.

```bash
git clone https://github.com/mizunashi-mana/cc-voice-reporter.git
cd cc-voice-reporter
npm install
npm run build
npm link
```

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
