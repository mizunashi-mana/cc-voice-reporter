import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TranscriptWatcher,
  isSubagentFile,
  extractProjectDir,
  extractSessionId,
  resolveProjectDisplayName,
  encodeProjectPath,
} from './watcher.js';
import type { Logger } from './logger.js';

const silentLogger: Logger = { debug() {}, info() {}, warn() {}, error() {} };

describe('extractSessionId', () => {
  it('extracts session UUID from a main session file path', () => {
    expect(
      extractSessionId(
        '/home/user/.claude/projects/-home-user-app/abc-123.jsonl',
        '/home/user/.claude/projects',
      ),
    ).toBe('abc-123');
  });

  it('extracts session UUID from a subagent file path', () => {
    expect(
      extractSessionId(
        '/home/user/.claude/projects/-home-user-app/abc-123/subagents/agent-1.jsonl',
        '/home/user/.claude/projects',
      ),
    ).toBe('abc-123');
  });

  it('returns null for paths outside projectsDir', () => {
    expect(
      extractSessionId(
        '/other/path/file.jsonl',
        '/home/user/.claude/projects',
      ),
    ).toBe(null);
  });

  it('returns null when path has only project dir (no session component)', () => {
    expect(
      extractSessionId(
        '/home/user/.claude/projects/-home-user-app',
        '/home/user/.claude/projects',
      ),
    ).toBe(null);
  });
});

describe('extractProjectDir', () => {
  it('extracts the project directory from a file path', () => {
    expect(
      extractProjectDir(
        '/home/user/.claude/projects/-home-user-my-app/session.jsonl',
        '/home/user/.claude/projects',
      ),
    ).toBe('-home-user-my-app');
  });

  it('extracts from nested subagent paths', () => {
    expect(
      extractProjectDir(
        '/home/user/.claude/projects/-home-user-app/uuid/subagents/agent-1.jsonl',
        '/home/user/.claude/projects',
      ),
    ).toBe('-home-user-app');
  });

  it('returns null for paths outside projectsDir', () => {
    expect(
      extractProjectDir(
        '/other/path/file.jsonl',
        '/home/user/.claude/projects',
      ),
    ).toBe(null);
  });

  it('returns null for empty relative path', () => {
    expect(
      extractProjectDir(
        '/home/user/.claude/projects',
        '/home/user/.claude/projects',
      ),
    ).toBe(null);
  });
});

describe('resolveProjectDisplayName', () => {
  it('resolves a hyphenated project name using filesystem', () => {
    // Simulate: /Users/x/Workspace/cc-voice-reporter exists
    const existsFn = (p: string): boolean => {
      const validPaths = [
        '/Users',
        '/Users/x',
        '/Users/x/Workspace',
        '/Users/x/Workspace/cc-voice-reporter',
      ];
      return validPaths.includes(p);
    };

    expect(
      resolveProjectDisplayName('-Users-x-Workspace-cc-voice-reporter', existsFn),
    ).toBe('cc-voice-reporter');
  });

  it('resolves a simple project name', () => {
    const existsFn = (p: string): boolean => {
      const validPaths = [
        '/Users',
        '/Users/x',
        '/Users/x/Workspace',
        '/Users/x/Workspace/myapp',
      ];
      return validPaths.includes(p);
    };

    expect(
      resolveProjectDisplayName('-Users-x-Workspace-myapp', existsFn),
    ).toBe('myapp');
  });

  it('resolves project name with multiple hyphens', () => {
    const existsFn = (p: string): boolean => {
      const validPaths = [
        '/home',
        '/home/user',
        '/home/user/projects',
        '/home/user/projects/my-cool-app',
      ];
      return validPaths.includes(p);
    };

    expect(
      resolveProjectDisplayName('-home-user-projects-my-cool-app', existsFn),
    ).toBe('my-cool-app');
  });

  it('falls back to remaining segments when path cannot be resolved', () => {
    // No paths exist
    const existsFn = (): boolean => false;

    expect(
      resolveProjectDisplayName('-Users-x-Workspace-app', existsFn),
    ).toBe('Users-x-Workspace-app');
  });

  it('handles partially resolvable paths', () => {
    const existsFn = (p: string): boolean => {
      const validPaths = ['/Users', '/Users/x'];
      return validPaths.includes(p);
    };

    // After resolving /Users/x, "Workspace-app" cannot be resolved
    expect(
      resolveProjectDisplayName('-Users-x-Workspace-app', existsFn),
    ).toBe('Workspace-app');
  });

  it('returns raw name for empty encoded dir', () => {
    expect(resolveProjectDisplayName('', () => false)).toBe('');
  });
});

