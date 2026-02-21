/**
 * Ollama model resolution for the CLI.
 *
 * Queries the Ollama API to list available models and resolves the
 * model to use for summarization:
 *   - If a model is specified in config, validates it is available.
 *   - If no model is specified, picks the first available model.
 */

import { z } from 'zod';
import type { Config } from './config.js';

const DEFAULT_BASE_URL = 'http://localhost:11434';

/** Ollama /api/tags response schema. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- Zod schema convention
const OllamaTagsResponseSchema = z.object({
  models: z.array(
    z.object({
      name: z.string(),
    }),
  ),
});

/**
 * Fetch available model names from the Ollama API.
 *
 * Calls `GET /api/tags` and returns a list of model names.
 * Throws if the API is unreachable or returns an unexpected format.
 */
async function listModels(baseUrl: string): Promise<string[]> {
  const response = await fetch(`${baseUrl}/api/tags`);
  if (!response.ok) {
    throw new Error(`Ollama API returned HTTP ${response.status}`);
  }
  const json: unknown = await response.json();
  const result = OllamaTagsResponseSchema.safeParse(json);
  if (!result.success) {
    throw new Error('Unexpected response format from Ollama /api/tags');
  }
  return result.data.models.map(m => m.name);
}

export interface OllamaModelResolution {
  /** Resolved model name. */
  model: string;
}

/**
 * Resolve the Ollama model to use for summarization.
 *
 * - If `config.ollama.model` is specified, validates it against available models.
 * - If not specified, picks the first available model from Ollama.
 * - Returns `undefined` if ollama/summary is not configured (no resolution needed).
 *
 * Throws on:
 * - Ollama API unreachable
 * - Specified model not found in available models
 * - No models available when auto-detecting
 */
export async function resolveOllamaModel(
  config: Config,
): Promise<string | undefined> {
  // No resolution needed if ollama is not configured
  if (config.ollama === undefined) return undefined;

  const baseUrl = config.ollama.baseUrl ?? DEFAULT_BASE_URL;
  const specifiedModel = config.ollama.model;

  let models: string[];
  try {
    models = await listModels(baseUrl);
  }
  catch (error) {
    throw new Error(
      `Failed to connect to Ollama at ${baseUrl}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (specifiedModel !== undefined) {
    // Validate the specified model is available.
    // Allow matching by exact name or by base name (e.g., "gemma3" matches "gemma3:latest").
    const found = models.some(
      m => m === specifiedModel || m.split(':')[0] === specifiedModel,
    );
    if (!found) {
      throw new Error(
        `Ollama model "${specifiedModel}" is not available. `
        + `Available models: ${models.length > 0 ? models.join(', ') : '(none)'}`,
      );
    }
    return specifiedModel;
  }

  // Auto-detect: pick the first available model
  const first = models[0];
  if (first === undefined) {
    throw new Error(
      'No Ollama models available. Please pull a model first: ollama pull <model>',
    );
  }
  return first;
}
