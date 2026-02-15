/**
 * JSONL parser and message extractor for Claude Code transcript files.
 *
 * Parses raw JSONL lines from TranscriptWatcher into typed records
 * using zod for schema validation. Extracts voice-reportable messages
 * (assistant text, tool_use) and filters out non-relevant records
 * (thinking, tool_result, progress, etc.).
 */

import { z } from "zod";

// -- Content block schemas --

const TextContentSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

const ThinkingContentSchema = z.object({
  type: z.literal("thinking"),
  thinking: z.string(),
});

const ToolUseContentSchema = z.object({
  type: z.literal("tool_use"),
  id: z.string(),
  name: z.string(),
  input: z.record(z.string(), z.unknown()),
});

const AssistantContentBlockSchema = z.discriminatedUnion("type", [
  TextContentSchema,
  ThinkingContentSchema,
  ToolUseContentSchema,
]);

// -- Record schemas --

const AssistantRecordSchema = z.object({
  type: z.literal("assistant"),
  requestId: z.string(),
  message: z.object({
    role: z.literal("assistant"),
    content: z.array(AssistantContentBlockSchema),
  }),
  uuid: z.string(),
  timestamp: z.string(),
});

const UserRecordSchema = z.object({
  type: z.literal("user"),
  message: z.object({
    role: z.literal("user"),
    content: z.unknown(),
  }),
  uuid: z.string(),
  timestamp: z.string(),
});

const ProgressRecordSchema = z.object({
  type: z.literal("progress"),
  data: z.record(z.string(), z.unknown()),
  uuid: z.string(),
  timestamp: z.string(),
});

const FileHistorySnapshotRecordSchema = z.object({
  type: z.literal("file-history-snapshot"),
  uuid: z.string().optional(),
  messageId: z.string().optional(),
  timestamp: z.string().optional(),
});

const SystemRecordSchema = z.object({
  type: z.literal("system"),
  subtype: z.string().optional(),
  uuid: z.string(),
  timestamp: z.string(),
});

/** Schema for a raw JSON object's `type` field, used for dispatch. */
const RecordTypeSchema = z.object({
  type: z.enum([
    "assistant",
    "user",
    "progress",
    "file-history-snapshot",
    "system",
  ]),
});

// -- Exported types (inferred from schemas) --

export type TextContent = z.infer<typeof TextContentSchema>;
export type ThinkingContent = z.infer<typeof ThinkingContentSchema>;
export type ToolUseContent = z.infer<typeof ToolUseContentSchema>;
export type AssistantContentBlock = z.infer<
  typeof AssistantContentBlockSchema
>;

export type AssistantRecord = z.infer<typeof AssistantRecordSchema>;
export type UserRecord = z.infer<typeof UserRecordSchema>;
export type ProgressRecord = z.infer<typeof ProgressRecordSchema>;
export type FileHistorySnapshotRecord = z.infer<
  typeof FileHistorySnapshotRecordSchema
>;
export type SystemRecord = z.infer<typeof SystemRecordSchema>;

export type TranscriptRecord =
  | AssistantRecord
  | UserRecord
  | ProgressRecord
  | FileHistorySnapshotRecord
  | SystemRecord;

// -- Extracted messages for voice reporting --

export interface ExtractedText {
  kind: "text";
  text: string;
  requestId: string;
}

export interface ExtractedToolUse {
  kind: "tool_use";
  toolName: string;
  toolInput: Record<string, unknown>;
  requestId: string;
}

export type ExtractedMessage = ExtractedText | ExtractedToolUse;

// -- Schema map for dispatch --

const schemaByType = {
  assistant: AssistantRecordSchema,
  user: UserRecordSchema,
  progress: ProgressRecordSchema,
  "file-history-snapshot": FileHistorySnapshotRecordSchema,
  system: SystemRecordSchema,
} as const;

// -- Parser functions --

/**
 * Parse a single JSONL line into a TranscriptRecord.
 * Returns null if the line is invalid JSON, fails schema validation,
 * or has an unrecognized type.
 */
export function parseLine(line: string): TranscriptRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }

  // Check type field first for fast dispatch
  const typeResult = RecordTypeSchema.safeParse(parsed);
  if (!typeResult.success) {
    return null;
  }

  const schema = schemaByType[typeResult.data.type];
  const result = schema.safeParse(parsed);
  if (!result.success) {
    return null;
  }

  return result.data as TranscriptRecord;
}

/**
 * Extract voice-reportable messages from a transcript record.
 *
 * Only assistant records produce messages. Within an assistant record:
 * - `text` content blocks are extracted (excluding whitespace-only blocks)
 * - `tool_use` content blocks are extracted
 * - `thinking` content blocks are ignored
 *
 * User records (tool_result), progress, file-history-snapshot, and system
 * records are all filtered out.
 */
export function extractMessages(record: TranscriptRecord): ExtractedMessage[] {
  if (record.type !== "assistant") {
    return [];
  }

  const messages: ExtractedMessage[] = [];

  for (const block of record.message.content) {
    switch (block.type) {
      case "text":
        if (!isEmptyTextBlock(block.text)) {
          messages.push({
            kind: "text",
            text: block.text,
            requestId: record.requestId,
          });
        }
        break;
      case "tool_use":
        messages.push({
          kind: "tool_use",
          toolName: block.name,
          toolInput: block.input,
          requestId: record.requestId,
        });
        break;
      // thinking is silently skipped
    }
  }

  return messages;
}

/**
 * Process multiple JSONL lines and return all extracted messages.
 */
export function processLines(lines: string[]): ExtractedMessage[] {
  const messages: ExtractedMessage[] = [];
  for (const line of lines) {
    const record = parseLine(line);
    if (record !== null) {
      messages.push(...extractMessages(record));
    }
  }
  return messages;
}

/**
 * Check if a text block is an "empty" initial block that should be skipped.
 * Claude often emits a text block containing only whitespace/newlines
 * at the start of a response.
 */
function isEmptyTextBlock(text: string): boolean {
  return text.trim().length === 0;
}
