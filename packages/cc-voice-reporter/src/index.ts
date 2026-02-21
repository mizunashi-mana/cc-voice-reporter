/**
 * Public API for cc-voice-reporter.
 *
 * Re-exports the monitor modules. CLI code accesses monitor
 * exclusively through this barrel (#lib).
 */

export {
  Daemon,
  type DaemonOptions,
  type Logger,
  getMessages,
  type Messages,
  type SummarizerOptions,
  type ProjectFilter,
} from './monitor/index.js';
