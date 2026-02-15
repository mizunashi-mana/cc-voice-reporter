import { describe, expect, it } from "vitest";
import {
  parseLine,
  extractMessages,
  processLines,
  type TranscriptRecord,
  type ParseOptions,
} from "./parser.js";

describe("parseLine", () => {
  it("parses an assistant record with text content", () => {
    const line = JSON.stringify({
      type: "assistant",
      requestId: "req_001",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
      },
      uuid: "uuid-1",
      timestamp: "2026-01-01T00:00:00Z",
    });

    const result = parseLine(line);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("assistant");
  });

  it("parses an assistant record with tool_use content", () => {
    const line = JSON.stringify({
      type: "assistant",
      requestId: "req_002",
      message: {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "toolu_001",
            name: "Read",
            input: { file_path: "/tmp/test.ts" },
          },
        ],
      },
      uuid: "uuid-2",
      timestamp: "2026-01-01T00:00:01Z",
    });

    const result = parseLine(line);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("assistant");
  });

  it("parses a user record", () => {
    const line = JSON.stringify({
      type: "user",
      message: { role: "user", content: "Hello" },
      uuid: "uuid-3",
      timestamp: "2026-01-01T00:00:02Z",
    });

    const result = parseLine(line);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("user");
  });

  it("parses a progress record", () => {
    const line = JSON.stringify({
      type: "progress",
      data: { type: "hook_progress", hookEvent: "PostToolUse" },
      uuid: "uuid-4",
      timestamp: "2026-01-01T00:00:03Z",
    });

    const result = parseLine(line);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("progress");
  });

  it("parses a file-history-snapshot record", () => {
    const line = JSON.stringify({
      type: "file-history-snapshot",
      messageId: "msg-1",
    });

    const result = parseLine(line);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("file-history-snapshot");
  });

  it("parses a system record", () => {
    const line = JSON.stringify({
      type: "system",
      subtype: "turn_duration",
      durationMs: 1000,
      uuid: "uuid-5",
      timestamp: "2026-01-01T00:00:04Z",
    });

    const result = parseLine(line);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("system");
  });

  it("returns null for invalid JSON", () => {
    expect(parseLine("not valid json")).toBeNull();
  });

  it("returns null for non-object JSON", () => {
    expect(parseLine('"just a string"')).toBeNull();
    expect(parseLine("42")).toBeNull();
    expect(parseLine("null")).toBeNull();
  });

  it("returns null for unknown record type", () => {
    const line = JSON.stringify({ type: "unknown_type", data: {} });
    expect(parseLine(line)).toBeNull();
  });

  it("handles records with extra fields gracefully", () => {
    const line = JSON.stringify({
      type: "assistant",
      requestId: "req_003",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "hi" }],
      },
      uuid: "uuid-6",
      timestamp: "2026-01-01T00:00:05Z",
      parentUuid: "parent-1",
      isSidechain: false,
      sessionId: "session-1",
      version: "2.1.42",
      gitBranch: "main",
    });

    const result = parseLine(line);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("assistant");
  });
});

