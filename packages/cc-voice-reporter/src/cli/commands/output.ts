/**
 * CLI output helpers.
 *
 * Uses process.stdout/stderr.write directly to avoid no-console lint rule
 * in non-entrypoint files.
 */

/** Write a line to stdout. */
export function println(message: string): void {
  process.stdout.write(`${message}\n`);
}

/** Write a line to stderr. */
export function errorln(message: string): void {
  process.stderr.write(`${message}\n`);
}

/** Error with an exit code for CLI command failures. */
export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}
