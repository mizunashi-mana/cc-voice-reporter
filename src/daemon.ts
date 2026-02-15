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
import { processLines, type ExtractedMessage } from "./parser.js";
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

  /** Buffered text per requestId, accumulated during debounce window. */
  private readonly textBuffer = new Map<string, string>();
  /** Debounce timers per requestId. */
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(options?: DaemonOptions) {
    this.debounceMs = options?.debounceMs ?? 500;

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
    this.speaker?.dispose();
  }

  /**
   * Handle new JSONL lines from the watcher.
   * Visible for testing.
   */
  handleLines(lines: string[]): void {
    const messages = processLines(lines);
    for (const msg of messages) {
      if (msg.kind === "text") {
        this.bufferText(msg.requestId, msg.text);
      } else {
        this.speakToolUse(msg);
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
      this.speakFn(text);
    }
    this.textBuffer.delete(requestId);
  }

  /** Format and speak a tool_use message immediately. */
  private speakToolUse(msg: ExtractedMessage): void {
    if (msg.kind !== "tool_use") return;
    this.speakFn(formatToolUse(msg.toolName, msg.toolInput));
  }

  private handleError(error: Error): void {
    process.stderr.write(`[cc-voice-reporter] ${error.message}\n`);
  }
}

// -- Tool use message formatting --

function basename(filePath: string): string {
  return filePath.split("/").pop() ?? filePath;
}

/**
 * Generate a Japanese speech message for a tool_use content block.
 */
export function formatToolUse(
  toolName: string,
  toolInput: Record<string, unknown>,
): string {
  switch (toolName) {
    case "Bash": {
      const desc = toolInput["description"];
      if (typeof desc === "string" && desc.length > 0) {
        return `コマンドを実行します。${desc}`;
      }
      return "コマンドを実行します";
    }
    case "Read": {
      const filePath = toolInput["file_path"];
      if (typeof filePath === "string") {
        return `${basename(filePath)} を読み取ります`;
      }
      return "ファイルを読み取ります";
    }
    case "Write": {
      const filePath = toolInput["file_path"];
      if (typeof filePath === "string") {
        return `${basename(filePath)} を作成します`;
      }
      return "ファイルを作成します";
    }
    case "Edit": {
      const filePath = toolInput["file_path"];
      if (typeof filePath === "string") {
        return `${basename(filePath)} を編集します`;
      }
      return "ファイルを編集します";
    }
    case "Grep": {
      const pattern = toolInput["pattern"];
      if (typeof pattern === "string") {
        return `${pattern} を検索します`;
      }
      return "コード検索を実行します";
    }
    case "Glob": {
      const pattern = toolInput["pattern"];
      if (typeof pattern === "string") {
        return `${pattern} でファイルを検索します`;
      }
      return "ファイル検索を実行します";
    }
    case "Task": {
      const desc = toolInput["description"];
      if (typeof desc === "string" && desc.length > 0) {
        return `サブエージェントを起動します。${desc}`;
      }
      return "サブエージェントを起動します";
    }
    case "WebFetch":
      return "Webページを取得します";
    case "WebSearch": {
      const query = toolInput["query"];
      if (typeof query === "string") {
        return `${query} をWeb検索します`;
      }
      return "Web検索を実行します";
    }
    default:
      return `${toolName} を実行します`;
  }
}

// -- CLI entry point --

async function main(): Promise<void> {
  const daemon = new Daemon();

  const shutdown = (): void => {
    process.stderr.write("[cc-voice-reporter] shutting down...\n");
    void daemon.stop().then(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await daemon.start();
  process.stderr.write("[cc-voice-reporter] daemon started\n");
}

main().catch((error: unknown) => {
  process.stderr.write(
    `[cc-voice-reporter] fatal: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
