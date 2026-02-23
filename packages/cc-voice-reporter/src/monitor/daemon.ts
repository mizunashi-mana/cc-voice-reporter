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

import { extractAskUserQuestion } from './ask-question-parser.js';
import { HookWatcher, type HookEvent } from './hook-watcher.js';
import { getMessages, type Messages } from './messages.js';
import {
  dispatchNotification,
} from './notification-dispatcher.js';
import {
  NotificationStateManager,
  notificationCancelTag,
  LEVEL_TURN_COMPLETE,
  LEVEL_PERMISSION_PROMPT,
  LEVEL_IDLE_PROMPT,
  LEVEL_ASK_QUESTION,
} from './notification-state.js';
import { processLines, type ParseOptions } from './parser.js';
import { Speaker, type SpeakerOptions, type ProjectInfo } from './speaker.js';
import { createToolUseEvent, createTextEvent } from './summarizer-events.js';
import { Summarizer, type SummarizerOptions } from './summarizer.js';
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
export type SpeakFn = (message: string, project?: ProjectInfo, session?: string, cancelTag?: string) => void;

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
   * Directory containing hook data files written by the hook-receiver command.
   * If provided, the daemon watches this directory and processes hook events
   * (e.g., permission_prompt and idle_prompt notifications).
   */
  hooksDir?: string;
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
  private readonly hookWatcher: HookWatcher | null;
  private readonly speaker: Speaker | null;
  private readonly speakFn: SpeakFn;
  private readonly summarizer: Summarizer | null;
  private readonly parseOptions: ParseOptions;
  private readonly projectsDir: string;
  private readonly resolveProjectName: (encodedDir: string) => string;
  private readonly notificationState = new NotificationStateManager();

  /** Cache of resolved project display names to avoid repeated fs I/O. */
  private readonly displayNameCache = new Map<string, string>();

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
      this.speakFn = (message, project, session, cancelTag) =>
        speaker.speak(message, project, session, cancelTag);
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

    if (options.hooksDir !== undefined && options.hooksDir !== '') {
      this.hookWatcher = new HookWatcher(
        {
          onEvents: events => this.handleHookEvents(events),
          onError: error => this.handleError(error),
        },
        {
          hooksDir: options.hooksDir,
          logger: this.logger,
        },
      );
    }
    else {
      this.hookWatcher = null;
    }
  }

  /** Start watching transcript files, hook files, and event-driven summarizer. */
  async start(): Promise<void> {
    await this.watcher.start();
    await this.hookWatcher?.start();
    this.summarizer?.start();
  }

  /**
   * Gracefully stop the daemon: close the watchers,
   * and wait for the current speech to finish.
   */
  async stop(): Promise<void> {
    this.summarizer?.stop();
    await this.hookWatcher?.close();
    await this.watcher.close();
    if (this.speaker) {
      await this.speaker.stopGracefully();
    }
  }

  /**
   * Force-stop the daemon immediately:
   * kill the current speech process, and close the watchers.
   */
  forceStop(): void {
    this.summarizer?.stop();
    this.speaker?.dispose();
    void this.hookWatcher?.close();
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
    const deferredAskQuestions: Array<{
      toolInput: Record<string, unknown>;
      requestId: string;
    }> = [];

    // Track whether a user_response appeared in this batch.
    // When set, all deferred AskUserQuestions are suppressed because
    // the user has already responded before the questions were dispatched.
    let userRespondedInBatch = false;

    for (const msg of messages) {
      if (msg.kind === 'text') {
        // New assistant activity cancels any pending notifications for this session.
        this.cancelActivity(sessionKey);
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
        // User has responded — cancel any pending notifications for this session.
        this.cancelActivity(sessionKey);
        userRespondedInBatch = true;
      }
      else {
        // New tool activity cancels any pending notifications for this session.
        this.cancelActivity(sessionKey);
        this.summarizer?.record(
          createToolUseEvent(msg.toolName, msg.toolInput, session ?? undefined),
        );
        if (msg.toolName === 'AskUserQuestion') {
          deferredAskQuestions.push({
            toolInput: msg.toolInput,
            requestId: msg.requestId,
          });
        }
      }
    }

    // Process deferred AskUserQuestion messages after all other messages.
    // Skip if a user_response was seen in the same batch (intra-batch cancellation).
    if (!userRespondedInBatch) {
      for (const ask of deferredAskQuestions) {
        this.handleAskUserQuestion(ask.toolInput, ask.requestId, project, session);
      }
    }
  }

  /** Handle turn completion: flush summary, then speak notification. */
  private handleTurnComplete(
    project: ProjectInfo | null,
    session: string | null,
  ): void {
    this.dispatch({
      sessionKey: session ?? '',
      level: LEVEL_TURN_COMPLETE,
      message: this.messages.turnComplete,
      project,
      session,
      debugLabel: 'turn complete',
      flushSummary: true,
    });
  }

  /** Handle AskUserQuestion: flush summary, then speak the question. */
  private handleAskUserQuestion(
    toolInput: Record<string, unknown>,
    requestId: string,
    project: ProjectInfo | null,
    session: string | null,
  ): void {
    const question = extractAskUserQuestion(toolInput);
    if (question === null) return;

    this.dispatch({
      sessionKey: session ?? '',
      level: LEVEL_ASK_QUESTION,
      message: this.messages.askUserQuestion(question),
      project,
      session,
      debugLabel: `AskUserQuestion (requestId=${requestId})`,
      flushSummary: true,
    });
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

  /**
   * Cancel all pending notifications for the given session.
   * Called when new activity (text, tool_use, user_response) arrives.
   */
  private cancelActivity(sessionKey: string): void {
    this.notificationState.cancelActivity(sessionKey);
    this.speaker?.cancelByTag(notificationCancelTag(sessionKey));
  }

  /**
   * Handle hook events from the HookWatcher.
   * Notification events with idle_prompt or permission_prompt trigger
   * permission request announcements, subject to the notification priority system.
   * Visible for testing.
   */
  handleHookEvents(events: HookEvent[]): void {
    for (const event of events) {
      if (event.hookEventName !== 'Notification') continue;

      const project = this.resolveProject(event.transcriptPath);
      const session = this.resolveSession(event.transcriptPath);

      if (event.notificationType === 'idle_prompt') {
        this.dispatch({
          sessionKey: event.sessionId,
          level: LEVEL_IDLE_PROMPT,
          message: this.messages.permissionRequest,
          project,
          session,
          debugLabel: `permission prompt via idle_prompt (session=${event.sessionId})`,
          flushSummary: false,
        });
      }
      else if (event.notificationType === 'permission_prompt') {
        this.dispatch({
          sessionKey: event.sessionId,
          level: LEVEL_PERMISSION_PROMPT,
          message: this.messages.permissionRequest,
          project,
          session,
          debugLabel: `permission prompt via permission_prompt (session=${event.sessionId})`,
          flushSummary: false,
        });
      }
    }
  }

  /** Dispatch a notification via the extracted dispatcher module. */
  private dispatch(params: {
    sessionKey: string;
    level: number;
    message: string;
    project: ProjectInfo | null;
    session: string | null;
    debugLabel: string;
    flushSummary: boolean;
  }): void {
    dispatchNotification(params, {
      notificationState: this.notificationState,
      speakFn: this.speakFn,
      summarizer: this.summarizer,
      logger: this.logger,
      onError: err => this.handleError(err),
    });
  }

  private handleError(error: Error): void {
    this.logger.error(error.message);
  }
}
