import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Summarizer,
  buildPrompt,
  extractToolDetail,
  createToolUseEvent,
  createTextEvent,
  type ActivityEvent,
} from "./summarizer.js";

describe("extractToolDetail", () => {
  it("extracts file_path from Read", () => {
    expect(extractToolDetail("Read", { file_path: "/src/app.ts" })).toBe(
      "/src/app.ts",
    );
  });

  it("extracts file_path from Edit", () => {
    expect(extractToolDetail("Edit", { file_path: "/src/config.ts" })).toBe(
      "/src/config.ts",
    );
  });

  it("extracts file_path from Write", () => {
    expect(extractToolDetail("Write", { file_path: "/src/new.ts" })).toBe(
      "/src/new.ts",
    );
  });

  it("extracts notebook_path from NotebookEdit", () => {
    expect(
      extractToolDetail("NotebookEdit", { notebook_path: "/nb/test.ipynb" }),
    ).toBe("/nb/test.ipynb");
  });

  it("extracts command from Bash", () => {
    expect(extractToolDetail("Bash", { command: "npm test" })).toBe(
      "npm test",
    );
  });

  it("extracts pattern from Grep", () => {
    expect(extractToolDetail("Grep", { pattern: "TODO" })).toBe("TODO");
  });

  it("extracts pattern and path from Grep", () => {
    expect(
      extractToolDetail("Grep", { pattern: "TODO", path: "/src" }),
    ).toBe("TODO in /src");
  });

  it("extracts pattern from Glob", () => {
    expect(extractToolDetail("Glob", { pattern: "**/*.ts" })).toBe(
      "**/*.ts",
    );
  });

  it("returns empty string for unknown tools", () => {
    expect(extractToolDetail("UnknownTool", { foo: "bar" })).toBe("");
  });

  it("returns empty string when expected field is missing", () => {
    expect(extractToolDetail("Read", {})).toBe("");
  });

  it("returns empty string when field is not a string", () => {
    expect(extractToolDetail("Read", { file_path: 123 })).toBe("");
  });
});

describe("createToolUseEvent", () => {
  it("creates a tool_use event with detail", () => {
    const event = createToolUseEvent("Read", { file_path: "/src/app.ts" });
    expect(event).toEqual({
      kind: "tool_use",
      toolName: "Read",
      detail: "/src/app.ts",
    });
  });

  it("creates a tool_use event without detail for unknown tools", () => {
    const event = createToolUseEvent("Unknown", {});
    expect(event).toEqual({
      kind: "tool_use",
      toolName: "Unknown",
      detail: "",
    });
  });
});

describe("createTextEvent", () => {
  it("creates a text event with short text", () => {
    const event = createTextEvent("短いテキスト");
    expect(event).toEqual({
      kind: "text",
      snippet: "短いテキスト",
    });
  });

  it("truncates long text with ellipsis", () => {
    const longText = "a".repeat(100);
    const event = createTextEvent(longText);
    expect(event.snippet).toHaveLength(81); // 80 chars + "…"
    expect(event.snippet.endsWith("…")).toBe(true);
  });

  it("does not truncate text at exactly 80 chars", () => {
    const text = "a".repeat(80);
    const event = createTextEvent(text);
    expect(event.snippet).toBe(text);
  });
});

