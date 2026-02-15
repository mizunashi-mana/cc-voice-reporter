/**
 * Daemon module — transcript .jsonl watcher + parser + speaker integration.
 *
 * Watches ~/.claude/projects/ for transcript file changes, parses new lines
 * into structured messages, and speaks them via the macOS `say` command.
 *
 * Text messages from the same requestId are debounced (buffered and combined)
 * to avoid speaking rapid partial updates separately. Tool use messages are
 * spoken immediately.
 */

import { TranscriptWatcher, type WatcherOptions } from "./watcher.js";
import { processLines, type ParseOptions } from "./parser.js";
import { Speaker, type SpeakerOptions } from "./speaker.js";

/** Interface for the speech output dependency. */
export interface SpeakFn {
  (message: string): void;
}

export interface DaemonOptions {
  /** Options forwarded to TranscriptWatcher. */
  watcher?: WatcherOptions;
  /** Options forwarded to Speaker. */
  speaker?: SpeakerOptions;
  /** Debounce interval in ms for text messages (default: 500). */
  debounceMs?: number;
  /**
   * Custom speak function. If provided, overrides Speaker creation.
   * Used for testing.
   */
  speakFn?: SpeakFn;
}

export class Daemon {
  private readonly watcher: TranscriptWatcher;
  private readonly speaker: Speaker | null;
  private readonly speakFn: SpeakFn;
  private readonly debounceMs: number;
  private readonly parseOptions: ParseOptions;

  /** Buffered text per requestId, accumulated during debounce window. */
  private readonly textBuffer = new Map<string, string>();
  /** Debounce timers per requestId. */
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(options?: DaemonOptions) {
    this.debounceMs = options?.debounceMs ?? 500;
    this.parseOptions = {
      onWarn: (msg) =>
        process.stderr.write(`[cc-voice-reporter] warn: ${msg}\n`),
    };

    if (options?.speakFn) {
      this.speaker = null;
      this.speakFn = options.speakFn;
    } else {
      this.speaker = new Speaker(options?.speaker);
      this.speakFn = (message) => this.speaker!.speak(message);
    }

    this.watcher = new TranscriptWatcher(
      {
        onLines: (lines) => this.handleLines(lines),
        onError: (error) => this.handleError(error),
      },
      options?.watcher,
    );
  }

  /** Start watching transcript files. */
  async start(): Promise<void> {
    await this.watcher.start();
  }

  /** Stop watching and flush pending text to the speaker queue. */
  async stop(): Promise<void> {
    // Flush all pending debounced text before stopping
    for (const [requestId, timer] of this.debounceTimers) {
      clearTimeout(timer);
      this.flushText(requestId);
    }
    this.debounceTimers.clear();

    await this.watcher.close();
  }

  /**
   * Handle new JSONL lines from the watcher.
   * Visible for testing.
   */
  handleLines(lines: string[]): void {
    const messages = processLines(lines, this.parseOptions);
    for (const msg of messages) {
      if (msg.kind === "text") {
        this.bufferText(msg.requestId, msg.text);
      }
    }
  }

  /** Buffer a text message and reset the debounce timer. */
  private bufferText(requestId: string, text: string): void {
    const existing = this.textBuffer.get(requestId) ?? "";
    this.textBuffer.set(requestId, existing + text);

    // Reset debounce timer
    const existingTimer = this.debounceTimers.get(requestId);
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer);
    }

    this.debounceTimers.set(
      requestId,
      setTimeout(() => {
        this.flushText(requestId);
        this.debounceTimers.delete(requestId);
      }, this.debounceMs),
    );
  }

  /** Flush buffered text for a requestId and speak it. */
  private flushText(requestId: string): void {
    const text = this.textBuffer.get(requestId);
    if (text !== undefined && text.length > 0) {
      process.stderr.write(
        `[cc-voice-reporter] speak: text (requestId=${requestId})\n`,
      );
      this.speakFn(text);
    }
    this.textBuffer.delete(requestId);
  }

  private handleError(error: Error): void {
    process.stderr.write(`[cc-voice-reporter] ${error.message}\n`);
  }
}

