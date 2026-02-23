#!/usr/bin/env node
/**
 * CLI entry point for cc-voice-reporter.
 *
 * Routes to subcommands: config, monitor, tracking.
 */

import { createRequire } from 'node:module';
import { z } from 'zod';
import { runConfigCommand } from './commands/config.js';
import { runHookReceiverCommand } from './commands/hook-receiver.js';
import { runMonitorCommand } from './commands/monitor.js';
import { CliError } from './commands/output.js';
import { runTrackingCommand } from './commands/tracking.js';

const USAGE = `\
Usage: cc-voice-reporter <command> [options]

Commands:
  monitor         Start the voice reporter daemon
  config          Manage configuration file
  tracking        Manage tracked projects
  hook-receiver   Receive Claude Code hook events (for hook integration)

Options:
  --help, -h     Show this help message
  --version      Show version number

Run 'cc-voice-reporter <command> --help' for more information on a command.`;

const packageJsonSchema = z.object({
  version: z.string(),
});

function getVersion(): string {
  const require = createRequire(import.meta.url);
  const packageJson: unknown = require('../../package.json');
  return packageJsonSchema.parse(packageJson).version;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const subArgs = args.slice(1);

  switch (command) {
    case 'monitor':
      await runMonitorCommand(subArgs);
      break;
    case 'config':
      await runConfigCommand(subArgs);
      break;
    case 'tracking':
      await runTrackingCommand(subArgs);
      break;
    case 'hook-receiver':
      await runHookReceiverCommand(subArgs);
      break;
    case '--version':
      console.log(getVersion());
      break;
    case '--help':
    case '-h':
    case undefined:
      console.log(USAGE);
      break;
    default:
      console.error(`Unknown command: ${command}\n`);
      console.error(USAGE);
      process.exit(1);
  }
}

main().catch((error: unknown) => {
  if (error instanceof CliError) {
    console.error(error.message);
    process.exit(error.exitCode);
  }
  console.error(
    `fatal: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
