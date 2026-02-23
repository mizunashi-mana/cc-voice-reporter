/**
 * Configuration file loading and merging for cc-voice-reporter.
 *
 * Supports XDG Base Directory specification for config file placement:
 *   $XDG_CONFIG_HOME/cc-voice-reporter/config.json
 *   (default: ~/.config/cc-voice-reporter/config.json)
 *
 * CLI arguments take precedence over config file values.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { z } from 'zod';
import type { DaemonOptions, ProjectFilter } from '#lib';

/** Default Ollama API base URL. */
const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';

/** Default maximum events in the summary prompt. */
const DEFAULT_MAX_PROMPT_EVENTS = 30;

// eslint-disable-next-line @typescript-eslint/naming-convention -- Zod schema convention
export const ConfigSchema = z
  .object({
    /** Log level: "debug" | "info" | "warn" | "error" (default: "info"). */
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).optional(),

    /**
     * Output language code (e.g., "ja", "en"). Default: "en".
     * Used by voice messages and summary.
     */
    language: z.string().optional(),

    /** Project filter (include/exclude patterns). */
    filter: z
      .object({
        include: z.array(z.string()).optional(),
        exclude: z.array(z.string()).optional(),
      })
      .optional(),

    /** Projects directory to watch (default: ~/.claude/projects). */
    projectsDir: z.string().optional(),

    /**
     * State directory for runtime data (default: $XDG_STATE_HOME/cc-voice-reporter).
     * Hook data files are stored under {stateDir}/hooks/.
     */
    stateDir: z.string().optional(),

    /** Speaker options. */
    speaker: z
      .object({
        /**
         * Command and fixed arguments for speech output (default: ["say"]).
         * The message is appended as the last argument at runtime.
         * Example: ["say", "-v", "Kyoko"] → execFile("say", ["-v", "Kyoko", message])
         */
        command: z.array(z.string().min(1)).min(1).optional(),
      })
      .strict()
      .optional(),

    /** Ollama configuration (optional overrides for model, baseUrl, timeout). */
    ollama: z
      .object({
        /** Model name (e.g., "gemma3", "translategemma"). Optional; auto-detected if omitted. */
        model: z.string().optional(),
        /** Ollama API base URL (default: "http://localhost:11434"). */
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- z.string().url() is the current stable API
        baseUrl: z.string().url().optional(),
        /** Request timeout in ms (default: 60000). */
        timeoutMs: z.number().int().positive().optional(),
      })
      .strict()
      .optional(),

    /** Periodic summary notification options (interval tuning). */
    summary: z
      .object({
        /** Summary interval in ms (default: 5000). */
        intervalMs: z.number().int().positive().optional(),
        /** Maximum number of events to include in the summary prompt (default: 30). */
        maxPromptEvents: z.number().int().positive().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Return the default config file path following XDG Base Directory spec.
 *
 * Uses $XDG_CONFIG_HOME if set, otherwise falls back to ~/.config.
 */
export function getDefaultConfigPath(): string {
  const xdgConfigHome
    = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
  return path.join(xdgConfigHome, 'cc-voice-reporter', 'config.json');
}

/**
 * Return the default state directory following XDG Base Directory spec.
 *
 * Uses $XDG_STATE_HOME if set, otherwise falls back to ~/.local/state.
 */
export function getDefaultStateDir(): string {
  const xdgStateHome
    = process.env.XDG_STATE_HOME ?? path.join(os.homedir(), '.local', 'state');
  return path.join(xdgStateHome, 'cc-voice-reporter');
}

/**
 * Return the hooks data directory path.
 *
 * If `stateDir` is provided (from config), uses it as the base.
 * Otherwise, falls back to the XDG default state directory.
 */
export function getHooksDir(stateDir?: string): string {
  return path.join(stateDir ?? getDefaultStateDir(), 'hooks');
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}

/**
 * Load and validate a config file.
 *
 * - If `configPath` is given and the file does not exist, throws an error.
 * - If `configPath` is omitted, uses the XDG default path; missing file
 *   returns an empty config (no error).
 * - JSON parse errors and schema validation errors always throw.
 */
export async function loadConfig(configPath?: string): Promise<Config> {
  const filePath = configPath ?? getDefaultConfigPath();

  let content: string;
  try {
    content = await fs.promises.readFile(filePath, 'utf-8');
  }
  catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      if (configPath !== undefined) {
        throw new Error(`Config file not found: ${filePath}`);
      }
      return {};
    }
    throw err;
  }

  let json: unknown;
  try {
    json = JSON.parse(content);
  }
  catch {
    throw new Error(`Invalid JSON in config file ${filePath}`);
  }

  const result = ConfigSchema.safeParse(json);
  if (!result.success) {
    throw new Error(
      `Invalid config file ${filePath}: ${result.error.message}`,
    );
  }
  return result.data;
}

/** Externally-resolved values passed to resolveOptions. */
export interface ResolvedDeps {
  /** Resolved Ollama model name (auto-detected or validated). */
  ollamaModel: string;
  /** Resolved TTS command (auto-detected or from config). */
  speakerCommand: string[];
  /** Resolved language code (auto-detected from locale or from config). */
  language: string;
}

/**
 * Merge a loaded config with CLI argument overrides into DaemonOptions.
 *
 * Priority: CLI args > config file > defaults (applied downstream).
 * Arrays (include/exclude) are replaced wholesale, not merged.
 *
 * The `resolved` parameter bundles values that have been externally resolved
 * by the CLI layer (Ollama model, TTS command, language) before this call.
 */
export function resolveOptions(
  config: Config,
  cliArgs: { include?: string[]; exclude?: string[] },
  resolved: ResolvedDeps,
): Omit<DaemonOptions, 'logger'> {
  const filter: ProjectFilter = {};
  const includeSource = cliArgs.include ?? config.filter?.include;
  const excludeSource = cliArgs.exclude ?? config.filter?.exclude;
  if (includeSource) filter.include = includeSource;
  if (excludeSource) filter.exclude = excludeSource;

  const { ollamaModel, speakerCommand, language } = resolved;

  return {
    language,
    watcher: {
      projectsDir: config.projectsDir,
      filter,
    },
    speaker: { command: speakerCommand },
    summary: {
      ollama: {
        model: ollamaModel,
        baseUrl: config.ollama?.baseUrl ?? DEFAULT_OLLAMA_BASE_URL,
        timeoutMs: config.ollama?.timeoutMs,
      },
      intervalMs: config.summary?.intervalMs,
      maxPromptEvents: config.summary?.maxPromptEvents ?? DEFAULT_MAX_PROMPT_EVENTS,
      language,
    },
  };
}
