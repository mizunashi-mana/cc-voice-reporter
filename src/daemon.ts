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

import { z } from "zod";
import { Logger, type LogLevel } from "./logger.js";
import {
  TranscriptWatcher,
  extractProjectDir,
  extractSessionId,
  resolveProjectDisplayName,
  isSubagentFile,
  DEFAULT_PROJECTS_DIR,
  type WatcherOptions,
} from "./watcher.js";
import { processLines, type ParseOptions } from "./parser.js";
import { Speaker, type SpeakerOptions, type ProjectInfo } from "./speaker.js";
import {
  Summarizer,
  createToolUseEvent,
  createTextEvent,
  type SummarizerOptions,
} from "./summarizer.js";
import { Translator, type TranslatorOptions } from "./translator.js";

/** Interface for the speech output dependency. */
export interface SpeakFn {
  (message: string, project?: ProjectInfo, session?: string): void;
}

/** Interface for the translation dependency. */
export interface TranslateFn {
  (text: string): Promise<string>;
}

export interface DaemonOptions {
  /** Log level (default: "info"). */
  logLevel?: LogLevel;
  /** Options forwarded to TranscriptWatcher. */
  watcher?: WatcherOptions;
  /** Options forwarded to Speaker. */
  speaker?: SpeakerOptions;
  /** Debounce interval in ms for text messages (default: 500). */
  debounceMs?: number;
  /** Translation options. If omitted, translation is disabled. */
  translation?: TranslatorOptions;
  /** Summary options. If omitted, periodic summarization is disabled. */
  summary?: SummarizerOptions;
  /**
   * Enable per-message narration (default: true).
   * When false, individual text/tool messages are not spoken.
   * Summary notifications and turn-complete notifications still work.
   */
  narration?: boolean;
  /**
   * Custom speak function. If provided, overrides Speaker creation.
   * Used for testing.
   */
  speakFn?: SpeakFn;
  /**
   * Custom translate function. If provided, overrides Translator creation.
   * Used for testing.
   */
  translateFn?: TranslateFn;
  /**
   * Custom project display name resolver. Used for testing.
   * Default: resolveProjectDisplayName from watcher module.
   */
  resolveProjectName?: (encodedDir: string) => string;
}

export class Daemon {
  private readonly logger: Logger;
  private readonly watcher: TranscriptWatcher;
  private readonly speaker: Speaker | null;
  private readonly speakFn: SpeakFn;
  private readonly translateFn: TranslateFn | null;
  private readonly summarizer: Summarizer | null;
  private readonly narration: boolean;
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
  /** Session ID per requestId. */
  private readonly requestSession = new Map<string, string>();
  /** Cache of resolved project display names to avoid repeated fs I/O. */
  private readonly displayNameCache = new Map<string, string>();
  /** Ordered queue of pending translations, processed front-to-back. */
  private readonly translationQueue: Array<{
    promise: Promise<string>;
    originalText: string;
    speak: (translated: string) => void;
  }> = [];
  /** Whether the translation drain loop is currently running. */
  private isDraining = false;
  /** Promise that resolves when the current drain cycle completes. Null when idle. */
  private drainPromise: Promise<void> | null = null;

  constructor(options?: DaemonOptions) {
    this.logger = new Logger({ level: options?.logLevel });
    this.narration = options?.narration ?? true;
    this.debounceMs = options?.debounceMs ?? 500;
    this.projectsDir =
      options?.watcher?.projectsDir ?? DEFAULT_PROJECTS_DIR;
    this.resolveProjectName =
      options?.resolveProjectName ?? resolveProjectDisplayName;
    this.parseOptions = {
      onWarn: (msg) => this.logger.warn(msg),
    };

    if (options?.speakFn) {
      this.speaker = null;
      this.speakFn = options.speakFn;
    } else {
      this.speaker = new Speaker(options?.speaker);
      this.speakFn = (message, project, session) =>
        this.speaker!.speak(message, project, session);
    }

    if (options?.translateFn) {
      this.translateFn = options.translateFn;
    } else if (options?.translation) {
      const translator = new Translator(options.translation, (msg) =>
        this.logger.warn(msg),
      );
      this.translateFn = (text) => translator.translate(text);
    } else {
      this.translateFn = null;
    }

    if (options?.summary) {
      this.summarizer = new Summarizer(
        options.summary,
        (message) => this.speakFn(message),
        (msg) => this.logger.warn(msg),
      );
    } else {
      this.summarizer = null;
    }

    this.watcher = new TranscriptWatcher(
      {
        onLines: (lines, filePath) => this.handleLines(lines, filePath),
        onError: (error) => this.handleError(error),
      },
      {
        ...options?.watcher,
        resolveProjectName: this.resolveProjectName,
        logger: this.logger,
      },
    );
  }

