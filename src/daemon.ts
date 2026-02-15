/**
 * Daemon module — transcript .jsonl watcher + parser + speaker integration.
 *
 * Watches ~/.claude/projects/ for transcript file changes, parses new lines
 * into structured messages, and speaks them via the macOS `say` command.
 *
 * Text messages from the same requestId are debounced (buffered and combined)
 * to avoid speaking rapid partial updates separately.
 *
 * Each message is tagged with project info extracted from the file path.
 * The Speaker handles project-aware queue priority and project-switch
 * announcements.
 */

import {
  TranscriptWatcher,
  extractProjectDir,
  resolveProjectDisplayName,
  type WatcherOptions,
} from "./watcher.js";
import { processLines, type ParseOptions } from "./parser.js";
import { Speaker, type SpeakerOptions, type ProjectInfo } from "./speaker.js";

/** Interface for the speech output dependency. */
export interface SpeakFn {
  (message: string, project?: ProjectInfo): void;
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
  /**
   * Custom project display name resolver. Used for testing.
   * Default: resolveProjectDisplayName from watcher module.
   */
  resolveProjectName?: (encodedDir: string) => string;
}

export class Daemon {
  private readonly watcher: TranscriptWatcher;
  private readonly speaker: Speaker | null;
  private readonly speakFn: SpeakFn;
  private readonly debounceMs: number;
  private readonly parseOptions: ParseOptions;
  private readonly projectsDir: string;
  private readonly resolveProjectName: (encodedDir: string) => string;

  /** Buffered text per requestId, accumulated during debounce window. */
  private readonly textBuffer = new Map<string, string>();
  /** Debounce timers per requestId. */
  private readonly debounceTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  /** Project info per requestId, for tagging flushed messages. */
  private readonly requestProject = new Map<string, ProjectInfo>();
  /** Cache of resolved project display names to avoid repeated fs I/O. */
  private readonly displayNameCache = new Map<string, string>();

  constructor(options?: DaemonOptions) {
    this.debounceMs = options?.debounceMs ?? 500;
    this.projectsDir = options?.watcher?.projectsDir ?? "";
    this.resolveProjectName =
      options?.resolveProjectName ?? resolveProjectDisplayName;
    this.parseOptions = {
      onWarn: (msg) =>
        process.stderr.write(`[cc-voice-reporter] warn: ${msg}\n`),
    };

    if (options?.speakFn) {
      this.speaker = null;
      this.speakFn = options.speakFn;
    } else {
      this.speaker = new Speaker(options?.speaker);
      this.speakFn = (message, project) =>
        this.speaker!.speak(message, project);
    }

    this.watcher = new TranscriptWatcher(
      {
        onLines: (lines, filePath) => this.handleLines(lines, filePath),
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
  handleLines(lines: string[], filePath?: string): void {
    const project = this.resolveProject(filePath);

    const messages = processLines(lines, this.parseOptions);
    for (const msg of messages) {
      if (msg.kind === "text") {
        this.bufferText(msg.requestId, msg.text, project);
      } else if (
        msg.kind === "tool_use" &&
        msg.toolName === "AskUserQuestion"
      ) {
        const question = extractAskUserQuestion(msg.toolInput);
        if (question) {
          process.stderr.write(
            `[cc-voice-reporter] speak: AskUserQuestion (requestId=${msg.requestId})\n`,
          );
          this.speakFn(`確認待ち: ${question}`, project ?? undefined);
        }
      }
    }
  }

  /** Resolve project info from a file path. */
  private resolveProject(filePath?: string): ProjectInfo | null {
    if (!filePath || !this.projectsDir) return null;

    const dir = extractProjectDir(filePath, this.projectsDir);
    if (!dir) return null;

    let displayName = this.displayNameCache.get(dir);
    if (displayName === undefined) {
      displayName = this.resolveProjectName(dir);
      this.displayNameCache.set(dir, displayName);
    }

    return { dir, displayName };
  }

  /** Buffer a text message and reset the debounce timer. */
  private bufferText(
    requestId: string,
    text: string,
    project: ProjectInfo | null,
  ): void {
    const existing = this.textBuffer.get(requestId) ?? "";
    this.textBuffer.set(requestId, existing + text);

    if (project !== null) {
      this.requestProject.set(requestId, project);
    }

    // Reset debounce timer
    const existingTimer = this.debounceTimers.get(requestId);
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer);
    }

    this.debounceTimers.set(
      requestId,
      setTimeout(() => {
        this.debounceTimers.delete(requestId);
        this.flushText(requestId);
      }, this.debounceMs),
    );
  }

  /** Flush buffered text for a requestId and speak it. */
  private flushText(requestId: string): void {
    const text = this.textBuffer.get(requestId);
    const project = this.requestProject.get(requestId);
    if (text !== undefined && text.length > 0) {
      process.stderr.write(
        `[cc-voice-reporter] speak: text (requestId=${requestId})\n`,
      );
      this.speakFn(text, project);
    }
    this.textBuffer.delete(requestId);
    this.requestProject.delete(requestId);
  }

  private handleError(error: Error): void {
    process.stderr.write(`[cc-voice-reporter] ${error.message}\n`);
  }
}

/**
 * Extract the question text from an AskUserQuestion tool_use input.
 * Returns null if the input doesn't contain valid questions.
 */
function extractAskUserQuestion(
  input: Record<string, unknown>,
): string | null {
  const questions = input["questions"];
  if (!Array.isArray(questions) || questions.length === 0) return null;

  const texts: string[] = [];
  for (const q of questions) {
    if (
      typeof q === "object" &&
      q !== null &&
      "question" in q &&
      typeof (q as Record<string, unknown>)["question"] === "string"
    ) {
      texts.push((q as Record<string, unknown>)["question"] as string);
    }
  }

  return texts.length > 0 ? texts.join(" ") : null;
}