describe("extractMessages", () => {
  it("extracts text content from assistant record", () => {
    const record: TranscriptRecord = {
      type: "assistant",
      requestId: "req_001",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "実装を開始します。" }],
      },
      uuid: "uuid-1",
      timestamp: "2026-01-01T00:00:00Z",
    };

    const messages = extractMessages(record);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({
      kind: "text",
      text: "実装を開始します。",
      requestId: "req_001",
    });
  });

  it("extracts tool_use content from assistant record", () => {
    const record: TranscriptRecord = {
      type: "assistant",
      requestId: "req_002",
      message: {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "toolu_001",
            name: "Read",
            input: { file_path: "/tmp/test.ts" },
          },
        ],
      },
      uuid: "uuid-2",
      timestamp: "2026-01-01T00:00:01Z",
    };

    const messages = extractMessages(record);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({
      kind: "tool_use",
      toolName: "Read",
      toolInput: { file_path: "/tmp/test.ts" },
      requestId: "req_002",
    });
  });

  it("extracts multiple content blocks from one record", () => {
    const record: TranscriptRecord = {
      type: "assistant",
      requestId: "req_003",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "ファイルを確認します。" },
          {
            type: "tool_use",
            id: "toolu_002",
            name: "Glob",
            input: { pattern: "**/*.ts" },
          },
        ],
      },
      uuid: "uuid-3",
      timestamp: "2026-01-01T00:00:02Z",
    };

    const messages = extractMessages(record);
    expect(messages).toHaveLength(2);
    expect(messages[0]!.kind).toBe("text");
    expect(messages[1]!.kind).toBe("tool_use");
  });

  it("skips empty text blocks (whitespace only)", () => {
    const record: TranscriptRecord = {
      type: "assistant",
      requestId: "req_004",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "\n\n" }],
      },
      uuid: "uuid-4",
      timestamp: "2026-01-01T00:00:03Z",
    };

    const messages = extractMessages(record);
    expect(messages).toHaveLength(0);
  });

  it("skips thinking content blocks", () => {
    const record: TranscriptRecord = {
      type: "assistant",
      requestId: "req_005",
      message: {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "Let me think about this..." },
        ],
      },
      uuid: "uuid-5",
      timestamp: "2026-01-01T00:00:04Z",
    };

    const messages = extractMessages(record);
    expect(messages).toHaveLength(0);
  });

  it("skips thinking but keeps text and tool_use in mixed content", () => {
    const record: TranscriptRecord = {
      type: "assistant",
      requestId: "req_006",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "\n\n" },
          { type: "thinking", thinking: "analyzing..." },
          { type: "text", text: "結果を報告します。" },
          {
            type: "tool_use",
            id: "toolu_003",
            name: "Bash",
            input: { command: "npm test" },
          },
        ],
      },
      uuid: "uuid-6",
      timestamp: "2026-01-01T00:00:05Z",
    };

    const messages = extractMessages(record);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({
      kind: "text",
      text: "結果を報告します。",
      requestId: "req_006",
    });
    expect(messages[1]).toEqual({
      kind: "tool_use",
      toolName: "Bash",
      toolInput: { command: "npm test" },
      requestId: "req_006",
    });
  });

  it("returns empty array for user records", () => {
    const record: TranscriptRecord = {
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "tool_result" as never,
            tool_use_id: "toolu_001",
            content: "file contents...",
          },
        ] as never,
      },
      uuid: "uuid-7",
      timestamp: "2026-01-01T00:00:06Z",
    };

    expect(extractMessages(record)).toHaveLength(0);
  });

  it("returns empty array for progress records", () => {
    const record: TranscriptRecord = {
      type: "progress",
      data: { type: "hook_progress" },
      uuid: "uuid-8",
      timestamp: "2026-01-01T00:00:07Z",
    };

    expect(extractMessages(record)).toHaveLength(0);
  });

  it("returns empty array for file-history-snapshot records", () => {
    const record: TranscriptRecord = {
      type: "file-history-snapshot",
      messageId: "msg-1",
    };

    expect(extractMessages(record)).toHaveLength(0);
  });

  it("returns empty array for system records", () => {
    const record: TranscriptRecord = {
      type: "system",
      subtype: "turn_duration",
      uuid: "uuid-9",
      timestamp: "2026-01-01T00:00:08Z",
    };

    expect(extractMessages(record)).toHaveLength(0);
  });
});

