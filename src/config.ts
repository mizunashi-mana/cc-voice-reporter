/**
 * Configuration file loading and merging for cc-voice-reporter.
 *
 * Supports XDG Base Directory specification for config file placement:
 *   $XDG_CONFIG_HOME/cc-voice-reporter/config.json
 *   (default: ~/.config/cc-voice-reporter/config.json)
 *
 * CLI arguments take precedence over config file values.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { z } from "zod";
import type { DaemonOptions } from "./daemon.js";
import type { SummarizerOptions } from "./summarizer.js";
import type { TranslatorOptions } from "./translator.js";
import type { ProjectFilter } from "./watcher.js";

export const ConfigSchema = z
  .object({
    /** Log level: "debug" | "info" | "warn" | "error" (default: "info"). */
    logLevel: z.enum(["debug", "info", "warn", "error"]).optional(),

    /** Project filter (include/exclude patterns). */
    filter: z
      .object({
        include: z.array(z.string()).optional(),
        exclude: z.array(z.string()).optional(),
      })
      .optional(),

    /** Projects directory to watch (default: ~/.claude/projects). */
    projectsDir: z.string().optional(),

    /** Debounce interval in ms for text messages (default: 500). */
    debounceMs: z.number().int().positive().optional(),

    /** Speaker options. */
    speaker: z
      .object({
        /** Maximum character length before truncation (default: 100). */
        maxLength: z.number().int().positive().optional(),
        /** Separator inserted when truncating (default: "、中略、"). */
        truncationSeparator: z.string().optional(),
      })
      .optional(),

    /** Ollama configuration (shared by translation, summarization, etc.). */
    ollama: z
      .object({
        /** Model name (e.g., "gemma3", "translategemma"). */
        model: z.string(),
        /** Ollama API base URL (default: "http://localhost:11434"). */
        baseUrl: z.string().url().optional(),
        /** Request timeout in ms (default: 60000). */
        timeoutMs: z.number().int().positive().optional(),
      })
      .strict()
      .optional(),

    /** Translation options. Requires ollama config when use is "ollama". */
    translation: z
      .object({
        /** Translation backend to use. */
        use: z.literal("ollama"),
        /** Target language for translation (e.g., "ja", "en"). */
        outputLanguage: z.string(),
      })
      .strict()
      .optional(),

    /**
     * Enable per-message narration (default: auto).
     * When omitted, narration is enabled unless summary is enabled.
     * Set explicitly to override the default.
     */
    narration: z.boolean().optional(),

    /** Periodic summary notification options. Requires ollama config. */
    summary: z
      .object({
        /** Enable periodic summary notifications (default: false). */
        enabled: z.boolean(),
        /** Summary interval in ms (default: 60000). */
        intervalMs: z.number().int().positive().optional(),
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
  const xdgConfigHome =
    process.env["XDG_CONFIG_HOME"] ?? path.join(os.homedir(), ".config");
  return path.join(xdgConfigHome, "cc-voice-reporter", "config.json");
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
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
    content = await fs.promises.readFile(filePath, "utf-8");
  } catch (err) {
    if (isNodeError(err) && err.code === "ENOENT") {
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
  } catch {
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

/**
 * Merge a loaded config with CLI argument overrides into DaemonOptions.
 *
 * Priority: CLI args > config file > defaults (applied downstream).
 * Arrays (include/exclude) are replaced wholesale, not merged.
 */
export function resolveOptions(
  config: Config,
  cliArgs: { include?: string[]; exclude?: string[] },
): DaemonOptions {
  const filter: ProjectFilter = {};
  const includeSource = cliArgs.include ?? config.filter?.include;
  const excludeSource = cliArgs.exclude ?? config.filter?.exclude;
  if (includeSource) filter.include = includeSource;
  if (excludeSource) filter.exclude = excludeSource;

  let translation: TranslatorOptions | undefined;
  if (config.translation?.use === "ollama" && config.ollama) {
    translation = {
      outputLanguage: config.translation.outputLanguage,
      ollama: {
        model: config.ollama.model,
        baseUrl: config.ollama.baseUrl,
        timeoutMs: config.ollama.timeoutMs,
      },
    };
  }

  let summary: SummarizerOptions | undefined;
  if (config.summary?.enabled) {
    if (!config.ollama) {
      throw new Error(
        "summary feature requires ollama configuration. " +
          "Please add an 'ollama' section to your config file.",
      );
    }
    summary = {
      ollama: {
        model: config.ollama.model,
        baseUrl: config.ollama.baseUrl,
        timeoutMs: config.ollama.timeoutMs,
      },
      intervalMs: config.summary.intervalMs,
    };
  }

  // Narration default: disabled when summary is enabled, enabled otherwise.
  const narration =
    config.narration ?? !(config.summary?.enabled === true);

  return {
    watcher: {
      projectsDir: config.projectsDir,
      filter,
    },
    speaker: config.speaker,
    debounceMs: config.debounceMs,
    translation,
    summary,
    narration,
  };
}
