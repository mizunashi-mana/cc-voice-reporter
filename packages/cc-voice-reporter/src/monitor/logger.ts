/**
 * Logger interface for cc-voice-reporter monitor.
 *
 * The concrete implementation lives in the CLI package.
 * Monitor modules depend only on this interface for dependency injection.
 */

export interface Logger {
  debug: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}
