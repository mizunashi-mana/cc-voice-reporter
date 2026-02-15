/**
 * CLI entry point for the cc-voice-reporter daemon.
 *
 * Starts the daemon and handles SIGINT/SIGTERM for graceful shutdown.
 */

import { Daemon } from "./daemon.js";

async function main(): Promise<void> {
  const daemon = new Daemon();

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
