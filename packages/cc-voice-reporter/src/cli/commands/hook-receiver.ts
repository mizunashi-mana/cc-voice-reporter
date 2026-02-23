/**
 * hook-receiver subcommand — receives Claude Code hook events via stdin.
 *
 * Designed to be called as a Claude Code hook handler. Reads JSON from stdin,
 * extracts the session_id, and appends the event as a JSONL line to
 * {hooksDir}/{session_id}.jsonl for the monitor daemon to watch.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import { getHooksDir, loadConfig } from '#cli';
import { CliError } from './output.js';

/**
 * Minimal schema for hook event validation.
 * Only requires session_id; all other fields are passed through.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- Zod schema convention
const HookEventSchema = z.looseObject({
  session_id: z.string().min(1).regex(
    /^[^/\\]+$/,
    'session_id must not contain path separators',
  ),
});

/** Read all data from stdin until EOF. */
export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
    }
    else {
      chunks.push(Buffer.from(String(chunk)));
    }
  }
  return Buffer.concat(chunks).toString('utf-8');
}

const USAGE = `\
Usage: cc-voice-reporter hook-receiver [options]

Receive a Claude Code hook event via stdin and store it for the monitor daemon.

This command is intended to be called as a Claude Code hook handler, not
invoked directly. Configure it in .claude/settings.json:

  {
    "hooks": {
      "Notification": [{
        "hooks": [{
          "type": "command",
          "command": "cc-voice-reporter hook-receiver"
        }]
      }]
    }
  }

Options:
  --config <path>  Path to config file (for custom stateDir)
  --help, -h       Show this help message`;

export interface HookReceiverDeps {
  readInput: () => Promise<string>;
}

const defaultDeps: HookReceiverDeps = {
  readInput: readStdin,
};

export async function runHookReceiverCommand(
  args: string[],
  deps: HookReceiverDeps = defaultDeps,
): Promise<void> {
  // Manual arg parsing (minimal — only --help and --config)
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }

  let configPath: string | undefined;
  const configIdx = args.indexOf('--config');
  if (configIdx !== -1) {
    configPath = args[configIdx + 1];
    if (configPath === undefined) {
      throw new CliError('--config requires a path argument');
    }
  }

  const input = await deps.readInput();
  if (input.trim() === '') {
    throw new CliError('hook-receiver: no input received on stdin');
  }

  let json: unknown;
  try {
    json = JSON.parse(input);
  }
  catch {
    throw new CliError('hook-receiver: invalid JSON on stdin');
  }

  const result = HookEventSchema.safeParse(json);
  if (!result.success) {
    throw new CliError(
      `hook-receiver: invalid hook event: ${result.error.message}`,
    );
  }

  const config = await loadConfig(configPath);
  const hooksDir = getHooksDir(config.stateDir);

  await fs.promises.mkdir(hooksDir, { recursive: true });

  const filePath = path.join(hooksDir, `${result.data.session_id}.jsonl`);
  const line = `${JSON.stringify(result.data)}\n`;
  await fs.promises.appendFile(filePath, line, 'utf-8');
}