describe("buildPrompt", () => {
  it("builds prompt from tool_use events", () => {
    const events: ActivityEvent[] = [
      { kind: "tool_use", toolName: "Read", detail: "/src/app.ts" },
      { kind: "tool_use", toolName: "Edit", detail: "/src/config.ts" },
    ];
    const prompt = buildPrompt(events);
    expect(prompt).toContain("直近のClaude Codeの操作:");
    expect(prompt).toContain("- Read: /src/app.ts");
    expect(prompt).toContain("- Edit: /src/config.ts");
  });

  it("builds prompt from text events", () => {
    const events: ActivityEvent[] = [
      { kind: "text", snippet: "テストを実行します" },
    ];
    const prompt = buildPrompt(events);
    expect(prompt).toContain("- テキスト応答: テストを実行します");
  });

  it("builds prompt with tool_use without detail", () => {
    const events: ActivityEvent[] = [
      { kind: "tool_use", toolName: "AskUserQuestion", detail: "" },
    ];
    const prompt = buildPrompt(events);
    expect(prompt).toContain("- AskUserQuestion");
    expect(prompt).not.toContain("- AskUserQuestion:");
  });

  it("builds prompt from mixed events", () => {
    const events: ActivityEvent[] = [
      { kind: "tool_use", toolName: "Read", detail: "/src/app.ts" },
      { kind: "text", snippet: "ファイルを確認しました" },
      { kind: "tool_use", toolName: "Bash", detail: "npm test" },
    ];
    const prompt = buildPrompt(events);
    const lines = prompt.split("\n");
    expect(lines).toHaveLength(4); // header + 3 events
  });
});

