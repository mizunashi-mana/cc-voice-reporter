/**
 * CLI entry point for cc-voice-reporter.
 *
 * Routes to subcommands: config, monitor, tracking.
 */

import { runConfigCommand } from './commands/config.js';
import { runMonitorCommand } from './commands/monitor.js';
import { CliError } from './commands/output.js';
import { runTrackingCommand } from './commands/tracking.js';

const USAGE = `\
Usage: cc-voice-reporter <command> [options]

Commands:
  monitor    Start the voice reporter daemon
  config     Manage configuration file
  tracking   Manage tracked projects

Run 'cc-voice-reporter <command> --help' for more information on a command.`;

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
