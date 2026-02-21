/**
 * Translator module — translates text using Ollama's local LLM API.
 *
 * Uses Ollama's /api/chat endpoint to translate text to the configured
 * output language. Falls back to the original text on any error
 * (graceful degradation).
 */

import { z } from 'zod';
import type { Logger } from './logger.js';

/** Default timeout for Ollama API requests (60 seconds). */
const DEFAULT_TIMEOUT_MS = 60_000;

export interface TranslatorOptions {
  /** Target language for translation (e.g., "ja", "en"). */
  outputLanguage: string;
  /** Ollama configuration. */
  ollama: {
    /** Model name (e.g., "gemma3", "translategemma"). */
    model: string;
    /** Ollama API base URL (default: "http://localhost:11434"). */
    baseUrl?: string;
    /** Request timeout in ms (default: 60000). */
    timeoutMs?: number;
  };
}

/** Ollama /api/chat response schema (non-streaming). */
// eslint-disable-next-line @typescript-eslint/naming-convention -- Zod schema convention
const OllamaChatResponseSchema = z.object({
  message: z.object({
    content: z.string(),
  }),
});

export class Translator {
  private readonly outputLanguage: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly logger: Logger;

  constructor(
    options: TranslatorOptions,
    logger: Logger,
  ) {
    this.outputLanguage = options.outputLanguage;
    this.model = options.ollama.model;
    this.baseUrl = options.ollama.baseUrl ?? 'http://localhost:11434';
    this.timeoutMs = options.ollama.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.logger = logger;
  }

  /**
   * Translate text to the configured output language.
   * Returns the original text on any failure (graceful degradation).
   */
  async translate(text: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: [
                `You are a translator. Translate the following text to ${this.outputLanguage}.`,
                `If the text is already in ${this.outputLanguage}, return it as-is.`,
                `For mixed-language text, translate foreign-language parts to ${this.outputLanguage}.`,
                `Preserve code elements (file names, function names, variable names) as-is.`,
                `Output ONLY the translated text, nothing else.`,
              ].join(' '),
            },
            {
              role: 'user',
              content: text,
            },
          ],
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.warn(`translation error: HTTP ${response.status}`);
        return text;
      }

      const json: unknown = await response.json();
      const result = OllamaChatResponseSchema.safeParse(json);
      if (!result.success) {
        this.logger.warn('translation error: invalid response format');
        return text;
      }

      return result.data.message.content.trim();
    }
    catch (error) {
      this.logger.warn(
        `translation error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return text;
    }
    finally {
      clearTimeout(timeout);
    }
  }
}