describe("Summarizer", () => {
  let warnings: string[];
  let spokenSummaries: string[];

  beforeEach(() => {
    vi.useFakeTimers();
    warnings = [];
    spokenSummaries = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function createSummarizer(options?: { intervalMs?: number }) {
    return new Summarizer(
      {
        ollama: {
          model: "test-model",
          baseUrl: "http://localhost:11434",
        },
        intervalMs: options?.intervalMs ?? 60_000,
      },
      (message) => spokenSummaries.push(message),
      (msg) => warnings.push(msg),
    );
  }

  describe("record", () => {
    it("tracks events", () => {
      const summarizer = createSummarizer();
      summarizer.record({ kind: "tool_use", toolName: "Read", detail: "/src/app.ts" });
      summarizer.record({ kind: "text", snippet: "テスト" });
      expect(summarizer.pendingEvents).toBe(2);
    });
  });

  describe("flush", () => {
    it("does nothing when no events are recorded", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const summarizer = createSummarizer();
      await summarizer.flush();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(spokenSummaries).toEqual([]);
    });

    it("calls Ollama and speaks the summary", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            message: { content: "ファイルを読み取り、編集しました" },
          }),
          { status: 200 },
        ),
      );

      const summarizer = createSummarizer();
      summarizer.record({ kind: "tool_use", toolName: "Read", detail: "/src/app.ts" });
      summarizer.record({ kind: "tool_use", toolName: "Edit", detail: "/src/config.ts" });
      await summarizer.flush();

      expect(spokenSummaries).toEqual(["ファイルを読み取り、編集しました"]);
    });

    it("clears events after flush", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({ message: { content: "要約" } }),
          { status: 200 },
        ),
      );

      const summarizer = createSummarizer();
      summarizer.record({ kind: "tool_use", toolName: "Read", detail: "/src/app.ts" });
      await summarizer.flush();

      expect(summarizer.pendingEvents).toBe(0);
    });

    it("sends correct request to Ollama API", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({ message: { content: "要約" } }),
          { status: 200 },
        ),
      );

      const summarizer = createSummarizer();
      summarizer.record({ kind: "tool_use", toolName: "Bash", detail: "npm test" });
      await summarizer.flush();

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, init] = fetchSpy.mock.calls[0]!;
      expect(url).toBe("http://localhost:11434/api/chat");

      const body = JSON.parse(init?.body as string) as {
        model: string;
        stream: boolean;
        messages: { role: string; content: string }[];
      };
      expect(body.model).toBe("test-model");
      expect(body.stream).toBe(false);
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0]!.role).toBe("system");
      expect(body.messages[1]!.role).toBe("user");
      expect(body.messages[1]!.content).toContain("Bash: npm test");
    });

    it("warns on HTTP error and does not speak", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Internal Server Error", { status: 500 }),
      );

      const summarizer = createSummarizer();
      summarizer.record({ kind: "tool_use", toolName: "Read", detail: "/src/app.ts" });
      await summarizer.flush();

      expect(spokenSummaries).toEqual([]);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("HTTP 500");
    });

    it("warns on invalid response format", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ unexpected: "format" }), { status: 200 }),
      );

      const summarizer = createSummarizer();
      summarizer.record({ kind: "tool_use", toolName: "Read", detail: "/src/app.ts" });
      await summarizer.flush();

      expect(spokenSummaries).toEqual([]);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("invalid response format");
    });

    it("warns on network error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Connection refused"),
      );

      const summarizer = createSummarizer();
      summarizer.record({ kind: "tool_use", toolName: "Read", detail: "/src/app.ts" });
      await summarizer.flush();

      expect(spokenSummaries).toEqual([]);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("Connection refused");
    });

    it("does not speak empty summary", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({ message: { content: "  \n  " } }),
          { status: 200 },
        ),
      );

      const summarizer = createSummarizer();
      summarizer.record({ kind: "tool_use", toolName: "Read", detail: "/src/app.ts" });
      await summarizer.flush();

      expect(spokenSummaries).toEqual([]);
    });
  });

  describe("event-driven throttle", () => {
    it("flushes after intervalMs when triggered by record", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({ message: { content: "定期要約" } }),
          { status: 200 },
        ),
      );

      const summarizer = createSummarizer({ intervalMs: 10_000 });
      summarizer.start();
      summarizer.record(
        { kind: "tool_use", toolName: "Read", detail: "/src/app.ts" },
        true,
      );

      await vi.advanceTimersByTimeAsync(10_000);
      expect(spokenSummaries).toEqual(["定期要約"]);
    });

    it("does not schedule timer when trigger is false", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const summarizer = createSummarizer({ intervalMs: 10_000 });
      summarizer.start();
      summarizer.record({ kind: "tool_use", toolName: "Read", detail: "/src/app.ts" });

      await vi.advanceTimersByTimeAsync(10_000);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("does not schedule timer when not active", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const summarizer = createSummarizer({ intervalMs: 10_000 });
      // Not calling start() — summarizer is inactive
      summarizer.record(
        { kind: "tool_use", toolName: "Read", detail: "/src/app.ts" },
        true,
      );

      await vi.advanceTimersByTimeAsync(10_000);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("does not create multiple timers for rapid triggers", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({ message: { content: "まとめて要約" } }),
          { status: 200 },
        ),
      );

      const summarizer = createSummarizer({ intervalMs: 10_000 });
      summarizer.start();
      summarizer.record(
        { kind: "tool_use", toolName: "Read", detail: "/src/a.ts" },
        true,
      );
      summarizer.record(
        { kind: "tool_use", toolName: "Edit", detail: "/src/b.ts" },
        true,
      );

      await vi.advanceTimersByTimeAsync(10_000);
      // Only one Ollama call, both events included
      expect(fetchSpy).toHaveBeenCalledOnce();
      expect(spokenSummaries).toEqual(["まとめて要約"]);
    });

    it("stop cancels the throttle timer", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const summarizer = createSummarizer({ intervalMs: 10_000 });
      summarizer.start();
      summarizer.record(
        { kind: "tool_use", toolName: "Read", detail: "/src/app.ts" },
        true,
      );
      summarizer.stop();

      await vi.advanceTimersByTimeAsync(10_000);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("explicit flush cancels pending throttle timer", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({ message: { content: "要約" } }),
          { status: 200 },
        ),
      );

      const summarizer = createSummarizer({ intervalMs: 10_000 });
      summarizer.start();
      summarizer.record(
        { kind: "tool_use", toolName: "Read", detail: "/src/app.ts" },
        true,
      );

      // Explicit flush before timer fires
      await summarizer.flush();
      expect(fetchSpy).toHaveBeenCalledOnce();

      // Timer should not cause another flush
      await vi.advanceTimersByTimeAsync(10_000);
      expect(fetchSpy).toHaveBeenCalledOnce();
    });

    it("start is idempotent", () => {
      const summarizer = createSummarizer({ intervalMs: 10_000 });
      summarizer.start();
      summarizer.start(); // Should not cause issues
      summarizer.stop();
    });
  });
});
