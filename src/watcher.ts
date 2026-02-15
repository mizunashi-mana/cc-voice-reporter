import chokidar, { type FSWatcher } from "chokidar";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

/**
 * Callback interface for receiving transcript file events.
 */
export interface WatcherCallbacks {
  /** Called when new complete lines are appended to a .jsonl file. */
  onLines: (lines: string[], filePath: string) => void;
  /** Called when an error occurs during watching or reading. */
  onError?: (error: Error) => void;
}

export interface WatcherOptions {
  /** Directory to watch. Defaults to ~/.claude/projects */
  projectsDir?: string;
}

/**
 * Check if a .jsonl file path is a subagent transcript.
 *
 * Subagent transcripts live at:
 *   {session-uuid}/subagents/agent-{id}.jsonl
 */
export function isSubagentFile(filePath: string): boolean {
  const parts = filePath.split(path.sep);
  return parts.includes("subagents");
}

/**
 * Extract the encoded project directory name from a transcript file path.
 *
 * Given a file path like:
 *   /Users/x/.claude/projects/-Users-x-Workspace-my-app/session.jsonl
 * and projectsDir:
 *   /Users/x/.claude/projects/
 * returns: "-Users-x-Workspace-my-app"
 */
export function extractProjectDir(
  filePath: string,
  projectsDir: string,
): string | null {
  const relative = path.relative(projectsDir, filePath);
  if (relative.startsWith("..")) return null;
  const firstComponent = relative.split(path.sep)[0];
  return firstComponent && firstComponent.length > 0 ? firstComponent : null;
}

/**
 * Resolve an encoded project directory name to a human-readable project name.
 *
 * Claude Code encodes the CWD path by replacing "/" with "-", so
 * "-Users-x-Workspace-my-app" represents "/Users/x/Workspace/my-app".
 *
 * Since directory names can contain dashes (e.g. "cc-voice-reporter"),
 * we greedily resolve path segments against the filesystem to find the
 * correct split points.
 *
 * @param existsFn - Injectable filesystem check for testing (default: fs.existsSync)
 */
export function resolveProjectDisplayName(
  encodedDir: string,
  existsFn: (p: string) => boolean = fs.existsSync,
): string {
  const segments = encodedDir.split("-").filter((s) => s.length > 0);
  if (segments.length === 0) return encodedDir;

  let currentPath = "";
  let i = 0;

  while (i < segments.length) {
    // Try longest match first to avoid ambiguity with dashed directory names
    let resolved = false;
    for (let j = segments.length - 1; j >= i; j--) {
      const candidate =
        currentPath + "/" + segments.slice(i, j + 1).join("-");
      if (existsFn(candidate)) {
        currentPath = candidate;
        i = j + 1;
        resolved = true;
        break;
      }
    }

    if (!resolved) {
      // Cannot resolve further — remaining segments form the last component
      const remaining = segments.slice(i).join("-");
      return remaining || path.basename(currentPath) || encodedDir;
    }
  }

  return path.basename(currentPath) || encodedDir;
}

/**
 * Watches ~/.claude/projects/ for transcript .jsonl file changes
 * and emits new lines as they are appended (tail logic).
 *
 * - During initial scan, existing file content is skipped.
 * - After ready, new files are read from the beginning.
 * - Only complete lines (terminated by newline) are emitted.
 * - File truncation is detected and position is reset.
 */
export class TranscriptWatcher {
  private watcher: FSWatcher | null = null;
  private filePositions = new Map<string, number>();
  private ready = false;
  private readonly projectsDir: string;
  private readonly callbacks: WatcherCallbacks;

  constructor(callbacks: WatcherCallbacks, options?: WatcherOptions) {
    this.projectsDir =
      options?.projectsDir ?? path.join(os.homedir(), ".claude", "projects");
    this.callbacks = callbacks;
  }

