/**
 * Lightweight logger for cc-voice-reporter CLI.
 *
 * Provides structured log output to stderr with level-based filtering.
 * No external dependencies — uses process.stderr.write directly.
 *
 * Log level can be configured via:
 *   1. Environment variable CC_VOICE_REPORTER_LOG_LEVEL
 *   2. Config file logLevel field
 *   3. Default: "info"
 */

import type { Logger as LoggerInterface } from '@cc-voice-reporter/monitor';

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const PREFIX = '[cc-voice-reporter]';

/** Parse a string into a valid LogLevel, or return undefined. */
export function parseLogLevel(value: string): LogLevel | undefined {
  const lower = value.toLowerCase();
  if ((LOG_LEVELS as readonly string[]).includes(lower)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- validated by includes check above
    return lower as LogLevel;
  }
  return undefined;
}

export interface LoggerOptions {
  /** Minimum log level to output (default: "info"). */
  level?: LogLevel;
  /** Custom write function (default: process.stderr.write). Used for testing. */
  writeFn?: (message: string) => void;
}

export class Logger implements LoggerInterface {
  private readonly level: LogLevel;
  private readonly writeFn: (message: string) => void;

  constructor(options?: LoggerOptions) {
    this.level = options?.level ?? 'info';
    this.writeFn
      = options?.writeFn ?? (msg => process.stderr.write(msg));
  }

  debug(message: string): void {
    this.log('debug', message);
  }

  info(message: string): void {
    this.log('info', message);
  }

  warn(message: string): void {
    this.log('warn', message);
  }

  error(message: string): void {
    this.log('error', message);
  }

  private log(level: LogLevel, message: string): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.level]) return;
    this.writeFn(`${PREFIX} ${level}: ${message}\n`);
  }
}

/**
 * Resolve the effective log level from environment variable and config.
 *
 * Priority: env var > config > "info"
 */
export function resolveLogLevel(configLevel?: string): LogLevel {
  const envValue = process.env.CC_VOICE_REPORTER_LOG_LEVEL;
  if (envValue !== undefined) {
    const parsed = parseLogLevel(envValue);
    if (parsed !== undefined) return parsed;
  }
  if (configLevel !== undefined) {
    const parsed = parseLogLevel(configLevel);
    if (parsed !== undefined) return parsed;
  }
  return 'info';
}