  /** Start watching transcript files and event-driven summarizer. */
  async start(): Promise<void> {
    await this.watcher.start();
    this.summarizer?.start();
  }

  /**
   * Gracefully stop the daemon: cancel pending debounce timers,
   * close the watcher, and wait for the current speech to finish.
   * New messages are not flushed to the speaker queue.
   */
  async stop(): Promise<void> {
    this.summarizer?.stop();
    this.cancelPendingTimers();
    await this.watcher.close();
    if (this.speaker) {
      await this.speaker.stopGracefully();
    }
  }

  /**
   * Force-stop the daemon immediately: cancel pending timers,
   * kill the current speech process, and close the watcher.
   */
  forceStop(): void {
    this.summarizer?.stop();
    this.cancelPendingTimers();
    this.speaker?.dispose();
    void this.watcher.close();
  }

  /**
   * Handle new JSONL lines from the watcher.
   * Visible for testing.
   */
  handleLines(lines: string[], filePath?: string): void {
    const project = this.resolveProject(filePath);
    const session = this.resolveSession(filePath);
    const isSubagent = filePath ? isSubagentFile(filePath) : false;

    const messages = processLines(lines, this.parseOptions);
    for (const msg of messages) {
      if (msg.kind === "text") {
        if (this.narration) {
          this.bufferText(msg.requestId, msg.text, project, session);
        }
        // Text events trigger throttled summary (mid-turn commentary).
        this.summarizer?.record(
          createTextEvent(msg.text),
          true,
          session ?? undefined,
        );
      } else if (msg.kind === "turn_complete") {
        if (!isSubagent) {
          this.handleTurnComplete(project, session);
        }
      } else if (msg.kind === "tool_use") {
        this.summarizer?.record(
          createToolUseEvent(msg.toolName, msg.toolInput),
          undefined,
          session ?? undefined,
        );
        if (msg.toolName === "AskUserQuestion") {
          this.handleAskUserQuestion(msg.toolInput, msg.requestId, project, session);
        }
      }
    }
  }

  /**
   * Handle turn completion: flush summary and pending text, then speak notification.
   * Order: summary → translated text → "入力待ちです"
   */
  private handleTurnComplete(
    project: ProjectInfo | null,
    session: string | null,
  ): void {
    this.flushAllPendingText();

    const speakNotification = (): void => {
      this.logger.debug("speak: turn complete");
      this.speakFn(
        "入力待ちです",
        project ?? undefined,
        session ?? undefined,
      );
    };

    // When summarizer is present, flush it first, then wait for
    // translations, then speak the notification.
    if (this.summarizer) {
      void this.summarizer
        .flush(session ?? undefined)
        .then(() => this.drainPromise ?? Promise.resolve())
        .then(speakNotification)
        .catch((err: unknown) => {
          this.handleError(
            err instanceof Error ? err : new Error(String(err)),
          );
        });
      return;
    }

    // No summarizer: wait for any active translations, then speak.
    if (this.drainPromise) {
      void this.drainPromise
        .then(speakNotification)
        .catch((err: unknown) => {
          this.handleError(
            err instanceof Error ? err : new Error(String(err)),
          );
        });
    } else {
      speakNotification();
    }
  }

  /**
   * Handle AskUserQuestion: flush summary, then speak the question.
   * Order: summary → "確認待ち: {question}"
   */
  private handleAskUserQuestion(
    toolInput: Record<string, unknown>,
    requestId: string,
    project: ProjectInfo | null,
    session: string | null,
  ): void {
    const question = extractAskUserQuestion(toolInput);
    if (!question) return;

    const speakQuestion = (): void => {
      if (this.narration) {
        this.speakTranslated(
          question,
          (translated) => `確認待ち: ${translated}`,
          "AskUserQuestion",
          requestId,
          project,
          session,
        );
      }
    };

    // When summarizer is present, flush it first, then speak.
    if (this.summarizer) {
      void this.summarizer
        .flush(session ?? undefined)
        .then(speakQuestion)
        .catch((err: unknown) => {
          this.handleError(
            err instanceof Error ? err : new Error(String(err)),
          );
        });
      return;
    }

    speakQuestion();
  }