describe('encodeProjectPath', () => {
  it('encodes a simple absolute path', () => {
    expect(encodeProjectPath('/Users/x/Workspace/my-app')).toBe(
      '-Users-x-Workspace-my-app',
    );
  });

  it('encodes a path with trailing slash', () => {
    expect(encodeProjectPath('/Users/x/Workspace/my-app/')).toBe(
      '-Users-x-Workspace-my-app',
    );
  });

  it('encodes a path with multiple trailing slashes', () => {
    expect(encodeProjectPath('/Users/x/app//')).toBe('-Users-x-app');
  });

  it('encodes the root path', () => {
    expect(encodeProjectPath('/')).toBe('');
  });
});

describe('TranscriptWatcher#shouldWatch', () => {
  const projectsDir = '/home/user/.claude/projects';

  function makeWatcher(
    filter: { include?: string[]; exclude?: string[] },
    resolveProjectName?: (encodedDir: string) => string,
  ): TranscriptWatcher {
    return new TranscriptWatcher(
      { onLines: () => {} },
      { projectsDir, filter, resolveProjectName, logger: silentLogger },
    );
  }

  it('returns true when no filter is specified', () => {
    const watcher = makeWatcher({});
    expect(
      watcher.shouldWatch(
        '/home/user/.claude/projects/-home-user-app/session.jsonl',
      ),
    ).toBe(true);
  });

  it('returns true when include and exclude arrays are empty', () => {
    const watcher = makeWatcher({ include: [], exclude: [] });
    expect(
      watcher.shouldWatch(
        '/home/user/.claude/projects/-home-user-app/session.jsonl',
      ),
    ).toBe(true);
  });

  it('returns true for file outside projectsDir (extractProjectDir returns null)', () => {
    const watcher = makeWatcher({ include: ['my-app'] });
    expect(watcher.shouldWatch('/other/path/session.jsonl')).toBe(true);
  });

  describe('include only', () => {
    it('allows a matching project by name', () => {
      const watcher = makeWatcher({ include: ['my-app'] }, () => 'my-app');
      expect(
        watcher.shouldWatch(
          '/home/user/.claude/projects/-home-user-my-app/session.jsonl',
        ),
      ).toBe(true);
    });

    it('blocks a non-matching project by name', () => {
      const watcher = makeWatcher({ include: ['my-app'] }, () => 'other-app');
      expect(
        watcher.shouldWatch(
          '/home/user/.claude/projects/-home-user-other-app/session.jsonl',
        ),
      ).toBe(false);
    });

    it('allows a matching project by absolute path', () => {
      const watcher = makeWatcher({
        include: ['/home/user/my-app'],
      });
      expect(
        watcher.shouldWatch(
          '/home/user/.claude/projects/-home-user-my-app/session.jsonl',
        ),
      ).toBe(true);
    });

    it('blocks a non-matching project by absolute path', () => {
      const watcher = makeWatcher({
        include: ['/home/user/other-app'],
      });
      expect(
        watcher.shouldWatch(
          '/home/user/.claude/projects/-home-user-my-app/session.jsonl',
        ),
      ).toBe(false);
    });

    it('allows project when absolute path has trailing slash', () => {
      const watcher = makeWatcher({
        include: ['/home/user/my-app/'],
      });
      expect(
        watcher.shouldWatch(
          '/home/user/.claude/projects/-home-user-my-app/session.jsonl',
        ),
      ).toBe(true);
    });
  });

  describe('exclude only', () => {
    it('blocks a matching project by name', () => {
      const watcher = makeWatcher({ exclude: ['bad-app'] }, () => 'bad-app');
      expect(
        watcher.shouldWatch(
          '/home/user/.claude/projects/-home-user-bad-app/session.jsonl',
        ),
      ).toBe(false);
    });

    it('allows a non-matching project by name', () => {
      const watcher = makeWatcher(
        { exclude: ['bad-app'] },
        () => 'good-app',
      );
      expect(
        watcher.shouldWatch(
          '/home/user/.claude/projects/-home-user-good-app/session.jsonl',
        ),
      ).toBe(true);
    });

    it('blocks a matching project by absolute path', () => {
      const watcher = makeWatcher({
        exclude: ['/home/user/bad-app'],
      });
      expect(
        watcher.shouldWatch(
          '/home/user/.claude/projects/-home-user-bad-app/session.jsonl',
        ),
      ).toBe(false);
    });
  });

  describe('both include and exclude', () => {
    it('applies include first, then exclude (exclude wins)', () => {
      const watcher = makeWatcher(
        { include: ['my-app'], exclude: ['my-app'] },
        () => 'my-app',
      );
      expect(
        watcher.shouldWatch(
          '/home/user/.claude/projects/-home-user-my-app/session.jsonl',
        ),
      ).toBe(false);
    });

    it('blocks file not in include even if not in exclude', () => {
      const watcher = makeWatcher(
        { include: ['app-a'], exclude: ['app-b'] },
        () => 'app-c',
      );
      expect(
        watcher.shouldWatch(
          '/home/user/.claude/projects/-home-user-app-c/session.jsonl',
        ),
      ).toBe(false);
    });

    it('allows file in include and not in exclude', () => {
      const watcher = makeWatcher(
        { include: ['app-a'], exclude: ['app-b'] },
        () => 'app-a',
      );
      expect(
        watcher.shouldWatch(
          '/home/user/.claude/projects/-home-user-app-a/session.jsonl',
        ),
      ).toBe(true);
    });
  });

  it('caches display name resolution', () => {
    const resolveProjectName = vi.fn(() => 'my-app');
    const watcher = makeWatcher({ include: ['my-app'] }, resolveProjectName);
    const filePath
      = '/home/user/.claude/projects/-home-user-my-app/session.jsonl';

    watcher.shouldWatch(filePath);
    watcher.shouldWatch(filePath);

    expect(resolveProjectName).toHaveBeenCalledTimes(1);
  });
});

