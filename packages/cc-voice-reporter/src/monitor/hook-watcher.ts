/**
 * HookWatcher — watches the hooks data directory for new hook events.
 *
 * Monitors {hooksDir}/*.jsonl files written by the hook-receiver command,
 * reading new lines as they are appended (tail logic). Each line is a JSON
 * hook event from Claude Code.
 *
 * The watcher uses chokidar for file monitoring and tracks byte positions
 * to emit only newly appended complete lines.
 */

import * as fs from 'node:fs';
import chokidar, { type FSWatcher } from 'chokidar';
import { z } from 'zod';
import type { Logger } from './logger.js';

/**
 * Parsed hook event with validated fields.
 * Only fields relevant to the monitor are extracted; the rest is discarded.
 */
export interface HookEvent {
  sessionId: string;
  hookEventName: string;
  /** Present for Notification events (e.g., "permission_prompt", "idle_prompt"). */
  notificationType?: string;
  /** Notification message text. */
  message?: string;
}

/**
 * Minimal schema for hook event parsing.
 * Uses looseObject to accept any additional fields from Claude Code.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- Zod schema convention
const HookEventSchema = z.looseObject({
  session_id: z.string(),
  hook_event_name: z.string(),
  notification_type: z.string().optional(),
  message: z.string().optional(),
});

/** Parse a single JSONL line into a HookEvent. Returns null on failure. */
export function parseHookEvent(line: string): HookEvent | null {
  let json: unknown;
  try {
    json = JSON.parse(line);
  }
  catch {
    return null;
  }

  const result = HookEventSchema.safeParse(json);
  if (!result.success) return null;

  return {
    sessionId: result.data.session_id,
    hookEventName: result.data.hook_event_name,
    notificationType: result.data.notification_type,
    message: result.data.message,
  };
}

export interface HookWatcherCallbacks {
  /** Called when new hook events are parsed from a file. */
  onEvents: (events: HookEvent[]) => void;
  /** Called when an error occurs during watching or reading. */
  onError?: (error: Error) => void;
}

export interface HookWatcherOptions {
  /** Directory containing hook JSONL files. */
  hooksDir: string;
  /** Logger instance. */
  logger: Logger;
}

/**
 * Watches a hooks directory for .jsonl file changes and emits parsed
 * hook events as they are appended.
 *
 * - During initial scan, existing file content is skipped.
 * - After ready, new files are read from the beginning.
 * - Only complete lines (terminated by newline) are emitted.
 * - File truncation is detected and position is reset.
 */
export class HookWatcher {
  private watcher: FSWatcher | null = null;
  private readonly filePositions = new Map<string, number>();
  private ready = false;
  private readonly logger: Logger;
  private readonly hooksDir: string;
  private readonly callbacks: HookWatcherCallbacks;

  constructor(callbacks: HookWatcherCallbacks, options: HookWatcherOptions) {
    this.logger = options.logger;
    this.hooksDir = options.hooksDir;
    this.callbacks = callbacks;
  }

  /**
   * Start watching the hooks directory.
   * Creates the directory if it doesn't exist.
   * Resolves when the initial scan is complete.
   */
  async start(): Promise<void> {
    await fs.promises.mkdir(this.hooksDir, { recursive: true });

    this.watcher = chokidar.watch(this.hooksDir, {
      persistent: true,
      ignoreInitial: false,
      depth: 0,
      ignored: (filePath: string, stats?: fs.Stats) => {
        if (!stats) return false;
        if (stats.isDirectory()) return false;
        return !filePath.endsWith('.jsonl');
      },
    });

    this.watcher.on('add', (filePath: string) => {
      void this.handleAdd(filePath);
    });
    this.watcher.on('change', (filePath: string) => {
      void this.handleChange(filePath);
    });
    this.watcher.on('error', (error: unknown) => {
      this.callbacks.onError?.(
        error instanceof Error ? error : new Error(String(error)),
      );
    });

    const watcher = this.watcher;
    await new Promise<void>((resolve) => {
      watcher.on('ready', () => {
        this.ready = true;
        resolve();
      });
    });
  }

  /** Stop watching and release resources. */
  async close(): Promise<void> {
    await this.watcher?.close();
    this.watcher = null;
    this.filePositions.clear();
    this.ready = false;
  }

  private async handleAdd(filePath: string): Promise<void> {
    if (!filePath.endsWith('.jsonl')) return;

    try {
      if (this.ready) {
        this.logger.debug(`hook-watcher: watching new file: ${filePath}`);
        this.filePositions.set(filePath, 0);
        await this.readAndEmitNewEvents(filePath);
      }
      else {
        this.logger.debug(`hook-watcher: skipping existing file: ${filePath}`);
        const stats = await fs.promises.stat(filePath);
        this.filePositions.set(filePath, stats.size);
      }
    }
    catch (error) {
      this.callbacks.onError?.(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  private async handleChange(filePath: string): Promise<void> {
    if (!filePath.endsWith('.jsonl')) return;

    try {
      await this.readAndEmitNewEvents(filePath);
    }
    catch (error) {
      this.callbacks.onError?.(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  private async readAndEmitNewEvents(filePath: string): Promise<void> {
    const lines = await this.readNewLines(filePath);
    if (lines.length === 0) return;

    const events: HookEvent[] = [];
    for (const line of lines) {
      const event = parseHookEvent(line);
      if (event !== null) {
        events.push(event);
      }
      else {
        this.logger.warn(`hook-watcher: failed to parse hook event: ${line}`);
      }
    }

    if (events.length > 0) {
      this.callbacks.onEvents(events);
    }
  }

  private async readNewLines(filePath: string): Promise<string[]> {
    const position = this.filePositions.get(filePath) ?? 0;
    const stats = await fs.promises.stat(filePath);

    if (stats.size <= position) {
      if (stats.size < position) {
        this.filePositions.set(filePath, stats.size);
      }
      return [];
    }

    const handle = await fs.promises.open(filePath, 'r');
    try {
      const readSize = stats.size - position;
      const buffer = Buffer.alloc(readSize);
      const { bytesRead } = await handle.read(buffer, 0, readSize, position);
      const text = buffer.toString('utf-8', 0, bytesRead);

      const parts = text.split('\n');
      let completedBytes = bytesRead;

      const lastPart = parts[parts.length - 1];
      if (
        lastPart !== undefined
        && lastPart.length > 0
        && !text.endsWith('\n')
      ) {
        parts.pop();
        completedBytes -= Buffer.byteLength(lastPart, 'utf-8');
      }

      this.filePositions.set(filePath, position + completedBytes);

      return parts.filter(line => line.length > 0);
    }
    finally {
      await handle.close();
    }
  }
}
