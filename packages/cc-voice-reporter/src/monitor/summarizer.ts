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
import { buildPrompt, buildSystemPrompt } from './summarizer-prompt.js';
import type { Logger } from './logger.js';
import type { ActivityEvent } from './summarizer-events.js';

/** Default summary interval (5 seconds). */
const DEFAULT_INTERVAL_MS = 5_000;

/** Default timeout for Ollama API requests (60 seconds). */
const DEFAULT_TIMEOUT_MS = 60_000;

export interface SummarizerOptions {
  /** Ollama configuration. */
  ollama: {
    /** Model name (e.g., "gemma3"). */
    model: string;
    /** Ollama API base URL. */
    baseUrl: string;
    /** Request timeout in ms (default: 60000). */
    timeoutMs?: number;
  };
  /** Summary interval in ms (default: 5000). */
  intervalMs?: number;
  /**
   * Maximum number of events to include in the prompt.
   * When exceeded, text events are prioritised and older events are dropped.
   */
  maxPromptEvents: number;
  /** Output language code (e.g., "ja", "en"). Resolved from config by `resolveOptions`. */
  language: string;
}

/** Callback to speak a summary message. */
export type SummarySpeakFn = (message: string) => void;

/** Ollama /api/chat response schema (non-streaming). */
// eslint-disable-next-line @typescript-eslint/naming-convention -- Zod schema convention
const OllamaChatResponseSchema = z.object({
  message: z.object({
    content: z.string(),
  }),
});

/** Sentinel key for events without a session. */
const NO_SESSION = '';

export class Summarizer {
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly intervalMs: number;
  private readonly maxPromptEvents: number;
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
    this.baseUrl = options.ollama.baseUrl;
    this.timeoutMs = options.ollama.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.maxPromptEvents = options.maxPromptEvents;
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
      const prompt = buildPrompt(events, previousSummaries, this.maxPromptEvents);
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
