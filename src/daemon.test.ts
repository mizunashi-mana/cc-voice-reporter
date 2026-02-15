import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Daemon } from "./daemon.js";
import type { ProjectInfo } from "./speaker.js";

/** Helper to build an assistant JSONL line with text content. */
function textLine(requestId: string, text: string): string {
  return JSON.stringify({
    type: "assistant",
    requestId,
    message: {
      role: "assistant",
      content: [{ type: "text", text }],
    },
    uuid: `uuid-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
  });
}

describe("Daemon", () => {
  let spoken: string[];
  let daemon: Daemon;

  beforeEach(() => {
    vi.useFakeTimers();
    spoken = [];
  });

  afterEach(async () => {
    vi.useRealTimers();
    await daemon?.stop();
  });

  function createDaemon(options?: { debounceMs?: number }) {
    daemon = new Daemon({
      debounceMs: options?.debounceMs ?? 500,
      // Use a fake watcher directory that doesn't exist — we call handleLines directly
      watcher: { projectsDir: "/tmp/cc-voice-reporter-test-nonexistent" },
      speakFn: (message) => {
        spoken.push(message);
      },
    });
  }

  describe("text message debouncing", () => {
    it("speaks text after debounce interval", () => {
      createDaemon();
      daemon.handleLines([textLine("req_1", "こんにちは")]);

      // Not spoken yet (debounce pending)
      expect(spoken).toEqual([]);

      vi.advanceTimersByTime(500);
      expect(spoken).toEqual(["こんにちは"]);
    });

    it("combines text from the same requestId within debounce window", () => {
      createDaemon();
      daemon.handleLines([textLine("req_1", "こんにちは")]);
      vi.advanceTimersByTime(200);
      daemon.handleLines([textLine("req_1", "。ファイルを確認します")]);

      vi.advanceTimersByTime(500);
      expect(spoken).toEqual(["こんにちは。ファイルを確認します"]);
    });

    it("resets debounce timer on new text", () => {
      createDaemon();
      daemon.handleLines([textLine("req_1", "A")]);
      vi.advanceTimersByTime(400); // 400ms passed, not yet flushed
      daemon.handleLines([textLine("req_1", "B")]);
      vi.advanceTimersByTime(400); // 800ms total, but only 400ms since last text
      expect(spoken).toEqual([]); // Still waiting

      vi.advanceTimersByTime(100); // 500ms since last text
      expect(spoken).toEqual(["AB"]);
    });

    it("handles different requestIds independently", () => {
      createDaemon();
      daemon.handleLines([textLine("req_1", "テキスト1")]);
      daemon.handleLines([textLine("req_2", "テキスト2")]);

      vi.advanceTimersByTime(500);
      expect(spoken).toHaveLength(2);
      expect(spoken).toContain("テキスト1");
      expect(spoken).toContain("テキスト2");
    });

    it("uses custom debounce interval", () => {
      createDaemon({ debounceMs: 1000 });
      daemon.handleLines([textLine("req_1", "テスト")]);

      vi.advanceTimersByTime(500);
      expect(spoken).toEqual([]);

      vi.advanceTimersByTime(500);
      expect(spoken).toEqual(["テスト"]);
    });
  });

  describe("tool_use messages", () => {
    it("does not speak tool_use messages", () => {
      createDaemon();
      const line = JSON.stringify({
        type: "assistant",
        requestId: "req_1",
        message: {
          role: "assistant",
          content: [
            { type: "tool_use", id: "toolu_1", name: "Read", input: { file_path: "/tmp/test.ts" } },
          ],
        },
        uuid: "uuid-tool",
        timestamp: new Date().toISOString(),
      });

      daemon.handleLines([line]);
      vi.advanceTimersByTime(1000);
      expect(spoken).toEqual([]);
    });

    it("speaks text but ignores tool_use in mixed content", () => {
      createDaemon();
      const line = JSON.stringify({
        type: "assistant",
        requestId: "req_1",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "ファイルを確認します" },
            { type: "tool_use", id: "toolu_1", name: "Read", input: { file_path: "/tmp/app.ts" } },
          ],
        },
        uuid: "uuid-mixed",
        timestamp: new Date().toISOString(),
      });

      daemon.handleLines([line]);

      // tool_use not spoken, text debounced
      expect(spoken).toEqual([]);

      vi.advanceTimersByTime(500);
      expect(spoken).toEqual(["ファイルを確認します"]);
    });
  });

  describe("non-relevant records", () => {
    it("ignores user records", () => {
      createDaemon();
      const line = JSON.stringify({
        type: "user",
        message: { role: "user", content: "hello" },
        uuid: "uuid-user",
        timestamp: new Date().toISOString(),
      });

      daemon.handleLines([line]);
      vi.advanceTimersByTime(1000);
      expect(spoken).toEqual([]);
    });

    it("ignores thinking content blocks", () => {
      createDaemon();
      const line = JSON.stringify({
        type: "assistant",
        requestId: "req_1",
        message: {
          role: "assistant",
          content: [{ type: "thinking", thinking: "Let me think..." }],
        },
        uuid: "uuid-thinking",
        timestamp: new Date().toISOString(),
      });

      daemon.handleLines([line]);
      vi.advanceTimersByTime(1000);
      expect(spoken).toEqual([]);
    });

    it("ignores whitespace-only text blocks", () => {
      createDaemon();
      daemon.handleLines([textLine("req_1", "\n\n")]);
      vi.advanceTimersByTime(1000);
      expect(spoken).toEqual([]);
    });
  });

  describe("stop", () => {
    it("flushes pending debounced text on stop", async () => {
      createDaemon();
      daemon.handleLines([textLine("req_1", "まだ読み上げてない")]);

      await daemon.stop();

      expect(spoken).toEqual(["まだ読み上げてない"]);
    });

    it("flushes multiple pending requestIds on stop", async () => {
      createDaemon();
      daemon.handleLines([textLine("req_1", "テキスト1")]);
      daemon.handleLines([textLine("req_2", "テキスト2")]);

      await daemon.stop();

      expect(spoken).toHaveLength(2);
      expect(spoken).toContain("テキスト1");
      expect(spoken).toContain("テキスト2");
    });
  });

  describe("project info tagging", () => {
    const projectsDir = "/home/user/.claude/projects";
    let spokenWithProject: { message: string; project?: ProjectInfo }[];

    function createDaemonWithProject() {
      spokenWithProject = [];
      daemon = new Daemon({
        debounceMs: 500,
        watcher: { projectsDir },
        speakFn: (message, project) => {
          spoken.push(message);
          spokenWithProject.push({ message, project });
        },
        resolveProjectName: (dir) => dir.replace(/^-/, "").split("-").pop()!,
      });
    }

    it("passes project info to speakFn when filePath is provided", () => {
      createDaemonWithProject();
      daemon.handleLines(
        [textLine("req_1", "テスト")],
        `${projectsDir}/-proj-a/session.jsonl`,
      );

      vi.advanceTimersByTime(500);
      expect(spokenWithProject).toHaveLength(1);
      expect(spokenWithProject[0]!.project).toEqual({
        dir: "-proj-a",
        displayName: "a",
      });
    });

    it("passes no project when filePath is not provided", () => {
      createDaemonWithProject();
      daemon.handleLines([textLine("req_1", "テスト")]);

      vi.advanceTimersByTime(500);
      expect(spokenWithProject).toHaveLength(1);
      expect(spokenWithProject[0]!.project).toBeUndefined();
    });

    it("tags different requestIds with the correct project", () => {
      createDaemonWithProject();
      daemon.handleLines(
        [textLine("req_1", "Aのテキスト")],
        `${projectsDir}/-proj-a/s1.jsonl`,
      );
      daemon.handleLines(
        [textLine("req_2", "Bのテキスト")],
        `${projectsDir}/-proj-b/s2.jsonl`,
      );

      vi.advanceTimersByTime(500);
      expect(spokenWithProject).toHaveLength(2);

      const a = spokenWithProject.find((s) => s.message === "Aのテキスト");
      const b = spokenWithProject.find((s) => s.message === "Bのテキスト");
      expect(a!.project!.dir).toBe("-proj-a");
      expect(b!.project!.dir).toBe("-proj-b");
    });
  });
});
