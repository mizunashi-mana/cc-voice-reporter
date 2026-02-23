/**
 * Summarizer module — event-driven activity summary via Ollama.
 *
 * Collects tool_use and text events from the Daemon and generates
 * natural-language summaries using Ollama's /api/chat endpoint.
 *
 * Summary generation is triggered by:
 * 1. Explicit flush (before turn_complete / AskUserQuestion notifications)
 * 2. Throttled timer when text events are recorded (mid-turn commentary)
 *
 * When idle (no events), no Ollama calls or speech output occur.
 *
 * Requires Ollama to be configured and running. If summary generation
 * fails, the error is logged and operation continues.
 */

import { z } from 'zod';
import { getMessages, type Messages } from './messages.js';
import type { Logger } from './logger.js';

/** Default summary interval (5 seconds). */
const DEFAULT_INTERVAL_MS = 5_000;

/** Default timeout for Ollama API requests (60 seconds). */
const DEFAULT_TIMEOUT_MS = 60_000;

export interface SummarizerOptions {
  /** Ollama configuration. */
  ollama: {
    /** Model name (e.g., "gemma3"). */
    model: string;
    /** Ollama API base URL (default: "http://localhost:11434"). */
    baseUrl?: string;
    /** Request timeout in ms (default: 60000). */
    timeoutMs?: number;
  };
  /** Summary interval in ms (default: 5000). */
  intervalMs?: number;
  /** Output language code (e.g., "ja", "en"). Resolved from config by `resolveOptions`. */
  language: string;
}

/** A recorded tool_use event. */
export interface ToolUseEvent {
  kind: 'tool_use';
  toolName: string;
  /** Brief description extracted from tool input (e.g., file path). */
  detail: string;
  /** Session identifier for session-scoped context. */
  session?: string;
}

/** A recorded text response event. */
export interface TextEvent {
  kind: 'text';
  /** First portion of the text response. */
  snippet: string;
  /** Session identifier for session-scoped context. */
  session?: string;
}

export type ActivityEvent = ToolUseEvent | TextEvent;

/** Callback to speak a summary message. */
export type SummarySpeakFn = (message: string) => void;

/** Ollama /api/chat response schema (non-streaming). */
// eslint-disable-next-line @typescript-eslint/naming-convention -- Zod schema convention
const OllamaChatResponseSchema = z.object({
  message: z.object({
    content: z.string(),
  }),
});

/** Maximum snippet length for text events. */
const MAX_SNIPPET_LENGTH = 80;

/** Sentinel key for events without a session. */
const NO_SESSION = '';

export class Summarizer {
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly intervalMs: number;
  private readonly systemPrompt: string;
  private readonly speakFn: SummarySpeakFn;
  private readonly logger: Logger;
  private readonly messages: Messages;

  /** Events accumulated per session. */
  private readonly eventsBySession = new Map<string, ActivityEvent[]>();
  /** Throttle timer for mid-turn summaries triggered by text events. */
  private throttleTimer: ReturnType<typeof setTimeout> | null = null;
  /** Whether event-driven mode is active. */
  private active = false;
  /**
   * Promise chain that serializes flush operations.
   * Each flush is chained on this to prevent concurrent Ollama requests.
   */
  private flushLock: Promise<void> = Promise.resolve();
  /** Previous summary texts keyed by session ID (up to 2 most recent). */
  private readonly lastSummariesBySession = new Map<string, string[]>();

  constructor(
    options: SummarizerOptions,
    speakFn: SummarySpeakFn,
    logger: Logger,
  ) {
    this.model = options.ollama.model;
    this.baseUrl = options.ollama.baseUrl ?? 'http://localhost:11434';
    this.timeoutMs = options.ollama.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.systemPrompt = buildSystemPrompt(options.language);
    this.speakFn = speakFn;
    this.logger = logger;
    this.messages = getMessages(options.language);
    this.logger.debug(`summary system prompt: ${this.systemPrompt}`);
  }

  /**
   * Record an activity event.
   * Events are stored per session (using event.session).
   * When `trigger` is true and the summarizer is active, a throttled
   * flush is scheduled (for mid-turn commentary during long turns).
   */
  record(event: ActivityEvent, trigger?: boolean): void {
    const session = event.session ?? NO_SESSION;
    const list = this.eventsBySession.get(session);
    if (list) {
      list.push(event);
    }
    else {
      this.eventsBySession.set(session, [event]);
    }
    if (trigger === true && this.active) {
      this.scheduleThrottledFlush();
    }
  }

