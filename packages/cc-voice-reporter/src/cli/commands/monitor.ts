/**
 * monitor subcommand — starts the voice reporter daemon.
 *
 * Equivalent to the previous top-level cc-voice-reporter command.
 */

import { parseArgs } from 'node:util';
import { Logger, loadConfig, resolveLogLevel, resolveOllamaModel, resolveOptions } from '#cli';
import { Daemon } from '#lib';
import { println } from './output.js';

const USAGE = `\
Usage: cc-voice-reporter monitor [options]

Start the voice reporter daemon.

Options:
  --include <pattern>  Include projects matching pattern (repeatable)
  --exclude <pattern>  Exclude projects matching pattern (repeatable)
  --config <path>      Path to config file
  --help, -h           Show this help message`;

export async function runMonitorCommand(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      include: { type: 'string', multiple: true },
      exclude: { type: 'string', multiple: true },
      config: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help === true) {
    println(USAGE);
    return;
  }

  const config = await loadConfig(values.config);
  const logLevel = resolveLogLevel(config.logLevel);
  const logger = new Logger({ level: logLevel });
  const ollamaModel = await resolveOllamaModel(config);
  const options = resolveOptions(config, {
    include: values.include,
    exclude: values.exclude,
  }, ollamaModel);

  const daemon = new Daemon({ ...options, logger });

  let shuttingDown = false;

  const gracefulShutdown = (): void => {
    if (shuttingDown) {
      logger.info('force shutting down...');
      daemon.forceStop();
      // eslint-disable-next-line n/no-process-exit -- signal handler requires immediate exit
      process.exit(1);
      return;
    }
    shuttingDown = true;
    logger.info('shutting down...');
    daemon
      .stop()
      .then(() => {
        // eslint-disable-next-line n/no-process-exit -- graceful shutdown complete
        process.exit(0);
      })
      .catch((err: unknown) => {
        logger.error(
          `shutdown error: ${err instanceof Error ? err.message : String(err)}`,
        );
        // eslint-disable-next-line n/no-process-exit -- shutdown error requires immediate exit
        process.exit(1);
      });
  };

  const forceShutdown = (): void => {
    logger.info('force shutting down...');
    daemon.forceStop();
    // eslint-disable-next-line n/no-process-exit -- forced shutdown requires immediate exit
    process.exit(1);
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGQUIT', forceShutdown);

  await daemon.start();
  logger.info('daemon started');
}