describe("processLines", () => {
  it("processes multiple JSONL lines and extracts messages", () => {
    const lines = [
      JSON.stringify({
        type: "assistant",
        requestId: "req_001",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "\n\n" }],
        },
        uuid: "uuid-1",
        timestamp: "2026-01-01T00:00:00Z",
      }),
      JSON.stringify({
        type: "assistant",
        requestId: "req_001",
        message: {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "Let me analyze..." },
          ],
        },
        uuid: "uuid-2",
        timestamp: "2026-01-01T00:00:01Z",
      }),
      JSON.stringify({
        type: "assistant",
        requestId: "req_001",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "ファイルを確認します。" },
          ],
        },
        uuid: "uuid-3",
        timestamp: "2026-01-01T00:00:02Z",
      }),
      JSON.stringify({
        type: "assistant",
        requestId: "req_001",
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "toolu_001",
              name: "Read",
              input: { file_path: "/tmp/test.ts" },
            },
          ],
        },
        uuid: "uuid-4",
        timestamp: "2026-01-01T00:00:03Z",
      }),
      JSON.stringify({
        type: "progress",
        data: { type: "hook_progress" },
        uuid: "uuid-5",
        timestamp: "2026-01-01T00:00:04Z",
      }),
      JSON.stringify({
        type: "user",
        message: {
          role: "user",
          content: [
            { type: "tool_result", tool_use_id: "toolu_001", content: "..." },
          ],
        },
        uuid: "uuid-6",
        timestamp: "2026-01-01T00:00:05Z",
      }),
    ];

    const messages = processLines(lines);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({
      kind: "text",
      text: "ファイルを確認します。",
      requestId: "req_001",
    });
    expect(messages[1]).toEqual({
      kind: "tool_use",
      toolName: "Read",
      toolInput: { file_path: "/tmp/test.ts" },
      requestId: "req_001",
    });
  });

  it("skips invalid JSON lines gracefully", () => {
    const lines = [
      "not valid json",
      JSON.stringify({
        type: "assistant",
        requestId: "req_001",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "有効な行です。" }],
        },
        uuid: "uuid-1",
        timestamp: "2026-01-01T00:00:00Z",
      }),
      "{incomplete json",
    ];

    const messages = processLines(lines);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.kind).toBe("text");
  });

  it("returns empty array for empty input", () => {
    expect(processLines([])).toHaveLength(0);
  });

  it("handles a realistic streaming sequence", () => {
    // Simulates: initial empty text → thinking → real text → tool_use → tool_result → text
    const lines = [
      // Initial empty text block
      JSON.stringify({
        type: "assistant",
        requestId: "req_A",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "\n\n" }],
        },
        uuid: "u1",
        timestamp: "2026-01-01T00:00:00Z",
      }),
      // Thinking block
      JSON.stringify({
        type: "assistant",
        requestId: "req_A",
        message: {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "I need to check the file first." },
          ],
        },
        uuid: "u2",
        timestamp: "2026-01-01T00:00:01Z",
      }),
      // Real text response
      JSON.stringify({
        type: "assistant",
        requestId: "req_A",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "autodev-init スキルを開始します。" },
          ],
        },
        uuid: "u3",
        timestamp: "2026-01-01T00:00:02Z",
      }),
      // Tool use
      JSON.stringify({
        type: "assistant",
        requestId: "req_A",
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "toolu_X",
              name: "Glob",
              input: { pattern: ".ai-agent/**/*" },
            },
          ],
        },
        uuid: "u4",
        timestamp: "2026-01-01T00:00:03Z",
      }),
      // Progress (hook)
      JSON.stringify({
        type: "progress",
        data: { type: "hook_progress", hookEvent: "PostToolUse" },
        parentToolUseID: "toolu_X",
        uuid: "u5",
        timestamp: "2026-01-01T00:00:04Z",
      }),
      // Tool result
      JSON.stringify({
        type: "user",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_X",
              content: "file1.ts\nfile2.ts",
            },
          ],
        },
        uuid: "u6",
        timestamp: "2026-01-01T00:00:05Z",
      }),
      // File history snapshot
      JSON.stringify({
        type: "file-history-snapshot",
        messageId: "msg-1",
        snapshot: { trackedFileBackups: {} },
      }),
      // Next text response
      JSON.stringify({
        type: "assistant",
        requestId: "req_B",
        message: {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "既存の設定を確認しました。",
            },
          ],
        },
        uuid: "u7",
        timestamp: "2026-01-01T00:00:06Z",
      }),
    ];

    const messages = processLines(lines);
    expect(messages).toEqual([
      {
        kind: "text",
        text: "autodev-init スキルを開始します。",
        requestId: "req_A",
      },
      {
        kind: "tool_use",
        toolName: "Glob",
        toolInput: { pattern: ".ai-agent/**/*" },
        requestId: "req_A",
      },
      {
        kind: "text",
        text: "既存の設定を確認しました。",
        requestId: "req_B",
      },
    ]);
  });
});