  /** Cancel all pending debounce timers without flushing text. */
  private cancelPendingTimers(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.textBuffer.clear();
    this.requestProject.clear();
    this.requestSession.clear();
  }

  /** Flush all pending debounced text immediately. */
  private flushAllPendingText(): void {
    for (const [requestId, timer] of this.debounceTimers) {
      clearTimeout(timer);
      this.flushText(requestId);
    }
    this.debounceTimers.clear();
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

  /** Resolve session identifier from a file path. */
  private resolveSession(filePath?: string): string | null {
    if (!filePath || !this.projectsDir) return null;
    return extractSessionId(filePath, this.projectsDir);
  }

  /** Buffer a text message and reset the debounce timer. */
  private bufferText(
    requestId: string,
    text: string,
    project: ProjectInfo | null,
    session: string | null,
  ): void {
    const existing = this.textBuffer.get(requestId) ?? "";
    this.textBuffer.set(requestId, existing + text);

    if (project !== null) {
      this.requestProject.set(requestId, project);
    }
    if (session !== null) {
      this.requestSession.set(requestId, session);
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

  /** Flush buffered text for a requestId and speak it (with optional translation). */
  private flushText(requestId: string): void {
    const text = this.textBuffer.get(requestId);
    const project = this.requestProject.get(requestId);
    const session = this.requestSession.get(requestId);
    this.textBuffer.delete(requestId);
    this.requestProject.delete(requestId);
    this.requestSession.delete(requestId);

    if (text === undefined || text.length === 0) return;

    if (this.translateFn) {
      this.logger.debug(`translation start: ${text}`);
      const promise = this.translateFn(text);
      this.enqueueTranslation(promise, text, (translated) => {
        this.logger.debug(`speak: text (requestId=${requestId})`);
        this.speakFn(translated, project, session);
      });
    } else {
      this.logger.debug(`speak: text (requestId=${requestId})`);
      this.speakFn(text, project, session);
    }
  }

  /** Translate text (if configured) and speak with a wrapper. */
  private speakTranslated(
    text: string,
    wrap: (translated: string) => string,
    label: string,
    requestId: string,
    project: ProjectInfo | null,
    session: string | null,
  ): void {
    const speak = (translated: string): void => {
      this.logger.debug(`speak: ${label} (requestId=${requestId})`);
      this.speakFn(
        wrap(translated),
        project ?? undefined,
        session ?? undefined,
      );
    };

    if (this.translateFn) {
      this.logger.debug(`translation start: ${text}`);
      const promise = this.translateFn(text);
      this.enqueueTranslation(promise, text, speak);
    } else {
      speak(text);
    }
  }

  /** Enqueue a translation and start draining if not already running. */
  private enqueueTranslation(
    promise: Promise<string>,
    originalText: string,
    speak: (translated: string) => void,
  ): void {
    this.translationQueue.push({ promise, originalText, speak });
    this.startDrain();
  }

  /** Start draining the translation queue if not already running. */
  private startDrain(): void {
    if (this.isDraining) return;
    if (this.translationQueue.length === 0) return;
    this.isDraining = true;
    this.drainPromise = this.doDrain();
  }

  /** Process the translation queue front-to-back, preserving message order. */
  private async doDrain(): Promise<void> {
    try {
      while (this.translationQueue.length > 0) {
        const item = this.translationQueue[0]!;
        try {
          const translated = await item.promise;
          this.logger.debug(
            `translation done: ${item.originalText} -> ${translated}`,
          );
          item.speak(translated);
        } catch (err: unknown) {
          this.handleError(
            err instanceof Error ? err : new Error(String(err)),
          );
        }
        this.translationQueue.shift();
      }
    } finally {
      this.isDraining = false;
      this.drainPromise = null;
    }
  }

  private handleError(error: Error): void {
    this.logger.error(error.message);
  }
}

/** Schema for AskUserQuestion input validation. */
const AskUserQuestionInputSchema = z.object({
  questions: z
    .array(z.object({ question: z.string() }).passthrough())
    .min(1),
});

/**
 * Extract the question text from an AskUserQuestion tool_use input.
 * Returns null if the input doesn't contain valid questions.
 */
function extractAskUserQuestion(
  input: Record<string, unknown>,
): string | null {
  const result = AskUserQuestionInputSchema.safeParse(input);
  if (!result.success) return null;

  return result.data.questions.map((q) => q.question).join(" ");
}
