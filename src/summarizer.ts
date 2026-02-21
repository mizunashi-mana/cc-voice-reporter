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

import { z } from "zod";
import { Logger } from "./logger.js";

/** Default summary interval (1 second). */
const DEFAULT_INTERVAL_MS = 1_000;

/** Default timeout for Ollama API requests (30 seconds). */
const DEFAULT_TIMEOUT_MS = 30_000;

export interface SummarizerOptions {
  /** Ollama configuration. */
  ollama: {
    /** Model name (e.g., "gemma3"). */
    model: string;
    /** Ollama API base URL (default: "http://localhost:11434"). */
    baseUrl?: string;
    /** Request timeout in ms (default: 30000). */
    timeoutMs?: number;
  };
  /** Summary interval in ms (default: 60000). */
  intervalMs?: number;
}

/** A recorded tool_use event. */
export interface ToolUseEvent {
  kind: "tool_use";
  toolName: string;
  /** Brief description extracted from tool input (e.g., file path). */
  detail: string;
}

/** A recorded text response event. */
export interface TextEvent {
  kind: "text";
  /** First portion of the text response. */
  snippet: string;
}

export type ActivityEvent = ToolUseEvent | TextEvent;

/** Callback to speak a summary message. */
export interface SummarySpeakFn {
  (message: string): void;
}

/** Ollama /api/chat response schema (non-streaming). */
const OllamaChatResponseSchema = z.object({
  message: z.object({
    content: z.string(),
  }),
});

/** Maximum snippet length for text events. */
const MAX_SNIPPET_LENGTH = 80;

export class Summarizer {
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly intervalMs: number;
  private readonly speakFn: SummarySpeakFn;
  private readonly onWarn: (msg: string) => void;

  private readonly events: ActivityEvent[] = [];
  /** Throttle timer for mid-turn summaries triggered by text events. */
  private throttleTimer: ReturnType<typeof setTimeout> | null = null;
  /** Whether event-driven mode is active. */
  private active = false;

  constructor(
    options: SummarizerOptions,
    speakFn: SummarySpeakFn,
    onWarn?: (msg: string) => void,
  ) {
    this.model = options.ollama.model;
    this.baseUrl = options.ollama.baseUrl ?? "http://localhost:11434";
    this.timeoutMs = options.ollama.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.speakFn = speakFn;
    const defaultLogger = new Logger();
    this.onWarn = onWarn ?? ((msg) => defaultLogger.warn(msg));
  }

  /**
   * Record an activity event.
   * When `trigger` is true and the summarizer is active, a throttled
   * flush is scheduled (for mid-turn commentary during long turns).
   */
  record(event: ActivityEvent, trigger?: boolean): void {
    this.events.push(event);
    if (trigger && this.active) {
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

  /** Number of recorded events. */
  get pendingEvents(): number {
    return this.events.length;
  }

  /**
   * Flush collected events: generate a summary and speak it.
   * If no events were collected, does nothing.
   * Cancels any pending throttle timer since events are being flushed.
   * Visible for testing.
   */
  async flush(): Promise<void> {
    this.cancelThrottleTimer();

    if (this.events.length === 0) return;

    const snapshot = this.events.splice(0);
    const prompt = buildPrompt(snapshot);

    try {
      const summary = await this.callOllama(prompt);
      if (summary.length > 0) {
        this.speakFn(summary);
      }
    } catch (error) {
      this.onWarn(
        `summary error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Schedule a throttled flush if one is not already pending. */
  private scheduleThrottledFlush(): void {
    if (this.throttleTimer !== null) return;
    this.throttleTimer = setTimeout(() => {
      this.throttleTimer = null;
      void this.flush();
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "system",
              content: [
                "あなたはClaude Code（AIコーディングアシスタント）の操作を要約するアシスタントです。",
                "ユーザーから操作リストが与えられるので、日本語で1〜2文に要約してください。",
                "音声読み上げ用なので、簡潔に要点だけを述べてください。",
                "ファイル名やコマンドはそのまま含めてください。",
                "要約のみを出力してください。",
              ].join(""),
            },
            {
              role: "user",
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
        throw new Error("invalid response format");
      }

      return result.data.message.content.trim();
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Build a prompt describing the collected activity events.
 * Exported for testing.
 */
export function buildPrompt(events: ActivityEvent[]): string {
  const lines: string[] = ["直近のClaude Codeの操作:"];

  for (const event of events) {
    if (event.kind === "tool_use") {
      if (event.detail) {
        lines.push(`- ${event.toolName}: ${event.detail}`);
      } else {
        lines.push(`- ${event.toolName}`);
      }
    } else {
      lines.push(`- テキスト応答: ${event.snippet}`);
    }
  }

  return lines.join("\n");
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
    case "Read":
    case "Write":
      return typeof input["file_path"] === "string"
        ? (input["file_path"])
        : "";
    case "Edit":
      return typeof input["file_path"] === "string"
        ? (input["file_path"])
        : "";
    case "NotebookEdit":
      return typeof input["notebook_path"] === "string"
        ? (input["notebook_path"])
        : "";
    case "Bash":
      return typeof input["command"] === "string"
        ? (input["command"])
        : "";
    case "Grep":
    case "Glob": {
      const pattern =
        typeof input["pattern"] === "string" ? (input["pattern"]) : "";
      const path =
        typeof input["path"] === "string" ? (input["path"]) : "";
      return path ? `${pattern} in ${path}` : pattern;
    }
    default:
      return "";
  }
}

/**
 * Create an ActivityEvent from a parsed ExtractedToolUse message.
 * Exported for use by Daemon.
 */
export function createToolUseEvent(
  toolName: string,
  toolInput: Record<string, unknown>,
): ToolUseEvent {
  return {
    kind: "tool_use",
    toolName,
    detail: extractToolDetail(toolName, toolInput),
  };
}

/**
 * Create an ActivityEvent from a text message snippet.
 * Exported for use by Daemon.
 */
export function createTextEvent(text: string): TextEvent {
  const snippet =
    text.length > MAX_SNIPPET_LENGTH
      ? text.slice(0, MAX_SNIPPET_LENGTH) + "…"
      : text;
  return {
    kind: "text",
    snippet,
  };
}
