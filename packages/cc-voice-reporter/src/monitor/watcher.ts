import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import type { Logger } from './logger.js';

/**
 * Callback interface for receiving transcript file events.
 */
export interface WatcherCallbacks {
  /** Called when new complete lines are appended to a .jsonl file. */
  onLines: (lines: string[], filePath: string) => void;
  /** Called when an error occurs during watching or reading. */
  onError?: (error: Error) => void;
}

export interface ProjectFilter {
  include?: string[];
  exclude?: string[];
}

export interface WatcherOptions {
  /** Directory to watch. Defaults to ~/.claude/projects */
  projectsDir?: string;
  /** Filter to include/exclude projects from watching. */
  filter?: ProjectFilter;
  /** Custom project display name resolver. */
  resolveProjectName?: (encodedDir: string) => string;
  /** Logger instance. */
  logger: Logger;
}

/**
 * Encode an absolute project path to a directory name as Claude Code does.
 *
 * Claude Code replaces "/" with "-" in the CWD path to create the project
 * directory name. This function replicates that encoding for filter matching.
 *
 * Trailing slashes are normalized before encoding.
 */
export function encodeProjectPath(absolutePath: string): string {
  return absolutePath.replace(/\/+$/, '').replaceAll('/', '-');
}

/**
 * Check if a .jsonl file path is a subagent transcript.
 *
 * Subagent transcripts live at:
 *   {session-uuid}/subagents/agent-{id}.jsonl
 */
export function isSubagentFile(filePath: string): boolean {
  const parts = filePath.split(path.sep);
  return parts.includes('subagents');
}

/**
 * Extract a session identifier from a transcript file path.
 *
 * For main session files:
 *   {projectsDir}/{project-dir}/{session-uuid}.jsonl → session-uuid
 * For subagent files:
 *   {projectsDir}/{project-dir}/{session-uuid}/subagents/agent-{id}.jsonl → session-uuid
 */
export function extractSessionId(
  filePath: string,
  projectsDir: string,
): string | null {
  const relative = path.relative(projectsDir, filePath);
  if (relative.startsWith('..')) return null;
  const components = relative.split(path.sep);
  // components[0] = project dir, components[1] = session file or session dir
  if (components.length < 2) return null;
  const sessionComponent = components[1];
  if (sessionComponent === undefined) return null;
  if (sessionComponent.endsWith('.jsonl')) {
    return sessionComponent.slice(0, -6);
  }
  return sessionComponent;
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
  if (relative.startsWith('..')) return null;
  const firstComponent = relative.split(path.sep)[0];
  return firstComponent !== undefined && firstComponent.length > 0 ? firstComponent : null;
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
  const segments = encodedDir.split('-').filter(s => s.length > 0);
  if (segments.length === 0) return encodedDir;

  let currentPath = '';
  let i = 0;

  while (i < segments.length) {
    // Try longest match first to avoid ambiguity with dashed directory names
    let resolved = false;
    for (let j = segments.length - 1; j >= i; j -= 1) {
      const candidate
        = `${currentPath}/${segments.slice(i, j + 1).join('-')}`;
      if (existsFn(candidate)) {
        currentPath = candidate;
        i = j + 1;
        resolved = true;
        break;
      }
    }

    if (!resolved) {
      // Cannot resolve further — remaining segments form the last component
      const remaining = segments.slice(i).join('-');
      if (remaining.length > 0) return remaining;
      const base = path.basename(currentPath);
      return base.length > 0 ? base : encodedDir;
    }
  }

  const baseName = path.basename(currentPath);
  return baseName.length > 0 ? baseName : encodedDir;
}

/** Default directory for Claude Code transcript files. */
export const DEFAULT_PROJECTS_DIR = path.join(
  os.homedir(),
  '.claude',
  'projects',
);

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
  private readonly filePositions = new Map<string, number>();
  private ready = false;
  private readonly logger: Logger;
  private readonly projectsDir: string;
  private readonly callbacks: WatcherCallbacks;
  private readonly filter: ProjectFilter;
  private readonly resolveProjectName: (encodedDir: string) => string;
  private readonly displayNameCache = new Map<string, string>();

  constructor(callbacks: WatcherCallbacks, options: WatcherOptions) {
    this.logger = options.logger;
    this.projectsDir = options.projectsDir ?? DEFAULT_PROJECTS_DIR;
    this.callbacks = callbacks;
    this.filter = options.filter ?? {};
    this.resolveProjectName
      = options.resolveProjectName ?? resolveProjectDisplayName;
  }

  /**
   * Determine whether a file path should be watched based on the filter.
   *
   * - If neither include nor exclude is specified, all files are watched.
   * - If include is specified, only matching files are watched.
   * - If exclude is specified, matching files are excluded.
   * - Both can be combined: include first, then exclude.
   */
  shouldWatch(filePath: string): boolean {
    const { include, exclude } = this.filter;
    const hasInclude = include !== undefined && include.length > 0;
    const hasExclude = exclude !== undefined && exclude.length > 0;
    if (!hasInclude && !hasExclude) return true;

    const dir = extractProjectDir(filePath, this.projectsDir);
    if (dir === null) return true;

    if (hasInclude && !this.matchesAny(dir, include)) return false;
    if (hasExclude && this.matchesAny(dir, exclude)) return false;
    return true;
  }

  private matchesAny(encodedDir: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      if (pattern.startsWith('/')) {
        if (encodedDir === encodeProjectPath(pattern)) return true;
      }
      else {
        const displayName = this.getCachedDisplayName(encodedDir);
        if (displayName === pattern) return true;
      }
    }
    return false;
  }

  private getCachedDisplayName(encodedDir: string): string {
    let name = this.displayNameCache.get(encodedDir);
    if (name === undefined) {
      name = this.resolveProjectName(encodedDir);
      this.displayNameCache.set(encodedDir, name);
    }
    return name;
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
    if (!filePath.endsWith('.jsonl')) return;
    if (!this.shouldWatch(filePath)) return;

    try {
      if (this.ready) {
        // New file created after watcher started — read from beginning
        this.logger.debug(`watching new file: ${filePath}`);
        this.filePositions.set(filePath, 0);
        await this.readAndEmitNewLines(filePath);
      }
      else {
        // Existing file found during initial scan — skip to end
        this.logger.debug(`skipping existing file: ${filePath}`);
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
    if (!this.shouldWatch(filePath)) return;

    try {
      await this.readAndEmitNewLines(filePath);
    }
    catch (error) {
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

    const handle = await fs.promises.open(filePath, 'r');
    try {
      const readSize = stats.size - position;
      const buffer = Buffer.alloc(readSize);
      const { bytesRead } = await handle.read(buffer, 0, readSize, position);
      const text = buffer.toString('utf-8', 0, bytesRead);

      // Split into lines
      const parts = text.split('\n');
      let completedBytes = bytesRead;

      // If the text doesn't end with a newline, the last part may be
      // an incomplete line still being written. Exclude it and adjust
      // the position so it will be included in the next read.
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
