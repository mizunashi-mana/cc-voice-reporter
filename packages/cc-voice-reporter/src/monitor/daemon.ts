/**
 * Daemon module — transcript .jsonl watcher + parser + speaker integration.
 *
 * Watches ~/.claude/projects/ for transcript file changes, parses new lines
 * into structured messages, and provides turn-complete / AskUserQuestion
 * notifications via the Speaker (configurable speech command).
 *
 * Per-message text narration is not performed; instead, periodic summaries
 * (via Summarizer) provide activity commentary.
 *
 * Each message is tagged with project info extracted from the file path.
 * The Speaker handles project-aware queue priority and project-switch
 * announcements.
 */

import { z } from 'zod';
import { getMessages, type Messages } from './messages.js';
import { processLines, type ParseOptions } from './parser.js';
import { Speaker, type SpeakerOptions, type ProjectInfo } from './speaker.js';
import {
  Summarizer,
  createToolUseEvent,
  createTextEvent,
  ensureTrailingDelimiter,
  type SummarizerOptions,
} from './summarizer.js';
import {
  TranscriptWatcher,
  extractProjectDir,
  extractSessionId,
  resolveProjectDisplayName,
  isSubagentFile,
  DEFAULT_PROJECTS_DIR,
  type WatcherOptions,
} from './watcher.js';
import type { Logger } from './logger.js';

/** Interface for the speech output dependency. */
export type SpeakFn = (message: string, project?: ProjectInfo, session?: string) => void;

export interface DaemonOptions {
  /** Logger instance. */
  logger: Logger;
  /**
   * Language code for voice messages (e.g., "ja", "en").
   * Controls which locale's message catalog is used for turn-complete
   * notifications, AskUserQuestion prompts, and project-switch announcements.
   * Resolved from config by `resolveOptions` (default: "en").
   */
  language: string;
  /** Options forwarded to TranscriptWatcher (logger is provided by Daemon). */
  watcher?: Omit<WatcherOptions, 'logger'>;
  /**
   * Options forwarded to Speaker (config-level subset; projectSwitchAnnouncement and executor are added by Daemon).
   * Required when `speakFn` is not provided. The CLI layer resolves the command
   * via auto-detection or explicit config before passing it here.
   */
  speaker?: Omit<SpeakerOptions, 'projectSwitchAnnouncement' | 'executor'>;
  /** Summary options. If omitted, periodic summarization is disabled. */
  summary?: SummarizerOptions;
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
  private readonly logger: Logger;
  private readonly messages: Messages;
  private readonly watcher: TranscriptWatcher;
  private readonly speaker: Speaker | null;
  private readonly speakFn: SpeakFn;
  private readonly summarizer: Summarizer | null;
  private readonly parseOptions: ParseOptions;
  private readonly projectsDir: string;
  private readonly resolveProjectName: (encodedDir: string) => string;

  /** Cache of resolved project display names to avoid repeated fs I/O. */
  private readonly displayNameCache = new Map<string, string>();

  /**
   * Per-session flag for turn-complete notification cancellation.
   * Set to `false` when turn_complete is detected, and set to `true`
   * when subsequent activity (text, tool_use, user_response) arrives in the
   * same session. Checked after the async summary flush — if `true`, the
   * notification is skipped because a new turn has started.
   */
  private readonly turnCompleteCancelled = new Map<string, boolean>();

  /**
   * Per-session flag for AskUserQuestion cancellation.
   * Set to `false` when a new AskUserQuestion is detected, and set to `true`
   * when subsequent activity (text, tool_use, user_response) arrives in the
   * same session. Checked after the async summary flush — if `true`, the
   * speech is skipped because the user has already responded.
   */
  private readonly askQuestionCancelled = new Map<string, boolean>();

