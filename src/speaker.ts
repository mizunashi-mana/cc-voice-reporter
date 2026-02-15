/**
 * Speaker module — queued speech output via macOS `say` command.
 *
 * Manages a FIFO queue of messages, executing `say` one at a time
 * (mutual exclusion). Supports text truncation for long messages
 * and graceful shutdown via dispose().
 *
 * When messages are tagged with project info, the speaker prioritizes
 * messages from the same project. On project change, it announces
 * the new project name before speaking the message.
 */

import { execFile, type ChildProcess } from "node:child_process";

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
}

export interface SpeakerOptions {
  /** Maximum character length before truncation (default: 200). */
  maxLength?: number;
  /** Suffix appended when a message is truncated (default: "、以下省略"). */
  truncationSuffix?: string;
  /**
   * Custom executor for speaking a message. Receives the (already truncated)
   * message and returns a ChildProcess. Used for testing.
   * Default: `execFile("say", [message])`.
   */
  executor?: (message: string) => ChildProcess;
}

export class Speaker {
  private readonly queue: QueueItem[] = [];
  private currentProcess: ChildProcess | null = null;
  private disposed = false;
  private readonly maxLength: number;
  private readonly truncationSuffix: string;
  private readonly executor: (message: string) => ChildProcess;

  /** The project directory of the most recently spoken message. */
  private currentProject: string | null = null;

  constructor(options?: SpeakerOptions) {
    this.maxLength = options?.maxLength ?? 200;
    this.truncationSuffix = options?.truncationSuffix ?? "、以下省略";
    this.executor =
      options?.executor ?? ((message) => execFile("say", [message]));
  }

  /** Enqueue a message for speech. Returns immediately. */
  speak(message: string, project?: ProjectInfo): void {
    if (this.disposed) {
      return;
    }

    const truncated = this.truncate(message);
    this.queue.push({ message: truncated, project: project ?? null });
    this.processQueue();
  }

  /** Clear the queue. Does not stop the currently speaking message. */
  clear(): void {
    this.queue.length = 0;
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

  /** Truncate message if it exceeds maxLength. */
  private truncate(message: string): string {
    if (message.length <= this.maxLength) {
      return message;
    }
    return message.slice(0, this.maxLength) + this.truncationSuffix;
  }

  /**
   * Dequeue the next item, prioritizing messages from the current project.
   * If no same-project messages remain, returns the first item in the queue.
   */
  private dequeueNext(): QueueItem | undefined {
    if (this.queue.length === 0) return undefined;

    if (this.currentProject !== null) {
      const idx = this.queue.findIndex(
        (item) =>
          item.project !== null && item.project.dir === this.currentProject,
      );
      if (idx !== -1) {
        return this.queue.splice(idx, 1)[0];
      }
    }

    return this.queue.shift();
  }

  /** Process the next message in the queue if not already speaking. */
  private processQueue(): void {
    if (
      this.disposed ||
      this.currentProcess !== null ||
      this.queue.length === 0
    ) {
      return;
    }

    const item = this.dequeueNext();
    if (!item) return;

    if (item.project !== null) {
      if (this.currentProject === null) {
        // First project — set without announcement
        this.currentProject = item.project.dir;
      } else if (item.project.dir !== this.currentProject) {
        // Project changed — announce before speaking the message
        this.currentProject = item.project.dir;
        this.queue.unshift(item);
        this.executeSpeak(
          `プロジェクト${item.project.displayName}の実行内容を再生します`,
        );
        return;
      }
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

    this.currentProcess.on("close", onDone);
    this.currentProcess.on("error", onDone);
  }
}