  /**
   * Start watching the projects directory.
   * Resolves when the initial scan is complete.
   */
  async start(): Promise<void> {
    this.watcher = chokidar.watch(this.projectsDir, {
      persistent: true,
      ignoreInitial: false,
      // Deep enough for: projects/-cwd/session/subagents/agent.jsonl
      depth: 4,
      ignored: (filePath: string, stats?: fs.Stats) => {
        // Don't filter paths we haven't stat'd yet
        if (!stats) return false;
        // Allow directories to be traversed
        if (stats.isDirectory()) return false;
        // Only watch .jsonl files
        return !filePath.endsWith(".jsonl");
      },
    });

    this.watcher.on("add", (filePath: string) => {
      void this.handleAdd(filePath);
    });
    this.watcher.on("change", (filePath: string) => {
      void this.handleChange(filePath);
    });
    this.watcher.on("error", (error: unknown) => {
      this.callbacks.onError?.(
        error instanceof Error ? error : new Error(String(error)),
      );
    });

    await new Promise<void>((resolve) => {
      this.watcher!.on("ready", () => {
        this.ready = true;
        resolve();
      });
    });
  }

  /**
   * Stop watching and release resources.
   */
  async close(): Promise<void> {
    await this.watcher?.close();
    this.watcher = null;
    this.filePositions.clear();
    this.ready = false;
  }

  private async handleAdd(filePath: string): Promise<void> {
    if (!filePath.endsWith(".jsonl")) return;

    try {
      if (this.ready) {
        // New file created after watcher started — read from beginning
        process.stderr.write(
          `[cc-voice-reporter] watching new file: ${filePath}\n`,
        );
        this.filePositions.set(filePath, 0);
        await this.readAndEmitNewLines(filePath);
      } else {
        // Existing file found during initial scan — skip to end
        process.stderr.write(
          `[cc-voice-reporter] skipping existing file: ${filePath}\n`,
        );
        const stats = await fs.promises.stat(filePath);
        this.filePositions.set(filePath, stats.size);
      }
    } catch (error) {
      this.callbacks.onError?.(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  private async handleChange(filePath: string): Promise<void> {
    if (!filePath.endsWith(".jsonl")) return;

    try {
      await this.readAndEmitNewLines(filePath);
    } catch (error) {
      this.callbacks.onError?.(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  private async readAndEmitNewLines(filePath: string): Promise<void> {
    const lines = await this.readNewLines(filePath);
    if (lines.length > 0) {
      this.callbacks.onLines(lines, filePath);
    }
  }

  /**
   * Read newly appended complete lines from a file,
   * starting from the last known position.
   */
  private async readNewLines(filePath: string): Promise<string[]> {
    const position = this.filePositions.get(filePath) ?? 0;
    const stats = await fs.promises.stat(filePath);

    if (stats.size <= position) {
      if (stats.size < position) {
        // File was truncated — reset position
        this.filePositions.set(filePath, stats.size);
      }
      return [];
    }

    const handle = await fs.promises.open(filePath, "r");
    try {
      const readSize = stats.size - position;
      const buffer = Buffer.alloc(readSize);
      const { bytesRead } = await handle.read(buffer, 0, readSize, position);
      const text = buffer.toString("utf-8", 0, bytesRead);

      // Split into lines
      const parts = text.split("\n");
      let completedBytes = bytesRead;

      // If the text doesn't end with a newline, the last part may be
      // an incomplete line still being written. Exclude it and adjust
      // the position so it will be included in the next read.
      const lastPart = parts[parts.length - 1];
      if (
        lastPart !== undefined &&
        lastPart.length > 0 &&
        !text.endsWith("\n")
      ) {
        parts.pop();
        completedBytes -= Buffer.byteLength(lastPart, "utf-8");
      }

      this.filePositions.set(filePath, position + completedBytes);

      return parts.filter((line) => line.length > 0);
    } finally {
      await handle.close();
    }
  }
}
