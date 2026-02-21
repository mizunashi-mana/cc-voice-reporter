/**
 * Internal barrel file for the CLI package.
 *
 * Commands import from '#lib' which resolves to this file.
 * This centralizes and controls what internal modules are accessible.
 */

export {
  ConfigSchema,
  getDefaultConfigPath,
  loadConfig,
  resolveOptions,
  type Config,
} from './config.js';
export { Logger, resolveLogLevel, type LogLevel } from './logger.js';
export { resolveOllamaModel } from './ollama.js';