  /** Enable event-driven mode. No timer is created until events trigger it. */
  start(): void {
    this.active = true;
  }

  /** Stop the summarizer: cancel any scheduled throttle timer. */
  stop(): void {
    this.active = false;
    this.cancelThrottleTimer();
  }

  /** Total number of recorded events across all sessions. */
  get pendingEvents(): number {
    let total = 0;
    for (const list of this.eventsBySession.values()) {
      total += list.length;
    }
    return total;
  }

  /**
   * Flush collected events: generate a summary per session and speak it.
   * If no events were collected, does nothing.
   * Cancels any pending throttle timer since events are being flushed.
   *
   * Flushes are serialized via a promise chain to prevent concurrent
   * Ollama requests. If called while a previous flush is in progress,
   * the call waits for it to complete, then processes accumulated events.
   *
   * Visible for testing.
   */
  async flush(): Promise<void> {
    this.cancelThrottleTimer();

    const job = this.flushLock.then(async () => this.doFlush());
    this.flushLock = job.catch(() => {});
    await job;
  }

  /**
   * Execute a single flush: for each session with events, snapshot events,
   * call Ollama with the previous summary as context, and speak result.
   */
  private async doFlush(): Promise<void> {
    const sessions = [...this.eventsBySession.keys()];
    if (sessions.length === 0) return;

    for (const session of sessions) {
      const events = this.eventsBySession.get(session);
      if (!events || events.length === 0) continue;
      this.eventsBySession.delete(session);

      const previousSummaries = this.lastSummariesBySession.get(session);
      const prompt = buildPrompt(events, previousSummaries);
      this.logger.debug(`summary prompt (session=${session !== '' ? session : '(none)'}):\n${prompt}`);

      try {
        const summary = await this.callOllama(prompt);
        this.logger.debug(`summary result (session=${session !== '' ? session : '(none)'}): ${summary}`);
        if (summary.length > 0) {
          const history = this.lastSummariesBySession.get(session) ?? [];
          history.push(summary);
          if (history.length > 2) {
            history.shift();
          }
          this.lastSummariesBySession.set(session, history);
          this.speakFn(summary);
        }
      }
      catch (error) {
        this.logger.warn(
          `summary error: ${error instanceof Error ? error.message : String(error)}`,
        );
        this.speakFn(this.messages.summaryFailed(events.length));
      }
    }
  }

  /** Schedule a throttled flush if one is not already pending. */
  private scheduleThrottledFlush(): void {
    if (this.throttleTimer !== null) return;
    this.throttleTimer = setTimeout(() => {
      this.throttleTimer = null;
      void this.flush().then(() => {
        // After flush completes, reschedule if events accumulated during flush
        if (this.active && this.pendingEvents > 0) {
          this.scheduleThrottledFlush();
        }
      });
    }, this.intervalMs);
  }

  /** Cancel the pending throttle timer. */
  private cancelThrottleTimer(): void {
    if (this.throttleTimer !== null) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
  }