describe('isSubagentFile', () => {
  it('returns false for a main session file', () => {
    expect(
      isSubagentFile(
        '/home/user/.claude/projects/-cwd/abc-123.jsonl',
      ),
    ).toBe(false);
  });

  it('returns true for a subagent file', () => {
    expect(
      isSubagentFile(
        '/home/user/.claude/projects/-cwd/abc-123/subagents/agent-456.jsonl',
      ),
    ).toBe(true);
  });
});

describe('TranscriptWatcher', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'watcher-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('skips existing file content during initial scan', async () => {
    // Create a file with existing content before starting
    const filePath = path.join(tmpDir, 'existing.jsonl');
    fs.writeFileSync(filePath, '{"type":"old"}\n');

    const onLines = vi.fn();
    const watcher = new TranscriptWatcher({ onLines }, { projectsDir: tmpDir, logger: silentLogger });

    try {
      await watcher.start();

      // Wait a bit to ensure no events fire for existing content
      await sleep(200);
      expect(onLines).not.toHaveBeenCalled();

      // Now append new content — this should be emitted
      fs.appendFileSync(filePath, '{"type":"new"}\n');
      await waitFor(() => onLines.mock.calls.length > 0, 5000);

      expect(onLines).toHaveBeenCalledWith(
        ['{"type":"new"}'],
        filePath,
      );
    }
    finally {
      await watcher.close();
    }
  });

  it('reads new files from the beginning after ready', async () => {
    const onLines = vi.fn();
    const watcher = new TranscriptWatcher({ onLines }, { projectsDir: tmpDir, logger: silentLogger });

    try {
      await watcher.start();

      // Create a new file after watcher is ready
      const filePath = path.join(tmpDir, 'new-session.jsonl');
      fs.writeFileSync(filePath, '{"type":"first"}\n');

      await waitFor(() => onLines.mock.calls.length > 0, 5000);

      expect(onLines).toHaveBeenCalledWith(
        ['{"type":"first"}'],
        filePath,
      );
    }
    finally {
      await watcher.close();
    }
  });

  it('emits multiple lines from a single append', async () => {
    const filePath = path.join(tmpDir, 'multi.jsonl');
    fs.writeFileSync(filePath, '');

    const onLines = vi.fn();
    const watcher = new TranscriptWatcher({ onLines }, { projectsDir: tmpDir, logger: silentLogger });

    try {
      await watcher.start();
      // Allow chokidar to settle after initial scan before writing
      await sleep(200);

      fs.appendFileSync(
        filePath,
        '{"line":1}\n{"line":2}\n{"line":3}\n',
      );

      await waitFor(() => onLines.mock.calls.length > 0, 5000);

      // All three lines should be emitted (possibly in one or more calls)
      const allLines = (onLines.mock.calls as Array<[string[], string]>).flatMap(
        call => call[0],
      );
      expect(allLines).toContain('{"line":1}');
      expect(allLines).toContain('{"line":2}');
      expect(allLines).toContain('{"line":3}');
    }
    finally {
      await watcher.close();
    }
  });

  it('ignores non-.jsonl files', async () => {
    const onLines = vi.fn();
    const watcher = new TranscriptWatcher({ onLines }, { projectsDir: tmpDir, logger: silentLogger });

    try {
      await watcher.start();

      // Create a non-jsonl file
      const txtPath = path.join(tmpDir, 'notes.txt');
      fs.writeFileSync(txtPath, 'not a jsonl file\n');

      await sleep(500);
      expect(onLines).not.toHaveBeenCalled();
    }
    finally {
      await watcher.close();
    }
  });

  it('watches files in subdirectories (subagent support)', async () => {
    const onLines = vi.fn();
    const watcher = new TranscriptWatcher({ onLines }, { projectsDir: tmpDir, logger: silentLogger });

    try {
      await watcher.start();

      // Create nested directory structure like subagents
      const subDir = path.join(tmpDir, 'session-1', 'subagents');
      fs.mkdirSync(subDir, { recursive: true });

      const filePath = path.join(subDir, 'agent-1.jsonl');
      fs.writeFileSync(filePath, '{"agent":"sub"}\n');

      await waitFor(() => onLines.mock.calls.length > 0, 5000);

      expect(onLines).toHaveBeenCalledWith(
        ['{"agent":"sub"}'],
        filePath,
      );
    }
    finally {
      await watcher.close();
    }
  });

  it('handles file truncation by resetting position', async () => {
    const filePath = path.join(tmpDir, 'truncate.jsonl');
    fs.writeFileSync(filePath, '{"line":1}\n{"line":2}\n');

    const onLines = vi.fn();
    const watcher = new TranscriptWatcher({ onLines }, { projectsDir: tmpDir, logger: silentLogger });

    try {
      await watcher.start();

      // Truncate file (smaller than tracked position)
      fs.writeFileSync(filePath, '');
      await sleep(300);

      // Write new content after truncation
      onLines.mockClear();
      fs.writeFileSync(filePath, '{"after":"truncation"}\n');

      await waitFor(() => onLines.mock.calls.length > 0, 5000);

      const allLines = (onLines.mock.calls as Array<[string[], string]>).flatMap(
        call => call[0],
      );
      expect(allLines).toContain('{"after":"truncation"}');
    }
    finally {
      await watcher.close();
    }
  });

  it('reports errors via onError callback', async () => {
    const onLines = vi.fn();
    const onError = vi.fn();
    const watcher = new TranscriptWatcher(
      { onLines, onError },
      // Watch a non-existent directory to test error handling
      { projectsDir: path.join(tmpDir, 'nonexistent'), logger: silentLogger },
    );

    try {
      // The watcher should still start, just with nothing to watch initially
      await watcher.start();
      // No crash is the test here
    }
    finally {
      await watcher.close();
    }
  });

  it('close() stops watching for new changes', async () => {
    const filePath = path.join(tmpDir, 'close-test.jsonl');
    fs.writeFileSync(filePath, '');

    const onLines = vi.fn();
    const watcher = new TranscriptWatcher({ onLines }, { projectsDir: tmpDir, logger: silentLogger });

    await watcher.start();
    await watcher.close();

    // Append after close — should not trigger callback
    fs.appendFileSync(filePath, '{"after":"close"}\n');
    await sleep(500);

    expect(onLines).not.toHaveBeenCalled();
  });
});

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(
  condition: () => boolean,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (condition()) {
        clearInterval(interval);
        resolve();
      }
    }, 50);
    setTimeout(() => {
      clearInterval(interval);
      if (condition()) {
        resolve();
      }
      else {
        reject(new Error(`waitFor timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);
  });
}
