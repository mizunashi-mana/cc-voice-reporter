import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Daemon, formatToolUse } from "./daemon.js";

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

/** Helper to build an assistant JSONL line with tool_use content. */
function toolUseLine(
  requestId: string,
  name: string,
  input: Record<string, unknown>,
): string {
  return JSON.stringify({
    type: "assistant",
    requestId,
    message: {
      role: "assistant",
      content: [{ type: "tool_use", id: `toolu_${Math.random().toString(36).slice(2)}`, name, input }],
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
    it("speaks tool_use messages immediately (no debounce)", () => {
      createDaemon();
      daemon.handleLines([
        toolUseLine("req_1", "Read", { file_path: "/tmp/test.ts" }),
      ]);

      // tool_use should be spoken without waiting for debounce
      expect(spoken).toEqual(["test.ts を読み取ります"]);
    });

    it("speaks tool_use independently from text debounce", () => {
      createDaemon();
      daemon.handleLines([textLine("req_1", "確認します")]);
      daemon.handleLines([
        toolUseLine("req_1", "Read", { file_path: "/tmp/config.json" }),
      ]);

      // tool_use spoken immediately, text still debouncing
      expect(spoken).toEqual(["config.json を読み取ります"]);

      vi.advanceTimersByTime(500);
      expect(spoken).toEqual([
        "config.json を読み取ります",
        "確認します",
      ]);
    });
  });

  describe("mixed content in a single line", () => {
    it("handles text and tool_use in the same JSONL line", () => {
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

      // tool_use immediate, text debounced
      expect(spoken).toEqual(["app.ts を読み取ります"]);

      vi.advanceTimersByTime(500);
      expect(spoken).toEqual([
        "app.ts を読み取ります",
        "ファイルを確認します",
      ]);
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
});

describe("formatToolUse", () => {
  it("formats Bash with description", () => {
    expect(
      formatToolUse("Bash", { command: "npm test", description: "テストを実行" }),
    ).toBe("コマンドを実行します。テストを実行");
  });

  it("formats Bash without description", () => {
    expect(formatToolUse("Bash", { command: "npm test" })).toBe(
      "コマンドを実行します",
    );
  });

  it("formats Read with file path", () => {
    expect(
      formatToolUse("Read", { file_path: "/home/user/src/index.ts" }),
    ).toBe("index.ts を読み取ります");
  });

  it("formats Write with file path", () => {
    expect(
      formatToolUse("Write", { file_path: "/home/user/src/app.ts", content: "" }),
    ).toBe("app.ts を作成します");
  });

  it("formats Edit with file path", () => {
    expect(
      formatToolUse("Edit", { file_path: "/home/user/config.json" }),
    ).toBe("config.json を編集します");
  });

  it("formats Grep with pattern", () => {
    expect(formatToolUse("Grep", { pattern: "TODO" })).toBe(
      "TODO を検索します",
    );
  });

  it("formats Glob with pattern", () => {
    expect(formatToolUse("Glob", { pattern: "**/*.ts" })).toBe(
      "**/*.ts でファイルを検索します",
    );
  });

  it("formats Task with description", () => {
    expect(
      formatToolUse("Task", { description: "コード調査", prompt: "..." }),
    ).toBe("サブエージェントを起動します。コード調査");
  });

  it("formats WebFetch", () => {
    expect(formatToolUse("WebFetch", {})).toBe("Webページを取得します");
  });

  it("formats WebSearch with query", () => {
    expect(
      formatToolUse("WebSearch", { query: "TypeScript tutorial" }),
    ).toBe("TypeScript tutorial をWeb検索します");
  });

  it("formats unknown tool with tool name", () => {
    expect(formatToolUse("CustomTool", {})).toBe("CustomTool を実行します");
  });
});