  constructor(options: DaemonOptions) {
    this.logger = options.logger;
    this.messages = getMessages(options.language);
    this.projectsDir
      = options.watcher?.projectsDir ?? DEFAULT_PROJECTS_DIR;
    this.resolveProjectName
      = options.resolveProjectName ?? resolveProjectDisplayName;
    this.parseOptions = {
      onWarn: msg => this.logger.warn(msg),
    };

    if (options.speakFn) {
      this.speaker = null;
      this.speakFn = options.speakFn;
    }
    else if (options.speaker) {
      const speakerOpts: SpeakerOptions = {
        ...options.speaker,
        projectSwitchAnnouncement: this.messages.projectSwitch,
      };
      const speaker = new Speaker(speakerOpts);
      this.speaker = speaker;
      this.speakFn = (message, project, session) =>
        speaker.speak(message, project, session);
    }
    else {
      throw new Error(
        'Daemon requires either speakFn or speaker.command to be provided.',
      );
    }

    if (options.summary) {
      this.summarizer = new Summarizer(
        options.summary,
        message => this.speakFn(message),
        this.logger,
      );
    }
    else {
      this.summarizer = null;
    }

    this.watcher = new TranscriptWatcher(
      {
        onLines: (lines, filePath) => this.handleLines(lines, filePath),
        onError: error => this.handleError(error),
      },
      {
        ...options.watcher,
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
   * Gracefully stop the daemon: close the watcher,
   * and wait for the current speech to finish.
   */
  async stop(): Promise<void> {
    this.summarizer?.stop();
    await this.watcher.close();
    if (this.speaker) {
      await this.speaker.stopGracefully();
    }
  }

  /**
   * Force-stop the daemon immediately:
   * kill the current speech process, and close the watcher.
   */
  forceStop(): void {
    this.summarizer?.stop();
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
    const isSubagent = filePath !== undefined ? isSubagentFile(filePath) : false;

    const sessionKey = session ?? '';
    const messages = processLines(lines, this.parseOptions);

    // Defer AskUserQuestion handling until after all other messages in the
    // same batch have been processed.  This ensures text events are recorded
    // by the summarizer first so that the summary flush preceding the
    // confirmation announcement includes the latest context.
    const deferredAskQuestions: Array<{ toolInput: Record<string, unknown>; requestId: string }> = [];

    for (const msg of messages) {
      if (msg.kind === 'text') {
        // New assistant activity cancels any pending turn-complete notification
        // and any pending AskUserQuestion notification for this session.
        this.cancelTurnComplete(sessionKey);
        this.cancelAskQuestion(sessionKey);
        // Text events trigger throttled summary (mid-turn commentary).
        this.summarizer?.record(
          createTextEvent(msg.text, session ?? undefined),
          true,
        );
      }
      else if (msg.kind === 'turn_complete') {
        if (!isSubagent) {
          this.handleTurnComplete(project, session);
        }
      }
      else if (msg.kind === 'user_response') {
        // User has responded — cancel any pending AskUserQuestion and
        // turn-complete notification for this session.
        this.cancelTurnComplete(sessionKey);
        this.cancelAskQuestion(sessionKey);
      }
      else {
        // New tool activity cancels any pending turn-complete notification
        // and any pending AskUserQuestion notification for this session.
        this.cancelTurnComplete(sessionKey);
        this.cancelAskQuestion(sessionKey);
        this.summarizer?.record(
          createToolUseEvent(msg.toolName, msg.toolInput, session ?? undefined),
        );
        if (msg.toolName === 'AskUserQuestion') {
          deferredAskQuestions.push({ toolInput: msg.toolInput, requestId: msg.requestId });
        }
      }
    }

    // Process deferred AskUserQuestion messages after all other messages.
    for (const ask of deferredAskQuestions) {
      this.handleAskUserQuestion(ask.toolInput, ask.requestId, project, session);
    }
  }

  /**
   * Handle turn completion: flush summary, then speak notification.
   * Order: summary → "入力待ちです"
   */
  private handleTurnComplete(
    project: ProjectInfo | null,
    session: string | null,
  ): void {
    const sessionKey = session ?? '';
    this.turnCompleteCancelled.set(sessionKey, false);

    const speakNotification = (): void => {
      if (this.turnCompleteCancelled.get(sessionKey) === true) {
        this.logger.debug(
          'skip: turn complete notification suppressed (new turn started)',
        );
        return;
      }
      this.logger.debug('speak: turn complete');
      this.speakFn(
        this.messages.turnComplete,
        project ?? undefined,
        session ?? undefined,
      );
    };

    // When summarizer is present, flush it first, then speak the notification.
    if (this.summarizer) {
      void this.summarizer
        .flush()
        .then(speakNotification)
        .catch((err: unknown) => {
          this.handleError(
            err instanceof Error ? err : new Error(String(err)),
          );
        });
      return;
    }

    speakNotification();
  }

  /**
   * Handle AskUserQuestion: flush summary, then speak the question.
   * Order: summary → "確認待ち: {question}"
   *
   * Uses the askQuestionCancelled flag to detect if the user has already
   * responded (or new activity has arrived) during the async summary flush.
   * If cancelled, the speech is skipped.
   */
  private handleAskUserQuestion(
    toolInput: Record<string, unknown>,
    requestId: string,
    project: ProjectInfo | null,
    session: string | null,
  ): void {
    const question = extractAskUserQuestion(toolInput);
    if (question === null) return;

    const sessionKey = session ?? '';
    this.askQuestionCancelled.set(sessionKey, false);

    const speakQuestion = (): void => {
      if (this.askQuestionCancelled.get(sessionKey) === true) {
        this.logger.debug(
          `skip: AskUserQuestion suppressed (user already responded, requestId=${requestId})`,
        );
        return;
      }
      this.logger.debug(`speak: AskUserQuestion (requestId=${requestId})`);
      this.speakFn(
        this.messages.askUserQuestion(question),
        project ?? undefined,
        session ?? undefined,
      );
    };

    // When summarizer is present, flush it first, then speak.
    if (this.summarizer) {
      void this.summarizer
        .flush()
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

  /** Resolve project info from a file path. */
  private resolveProject(filePath?: string): ProjectInfo | null {
    if (filePath === undefined || filePath === '' || this.projectsDir === '') return null;

    const dir = extractProjectDir(filePath, this.projectsDir);
    if (dir === null) return null;

    let displayName = this.displayNameCache.get(dir);
    if (displayName === undefined) {
      displayName = this.resolveProjectName(dir);
      this.displayNameCache.set(dir, displayName);
    }

    return { dir, displayName };
  }

  /** Resolve session identifier from a file path. */
  private resolveSession(filePath?: string): string | null {
    if (filePath === undefined || filePath === '' || this.projectsDir === '') return null;
    return extractSessionId(filePath, this.projectsDir);
  }

  /** Mark the pending turn-complete notification as cancelled for the given session. */
  private cancelTurnComplete(sessionKey: string): void {
    this.turnCompleteCancelled.set(sessionKey, true);
  }

  /** Mark the pending AskUserQuestion as cancelled for the given session. */
  private cancelAskQuestion(sessionKey: string): void {
    this.askQuestionCancelled.set(sessionKey, true);
  }

  private handleError(error: Error): void {
    this.logger.error(error.message);
  }
}

/** Schema for AskUserQuestion input validation. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- Zod schema convention
const AskUserQuestionInputSchema = z.object({
  questions: z
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- z.passthrough() is the current stable API
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

  return result.data.questions.map(q => ensureTrailingDelimiter(q.question)).join(' ');
}
