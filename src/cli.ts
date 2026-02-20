/**
 * CLI entry point for the cc-voice-reporter daemon.
 *
 * Starts the daemon and handles SIGINT/SIGTERM for graceful shutdown.
 */

import { parseArgs } from "node:util";
import { Daemon } from "./daemon.js";
import { loadConfig, resolveOptions } from "./config.js";
import { Logger, resolveLogLevel } from "./logger.js";

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      include: { type: "string", multiple: true },
      exclude: { type: "string", multiple: true },
      config: { type: "string" },
    },
  });

  const config = await loadConfig(values.config);
  const logLevel = resolveLogLevel(config.logLevel);
  const logger = new Logger({ level: logLevel });
  const options = resolveOptions(config, {
    include: values.include,
    exclude: values.exclude,
  });

  const daemon = new Daemon({ ...options, logLevel });

  let shuttingDown = false;

  const gracefulShutdown = (): void => {
    if (shuttingDown) {
      logger.info("force shutting down...");
      daemon.forceStop();
      process.exit(1);
      return;
    }
    shuttingDown = true;
    logger.info("shutting down...");
    daemon
      .stop()
      .then(() => {
        process.exit(0);
      })
      .catch((err: unknown) => {
        logger.error(
          `shutdown error: ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(1);
      });
  };

  const forceShutdown = (): void => {
    logger.info("force shutting down...");
    daemon.forceStop();
    process.exit(1);
  };

  process.on("SIGINT", gracefulShutdown);
  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGQUIT", forceShutdown);

  await daemon.start();
  logger.info("daemon started");
}

main().catch((error: unknown) => {
  const logger = new Logger();
  logger.error(
    `fatal: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
