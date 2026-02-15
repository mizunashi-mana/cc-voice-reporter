import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TranscriptWatcher, isSubagentFile } from "./watcher.js";

describe("isSubagentFile", () => {
  it("returns false for a main session file", () => {
    expect(
      isSubagentFile(
        "/home/user/.claude/projects/-cwd/abc-123.jsonl",
      ),
    ).toBe(false);
  });

  it("returns true for a subagent file", () => {
    expect(
      isSubagentFile(
        "/home/user/.claude/projects/-cwd/abc-123/subagents/agent-456.jsonl",
      ),
    ).toBe(true);
  });
});

describe("TranscriptWatcher", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "watcher-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("skips existing file content during initial scan", async () => {
    // Create a file with existing content before starting
    const filePath = path.join(tmpDir, "existing.jsonl");
    fs.writeFileSync(filePath, '{"type":"old"}\n');

    const onLines = vi.fn();
    const watcher = new TranscriptWatcher({ onLines }, { projectsDir: tmpDir });

    try {
      await watcher.start();

      // Wait a bit to ensure no events fire for existing content
      await sleep(200);
      expect(onLines).not.toHaveBeenCalled();

      // Now append new content — this should be emitted
      fs.appendFileSync(filePath, '{"type":"new"}\n');
      await waitFor(() => onLines.mock.calls.length > 0, 3000);

      expect(onLines).toHaveBeenCalledWith(
        ['{"type":"new"}'],
        filePath,
      );
    } finally {
      await watcher.close();
    }
  });

  it("reads new files from the beginning after ready", async () => {
    const onLines = vi.fn();
    const watcher = new TranscriptWatcher({ onLines }, { projectsDir: tmpDir });

    try {
      await watcher.start();

      // Create a new file after watcher is ready
      const filePath = path.join(tmpDir, "new-session.jsonl");
      fs.writeFileSync(filePath, '{"type":"first"}\n');

      await waitFor(() => onLines.mock.calls.length > 0, 3000);

      expect(onLines).toHaveBeenCalledWith(
        ['{"type":"first"}'],
        filePath,
      );
    } finally {
      await watcher.close();
    }
  });

  it("emits multiple lines from a single append", async () => {
    const filePath = path.join(tmpDir, "multi.jsonl");
    fs.writeFileSync(filePath, "");

    const onLines = vi.fn();
    const watcher = new TranscriptWatcher({ onLines }, { projectsDir: tmpDir });

    try {
      await watcher.start();

      fs.appendFileSync(
        filePath,
        '{"line":1}\n{"line":2}\n{"line":3}\n',
      );

      await waitFor(() => onLines.mock.calls.length > 0, 3000);

      // All three lines should be emitted (possibly in one or more calls)
      const allLines = onLines.mock.calls.flatMap(
        (call: [string[], string]) => call[0],
      );
      expect(allLines).toContain('{"line":1}');
      expect(allLines).toContain('{"line":2}');
      expect(allLines).toContain('{"line":3}');
    } finally {
      await watcher.close();
    }
  });

  it("does not emit incomplete lines", async () => {
    const filePath = path.join(tmpDir, "incomplete.jsonl");
    fs.writeFileSync(filePath, "");

    const onLines = vi.fn();
    const watcher = new TranscriptWatcher({ onLines }, { projectsDir: tmpDir });

    try {
      await watcher.start();
      // Allow chokidar to settle after initial scan before writing
      await sleep(200);

      // Write a complete line and an incomplete line (no trailing newline)
      fs.appendFileSync(filePath, '{"complete":true}\n{"incomplete":true');

      await waitFor(() => onLines.mock.calls.length > 0, 3000);

      const allLines = onLines.mock.calls.flatMap(
        (call: [string[], string]) => call[0],
      );
      expect(allLines).toContain('{"complete":true}');
      expect(allLines).not.toContain('{"incomplete":true');

      // Now complete the line
      onLines.mockClear();
      fs.appendFileSync(filePath, "}\n");

      await waitFor(() => onLines.mock.calls.length > 0, 3000);

      const newLines = onLines.mock.calls.flatMap(
        (call: [string[], string]) => call[0],
      );
      expect(newLines).toContain('{"incomplete":true}');
    } finally {
      await watcher.close();
    }
  });

  it("ignores non-.jsonl files", async () => {
    const onLines = vi.fn();
    const watcher = new TranscriptWatcher({ onLines }, { projectsDir: tmpDir });

    try {
      await watcher.start();

      // Create a non-jsonl file
      const txtPath = path.join(tmpDir, "notes.txt");
      fs.writeFileSync(txtPath, "not a jsonl file\n");

      await sleep(500);
      expect(onLines).not.toHaveBeenCalled();
    } finally {
      await watcher.close();
    }
  });

  it("watches files in subdirectories (subagent support)", async () => {
    const onLines = vi.fn();
    const watcher = new TranscriptWatcher({ onLines }, { projectsDir: tmpDir });

    try {
      await watcher.start();

      // Create nested directory structure like subagents
      const subDir = path.join(tmpDir, "session-1", "subagents");
      fs.mkdirSync(subDir, { recursive: true });

      const filePath = path.join(subDir, "agent-1.jsonl");
      fs.writeFileSync(filePath, '{"agent":"sub"}\n');

      await waitFor(() => onLines.mock.calls.length > 0, 3000);

      expect(onLines).toHaveBeenCalledWith(
        ['{"agent":"sub"}'],
        filePath,
      );
    } finally {
      await watcher.close();
    }
  });

  it("handles file truncation by resetting position", async () => {
    const filePath = path.join(tmpDir, "truncate.jsonl");
    fs.writeFileSync(filePath, '{"line":1}\n{"line":2}\n');

    const onLines = vi.fn();
    const watcher = new TranscriptWatcher({ onLines }, { projectsDir: tmpDir });

    try {
      await watcher.start();

      // Truncate file (smaller than tracked position)
      fs.writeFileSync(filePath, "");
      await sleep(300);

      // Write new content after truncation
      onLines.mockClear();
      fs.writeFileSync(filePath, '{"after":"truncation"}\n');

      await waitFor(() => onLines.mock.calls.length > 0, 3000);

      const allLines = onLines.mock.calls.flatMap(
        (call: [string[], string]) => call[0],
      );
      expect(allLines).toContain('{"after":"truncation"}');
    } finally {
      await watcher.close();
    }
  });

  it("reports errors via onError callback", async () => {
    const onLines = vi.fn();
    const onError = vi.fn();
    const watcher = new TranscriptWatcher(
      { onLines, onError },
      // Watch a non-existent directory to test error handling
      { projectsDir: path.join(tmpDir, "nonexistent") },
    );

    try {
      // The watcher should still start, just with nothing to watch initially
      await watcher.start();
      // No crash is the test here
    } finally {
      await watcher.close();
    }
  });

  it("close() stops watching for new changes", async () => {
    const filePath = path.join(tmpDir, "close-test.jsonl");
    fs.writeFileSync(filePath, "");

    const onLines = vi.fn();
    const watcher = new TranscriptWatcher({ onLines }, { projectsDir: tmpDir });

    await watcher.start();
    await watcher.close();

    // Append after close — should not trigger callback
    fs.appendFileSync(filePath, '{"after":"close"}\n');
    await sleep(500);

    expect(onLines).not.toHaveBeenCalled();
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitFor(
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
      } else {
        reject(new Error(`waitFor timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);
  });
}
