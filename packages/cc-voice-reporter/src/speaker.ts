/**
 * Speaker module — queued speech output via macOS `say` command.
 *
 * Manages a FIFO queue of messages, executing `say` one at a time
 * (mutual exclusion). Supports text truncation for long messages
 * and graceful shutdown via dispose().
 *
 * When messages are tagged with project/session info, the speaker prioritizes
 * messages from the same project and session. On project change, it announces
 * the new project name before speaking the message.
 */

import { execFile, type ChildProcess } from 'node:child_process';

/** Project identity attached to a queued message. */
export interface ProjectInfo {
  /** Encoded project directory name (used for comparison). */
  dir: string;
  /** Human-readable project name (used for announcement). */
  displayName: string;
}

/** Internal queue item. */
interface QueueItem {
  message: string;
  project: ProjectInfo | null;
  session: string | null;
}

/** Default speech command when none is configured. */
const DEFAULT_COMMAND: readonly string[] = ['say'];

export interface SpeakerOptions {
  /**
   * Command and fixed arguments for speech output (default: ["say"]).
   * The message is appended as the last argument at runtime.
   * Example: ["say", "-v", "Kyoko"] → execFile("say", ["-v", "Kyoko", message])
   */
  command?: string[];
  /** Maximum character length before truncation (default: Infinity — no truncation). */
  maxLength?: number;
  /** Suffix inserted between head and tail when truncated (default: "、中略、"). */
  truncationSeparator?: string;
  /**
   * Custom executor for speaking a message. Receives the (already truncated)
   * message and returns a ChildProcess. Used for testing.
   * When provided, this takes precedence over `command`.
   * Default: `execFile(command[0], [...command.slice(1), message])`.
   */
  executor?: (message: string) => ChildProcess;
}

export class Speaker {
  private readonly queue: QueueItem[] = [];
  private currentProcess: ChildProcess | null = null;
  private disposed = false;
  private readonly maxLength: number;
  private readonly truncationSeparator: string;
  private readonly executor: (message: string) => ChildProcess;

  /** The project directory of the most recently spoken message. */
  private currentProject: string | null = null;
  /** The session identifier of the most recently spoken message. */
  private currentSession: string | null = null;

  constructor(options?: SpeakerOptions) {
    this.maxLength = options?.maxLength ?? Infinity;
    this.truncationSeparator = options?.truncationSeparator ?? '、中略、';
    const cmd = options?.command ?? DEFAULT_COMMAND;
    const [bin = 'say', ...fixedArgs] = cmd;
    this.executor
      = options?.executor
        ?? (message => execFile(bin, [...fixedArgs, message]));
  }

  /** Enqueue a message for speech. Returns immediately. */
  speak(message: string, project?: ProjectInfo, session?: string): void {
    if (this.disposed) {
      return;
    }

    const truncated = this.truncate(message);
    this.queue.push({
      message: truncated,
      project: project ?? null,
      session: session ?? null,
    });
    this.processQueue();
  }

  /** Clear the queue. Does not stop the currently speaking message. */
  clear(): void {
    this.queue.length = 0;
  }

  /**
   * Gracefully stop the speaker: clear the queue, wait for the currently
   * speaking message to finish, then prevent further speech.
   * After resolution, speak() becomes a no-op.
   */
  async stopGracefully(): Promise<void> {
    this.disposed = true;
    this.queue.length = 0;

    const proc = this.currentProcess;
    if (proc === null) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const onDone = (): void => resolve();
      proc.on('close', onDone);
      proc.on('error', onDone);
    });
  }

  /**
   * Stop current speech, clear the queue, and prevent further speech.
   * After calling dispose(), speak() becomes a no-op.
   */
  dispose(): void {
    this.disposed = true;
    this.queue.length = 0;
    if (this.currentProcess) {
      this.currentProcess.kill();
      this.currentProcess = null;
    }
  }

  /** Number of messages waiting in the queue (not including current). */
  get pending(): number {
    return this.queue.length;
  }

  /** Whether a message is currently being spoken. */
  get isSpeaking(): boolean {
    return this.currentProcess !== null;
  }

  /** Truncate message using middle-ellipsis if it exceeds maxLength. */
  private truncate(message: string): string {
    if (message.length <= this.maxLength) {
      return message;
    }
    const half = Math.floor(this.maxLength / 2);
    return (
      message.slice(0, half)
      + this.truncationSeparator
      + message.slice(-half)
    );
  }

  /**
   * Dequeue the next item with three-level priority:
   *   1. Same project + same session
   *   2. Same project (any session)
   *   3. FIFO
   */
  private dequeueNext(): QueueItem | undefined {
    if (this.queue.length === 0) return undefined;

    if (this.currentProject !== null) {
      // Level 1: same project + same session
      if (this.currentSession !== null) {
        const sessionIdx = this.queue.findIndex(
          item =>
            item.project !== null
            && item.project.dir === this.currentProject
            && item.session === this.currentSession,
        );
        if (sessionIdx !== -1) {
          return this.queue.splice(sessionIdx, 1)[0];
        }
      }

      // Level 2: same project (any session)
      const projectIdx = this.queue.findIndex(
        item =>
          item.project !== null && item.project.dir === this.currentProject,
      );
      if (projectIdx !== -1) {
        return this.queue.splice(projectIdx, 1)[0];
      }
    }

    return this.queue.shift();
  }

  /** Process the next message in the queue if not already speaking. */
  private processQueue(): void {
    if (
      this.disposed
      || this.currentProcess !== null
      || this.queue.length === 0
    ) {
      return;
    }

    const item = this.dequeueNext();
    if (!item) return;

    if (item.project !== null) {
      if (this.currentProject === null) {
        // First project — set without announcement
        this.currentProject = item.project.dir;
      }
      else if (item.project.dir !== this.currentProject) {
        // Project changed — announce before speaking the message
        this.currentProject = item.project.dir;
        this.queue.unshift(item);
        this.executeSpeak(
          `プロジェクト${item.project.displayName}の実行内容を再生します`,
        );
        return;
      }
      this.currentSession = item.session;
    }

    this.executeSpeak(item.message);
  }

  /** Execute the say command for a single message. */
  private executeSpeak(message: string): void {
    this.currentProcess = this.executor(message);

    let done = false;
    const onDone = (): void => {
      if (done) return;
      done = true;
      this.currentProcess = null;
      this.processQueue();
    };

    this.currentProcess.on('close', onDone);
    this.currentProcess.on('error', onDone);
  }
}