describe("defensive parsing", () => {
  describe("unknown content block types", () => {
    it("parses assistant record with unknown content type alongside text", () => {
      const line = JSON.stringify({
        type: "assistant",
        requestId: "req_def_001",
        message: {
          role: "assistant",
          content: [
            { type: "server_tool_use", id: "srvtool_1", name: "mcp_fetch" },
            { type: "text", text: "結果を確認します。" },
          ],
        },
        uuid: "uuid-def-1",
        timestamp: "2026-01-01T00:00:00Z",
      });

      const record = parseLine(line);
      expect(record).not.toBeNull();
      expect(record!.type).toBe("assistant");

      const messages = extractMessages(record!);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        kind: "text",
        text: "結果を確認します。",
        requestId: "req_def_001",
      });
    });

    it("parses assistant record with only unknown content types", () => {
      const line = JSON.stringify({
        type: "assistant",
        requestId: "req_def_002",
        message: {
          role: "assistant",
          content: [
            { type: "image", url: "https://example.com/img.png" },
            { type: "audio", data: "base64..." },
          ],
        },
        uuid: "uuid-def-2",
        timestamp: "2026-01-01T00:00:01Z",
      });

      const record = parseLine(line);
      expect(record).not.toBeNull();

      const messages = extractMessages(record!);
      expect(messages).toHaveLength(0);
    });

    it("extracts tool_use alongside unknown content types", () => {
      const line = JSON.stringify({
        type: "assistant",
        requestId: "req_def_003",
        message: {
          role: "assistant",
          content: [
            { type: "mcp_tool_use", server: "github", tool: "search" },
            {
              type: "tool_use",
              id: "toolu_def",
              name: "Read",
              input: { file_path: "/tmp/test.ts" },
            },
          ],
        },
        uuid: "uuid-def-3",
        timestamp: "2026-01-01T00:00:02Z",
      });

      const messages = processLines([line]);
      expect(messages).toHaveLength(1);
      expect(messages[0]!.kind).toBe("tool_use");
    });
  });

  describe("onWarn callback", () => {
    it("calls onWarn when a known record type fails validation", () => {
      const warnings: string[] = [];
      const options: ParseOptions = {
        onWarn: (msg) => warnings.push(msg),
      };

      // assistant record missing required 'requestId' field
      const line = JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "hello" }],
        },
        uuid: "uuid-warn-1",
        timestamp: "2026-01-01T00:00:00Z",
      });

      const result = parseLine(line, options);
      expect(result).toBeNull();
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("assistant");
    });

    it("does not call onWarn for unknown record types", () => {
      const warnings: string[] = [];
      const options: ParseOptions = {
        onWarn: (msg) => warnings.push(msg),
      };

      const line = JSON.stringify({
        type: "new_future_type",
        data: { key: "value" },
      });

      const result = parseLine(line, options);
      expect(result).toBeNull();
      expect(warnings).toHaveLength(0);
    });

    it("does not call onWarn for invalid JSON", () => {
      const warnings: string[] = [];
      const options: ParseOptions = {
        onWarn: (msg) => warnings.push(msg),
      };

      const result = parseLine("not valid json", options);
      expect(result).toBeNull();
      expect(warnings).toHaveLength(0);
    });

    it("passes onWarn through processLines", () => {
      const warnings: string[] = [];
      const options: ParseOptions = {
        onWarn: (msg) => warnings.push(msg),
      };

      const lines = [
        // Valid line
        JSON.stringify({
          type: "assistant",
          requestId: "req_1",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "OK" }],
          },
          uuid: "u1",
          timestamp: "2026-01-01T00:00:00Z",
        }),
        // Invalid assistant (missing requestId)
        JSON.stringify({
          type: "assistant",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "fail" }],
          },
          uuid: "u2",
          timestamp: "2026-01-01T00:00:01Z",
        }),
      ];

      const messages = processLines(lines, options);
      expect(messages).toHaveLength(1);
      expect(messages[0]!.kind).toBe("text");
      expect(warnings).toHaveLength(1);
    });
  });

  describe("content block validation failures", () => {
    it("skips text block with missing text field", () => {
      const line = JSON.stringify({
        type: "assistant",
        requestId: "req_cv_001",
        message: {
          role: "assistant",
          content: [
            { type: "text" },
            { type: "text", text: "有効なテキスト" },
          ],
        },
        uuid: "uuid-cv-1",
        timestamp: "2026-01-01T00:00:00Z",
      });

      const record = parseLine(line);
      expect(record).not.toBeNull();

      const messages = extractMessages(record!);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        kind: "text",
        text: "有効なテキスト",
        requestId: "req_cv_001",
      });
    });

    it("skips tool_use block with missing name field", () => {
      const line = JSON.stringify({
        type: "assistant",
        requestId: "req_cv_002",
        message: {
          role: "assistant",
          content: [
            { type: "tool_use", id: "toolu_bad" },
            {
              type: "tool_use",
              id: "toolu_ok",
              name: "Bash",
              input: { command: "ls" },
            },
          ],
        },
        uuid: "uuid-cv-2",
        timestamp: "2026-01-01T00:00:01Z",
      });

      const record = parseLine(line);
      expect(record).not.toBeNull();

      const messages = extractMessages(record!);
      expect(messages).toHaveLength(1);
      expect(messages[0]!.kind).toBe("tool_use");
    });
  });
});