  /** Call Ollama /api/chat and return the summary text. */
  private async callOllama(userPrompt: string): Promise<string> {
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
              content: this.systemPrompt,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json: unknown = await response.json();
      const result = OllamaChatResponseSchema.safeParse(json);
      if (!result.success) {
        throw new Error('invalid response format');
      }

      return result.data.message.content.trim();
    }
    finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Map a language code to a human-readable language name for LLM prompts.
 * Falls back to the code itself for unmapped languages.
 * Exported for testing.
 */
export function resolveLanguageName(code: string): string {
  const map: Record<string, string> = {
    ja: 'Japanese',
    en: 'English',
    zh: 'Chinese',
    ko: 'Korean',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    pt: 'Portuguese',
    ru: 'Russian',
  };
  return map[code] ?? code;
}

/**
 * Build the system prompt for the narration-style summary.
 * The language parameter determines the output language.
 * Exported for testing.
 */
export function buildSystemPrompt(language: string): string {
  const langName = resolveLanguageName(language);
  return [
    'You are Claude Code, an AI coding assistant.',
    'You will receive a log of your recent actions (tool calls and text outputs), and optionally up to two previous narrations for context.',
    'Narrate what you are doing in the first person, as a brief live commentary.',
    'When previous narrations are provided, build on them — maintain a consistent tone and style, describe what changed since then and how the work is progressing, rather than repeating what was already said.',
    'Consider the flow and story of the work — not just listing operations, but explaining the intent behind them.',
    'Keep it to 1-2 short sentences, suitable for text-to-speech.',
    'Preserve file names, command names, and code elements as-is.',
    `Output in ${langName} only. Output ONLY the narration, nothing else.`,
  ].join(' ');
}

/**
 * Build a prompt describing the collected activity events.
 * When previousSummaries are provided, they are included as context
 * so the LLM can build on the narrative continuity.
 * Exported for testing.
 */
export function buildPrompt(
  events: ActivityEvent[],
  previousSummaries?: string[],
): string {
  const lines: string[] = [];

  const summaries = previousSummaries?.filter(s => s.length > 0) ?? [];
  if (summaries.length > 0) {
    lines.push(`Previous narration: ${summaries.map(ensureTrailingDelimiter).join(' ')}`);
    lines.push('');
  }

  lines.push('Recent actions:');

  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (event === undefined) continue;
    lines.push('---');
    const step = `${i + 1}.`;
    if (event.kind === 'tool_use') {
      if (event.detail.length > 0) {
        lines.push(`${step} ${event.toolName}: ${event.detail}`);
      }
      else {
        lines.push(`${step} ${event.toolName}`);
      }
    }
    else {
      lines.push(`${step} Text output: ${event.snippet}`);
    }
  }

  return lines.join('\n');
}

/**
 * Extract a brief detail string from a tool_use input.
 * Returns an empty string if no useful detail is found.
 * Exported for testing.
 */
export function extractToolDetail(
  toolName: string,
  input: Record<string, unknown>,
): string {
  switch (toolName) {
    case 'Read':
    case 'Write':
      return typeof input.file_path === 'string'
        ? (input.file_path)
        : '';
    case 'Edit':
      return typeof input.file_path === 'string'
        ? (input.file_path)
        : '';
    case 'NotebookEdit':
      return typeof input.notebook_path === 'string'
        ? (input.notebook_path)
        : '';
    case 'Bash':
      return typeof input.command === 'string'
        ? (input.command)
        : '';
    case 'Grep':
    case 'Glob': {
      const pattern
        = typeof input.pattern === 'string' ? (input.pattern) : '';
      const path
        = typeof input.path === 'string' ? (input.path) : '';
      return path.length > 0 ? `${pattern} in ${path}` : pattern;
    }
    default:
      return '';
  }
}

/**
 * Create an ActivityEvent from a parsed ExtractedToolUse message.
 * Exported for use by Daemon.
 */
export function createToolUseEvent(
  toolName: string,
  toolInput: Record<string, unknown>,
  session?: string,
): ToolUseEvent {
  return {
    kind: 'tool_use',
    toolName,
    detail: extractToolDetail(toolName, toolInput),
    session,
  };
}

/**
 * Create an ActivityEvent from a text message snippet.
 * Exported for use by Daemon.
 */
export function createTextEvent(text: string, session?: string): TextEvent {
  const snippet
    = text.length > MAX_SNIPPET_LENGTH
      ? `${text.slice(0, MAX_SNIPPET_LENGTH)}…`
      : text;
  return {
    kind: 'text',
    snippet,
    session,
  };
}

/** Characters that count as sentence-ending delimiters. */
const SENTENCE_DELIMITERS = '。.,？?！!';

/**
 * Ensure a text string ends with a sentence delimiter.
 * If the trimmed text does not end with one of the recognised delimiters,
 * a period (`.`) is appended.
 * Exported for testing and for use by Daemon.
 */
export function ensureTrailingDelimiter(text: string): string {
  const trimmed = text.trimEnd();
  if (trimmed.length === 0) return text;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- length > 0 guarantees last char exists
  if (SENTENCE_DELIMITERS.includes(trimmed[trimmed.length - 1]!)) {
    return trimmed;
  }
  return `${trimmed}.`;
}
