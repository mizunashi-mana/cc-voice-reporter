/* eslint-disable @typescript-eslint/naming-convention -- Zod schema convention uses PascalCase */
/**
 * JSONL parser and message extractor for Claude Code transcript files.
 *
 * Parses raw JSONL lines from TranscriptWatcher into typed records
 * using zod for schema validation. Extracts voice-reportable messages
 * (assistant text, tool_use) and filters out non-relevant records
 * (thinking, tool_result, progress, etc.).
 *
 * Defensive parsing: unknown content block types and unknown record
 * types are gracefully skipped rather than causing parse failures.
 * This ensures compatibility with future Claude Code versions.
 */

import { z } from 'zod';

// -- Content block schemas (used for per-block validation in extraction) --

const TextContentSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

const ToolUseContentSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.record(z.string(), z.unknown()),
});

/**
 * Loose content block schema for record-level parsing.
 * Accepts any object with a `type` field, allowing unknown content
 * block types to pass through without failing the parent record.
 */
const LooseContentBlockSchema = z.looseObject({ type: z.string() });

// -- Record schemas --

const AssistantRecordSchema = z.object({
  type: z.literal('assistant'),
  requestId: z.string(),
  message: z.object({
    role: z.literal('assistant'),
    content: z.array(LooseContentBlockSchema),
  }),
  uuid: z.string(),
  timestamp: z.string(),
});

const UserRecordSchema = z.object({
  type: z.literal('user'),
  message: z.object({
    role: z.literal('user'),
    content: z.unknown(),
  }),
  uuid: z.string(),
  timestamp: z.string(),
});

const ProgressRecordSchema = z.object({
  type: z.literal('progress'),
  data: z.record(z.string(), z.unknown()),
  uuid: z.string(),
  timestamp: z.string(),
});

const FileHistorySnapshotRecordSchema = z.object({
  type: z.literal('file-history-snapshot'),
  uuid: z.string().optional(),
  messageId: z.string().optional(),
  timestamp: z.string().optional(),
});

const SystemRecordSchema = z.object({
  type: z.literal('system'),
  subtype: z.string().optional(),
  durationMs: z.number().optional(),
  uuid: z.string(),
  timestamp: z.string(),
});

/** Schema for a raw JSON object's `type` field, used for dispatch. */
const RecordTypeSchema = z.object({
  type: z.enum([
    'assistant',
    'user',
    'progress',
    'file-history-snapshot',
    'system',
  ]),
});

// -- Exported types --

export type TextContent = z.infer<typeof TextContentSchema>;
export interface ThinkingContent {
  type: 'thinking';
  thinking: string;
}
export type ToolUseContent = z.infer<typeof ToolUseContentSchema>;
export type AssistantContentBlock
  = | TextContent
    | ThinkingContent
    | ToolUseContent;

export type AssistantRecord = z.infer<typeof AssistantRecordSchema>;
export type UserRecord = z.infer<typeof UserRecordSchema>;
export type ProgressRecord = z.infer<typeof ProgressRecordSchema>;
export type FileHistorySnapshotRecord = z.infer<
  typeof FileHistorySnapshotRecordSchema
>;
export type SystemRecord = z.infer<typeof SystemRecordSchema>;

export type TranscriptRecord
  = | AssistantRecord
    | UserRecord
    | ProgressRecord
    | FileHistorySnapshotRecord
    | SystemRecord;

// -- Extracted messages for voice reporting --

export interface ExtractedText {
  kind: 'text';
  text: string;
  requestId: string;
}

export interface ExtractedToolUse {
  kind: 'tool_use';
  toolName: string;
  toolInput: Record<string, unknown>;
  requestId: string;
}

export interface ExtractedTurnComplete {
  kind: 'turn_complete';
  durationMs: number | undefined;
}

export interface ExtractedUserResponse {
  kind: 'user_response';
}

export type ExtractedMessage
  = | ExtractedText
    | ExtractedToolUse
    | ExtractedTurnComplete
    | ExtractedUserResponse;

// -- Parse options --

export interface ParseOptions {
  /** Called when a known record type fails schema validation. */
  onWarn?: (message: string) => void;
}

// -- Schema map for dispatch --

const schemaByType = {
  'assistant': AssistantRecordSchema,
  'user': UserRecordSchema,
  'progress': ProgressRecordSchema,
  'file-history-snapshot': FileHistorySnapshotRecordSchema,
  'system': SystemRecordSchema,
} as const;

// -- Parser functions --

/**
 * Parse a single JSONL line into a TranscriptRecord.
 * Returns null if the line is invalid JSON, fails schema validation,
 * or has an unrecognized type.
 *
 * Unknown record types are silently skipped (expected for new versions).
 * Known record types that fail validation trigger onWarn (possible format change).
 */
export function parseLine(
  line: string,
  options?: ParseOptions,
): TranscriptRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  }
  catch {
    return null;
  }

  // Check type field first for fast dispatch
  const typeResult = RecordTypeSchema.safeParse(parsed);
  if (!typeResult.success) {
    // Unknown record type — expected for new Claude Code versions
    return null;
  }

  const schema = schemaByType[typeResult.data.type];
  const result = schema.safeParse(parsed);
  if (!result.success) {
    // Known type but validation failed — possible format change
    options?.onWarn?.(
      `Failed to validate ${typeResult.data.type} record: ${result.error.message}`,
    );
    return null;
  }

  return result.data as TranscriptRecord;
}

/**
 * Extract voice-reportable messages from a transcript record.
 *
 * Assistant and system (turn_duration) records produce messages.
 * Within an assistant record, each content block is validated individually:
 * - `text` content blocks are extracted (excluding whitespace-only blocks)
 * - `tool_use` content blocks are extracted
 * - `thinking` and unknown content block types are silently skipped
 *
 * This two-layer approach (loose record parse + strict block extraction)
 * ensures that unknown content block types don't prevent extraction of
 * known types from the same record.
 */
export function extractMessages(record: TranscriptRecord): ExtractedMessage[] {
  if (record.type === 'system') {
    if (record.subtype === 'turn_duration') {
      return [{ kind: 'turn_complete', durationMs: record.durationMs }];
    }
    return [];
  }

  if (record.type === 'user') {
    return [{ kind: 'user_response' }];
  }

  if (record.type !== 'assistant') {
    return [];
  }

  const messages: ExtractedMessage[] = [];

  for (const block of record.message.content) {
    switch (block.type) {
      case 'text': {
        const result = TextContentSchema.safeParse(block);
        if (result.success && !isEmptyTextBlock(result.data.text)) {
          messages.push({
            kind: 'text',
            text: result.data.text,
            requestId: record.requestId,
          });
        }
        break;
      }
      case 'tool_use': {
        const result = ToolUseContentSchema.safeParse(block);
        if (result.success) {
          messages.push({
            kind: 'tool_use',
            toolName: result.data.name,
            toolInput: result.data.input,
            requestId: record.requestId,
          });
        }
        break;
      }
      // thinking and unknown types are silently skipped
    }
  }

  return messages;
}

/**
 * Process multiple JSONL lines and return all extracted messages.
 */
export function processLines(
  lines: string[],
  options?: ParseOptions,
): ExtractedMessage[] {
  const messages: ExtractedMessage[] = [];
  for (const line of lines) {
    const record = parseLine(line, options);
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
