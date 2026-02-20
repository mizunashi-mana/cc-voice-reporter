/**
 * CLI entry point for the cc-voice-reporter daemon.
 *
 * Starts the daemon and handles SIGINT/SIGTERM for graceful shutdown.
 */

import { parseArgs } from "node:util";
import { Daemon } from "./daemon.js";
import { loadConfig, resolveOptions } from "./config.js";

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
  const options = resolveOptions(config, {
    include: values.include,
    exclude: values.exclude,
  });

  const daemon = new Daemon(options);

  const shutdown = (): void => {
    process.stderr.write("[cc-voice-reporter] shutting down...\n");
    void daemon.stop().then(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await daemon.start();
  process.stderr.write("[cc-voice-reporter] daemon started\n");
}

main().catch((error: unknown) => {
  process.stderr.write(
    `[cc-voice-reporter] fatal: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
