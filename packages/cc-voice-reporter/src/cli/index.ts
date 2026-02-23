/**
 * Internal barrel file for CLI modules.
 *
 * Commands import from '#cli' which resolves to this file.
 * This centralizes and controls what CLI-internal modules are accessible.
 */

export {
  ConfigSchema,
  getDefaultConfigPath,
  loadConfig,
  resolveOptions,
  type Config,
  type ResolvedDeps,
} from './config.js';
export { Logger, resolveLogLevel, type LogLevel } from './logger.js';
export { listOllamaModels, OLLAMA_DEFAULT_BASE_URL, resolveOllamaModel } from './ollama.js';
export { resolveSpeakerCommand } from './speaker-command.js';
export { resolveLanguage } from './locale.js';
export { createStdioWizardIO, runWizard, type WizardIO, type WizardResult } from './wizard.js';
