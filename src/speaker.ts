/**
 * Speaker module — queued speech output via macOS `say` command.
 *
 * Manages a FIFO queue of messages, executing `say` one at a time
 * (mutual exclusion). Supports text truncation for long messages
 * and graceful shutdown via dispose().
 */

import { execFile, type ChildProcess } from "node:child_process";

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
  private readonly queue: string[] = [];
  private currentProcess: ChildProcess | null = null;
  private disposed = false;
  private readonly maxLength: number;
  private readonly truncationSuffix: string;
  private readonly executor: (message: string) => ChildProcess;

  constructor(options?: SpeakerOptions) {
    this.maxLength = options?.maxLength ?? 200;
    this.truncationSuffix = options?.truncationSuffix ?? "、以下省略";
    this.executor =
      options?.executor ?? ((message) => execFile("say", [message]));
  }

  /** Enqueue a message for speech. Returns immediately. */
  speak(message: string): void {
    if (this.disposed) {
      return;
    }

    const truncated = this.truncate(message);
    this.queue.push(truncated);
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

  /** Process the next message in the queue if not already speaking. */
  private processQueue(): void {
    if (this.disposed || this.currentProcess !== null || this.queue.length === 0) {
      return;
    }

    const message = this.queue.shift()!;
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
