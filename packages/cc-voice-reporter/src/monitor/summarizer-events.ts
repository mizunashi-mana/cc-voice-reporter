/**
 * Summarizer event types and factory functions.
 *
 * Defines the ActivityEvent union (ToolUseEvent | TextEvent) and provides
 * factory functions to create events from parsed transcript messages.
 * Tool detail extraction logic lives here so event creation is self-contained.
 */

/** A recorded tool_use event. */
export interface ToolUseEvent {
  kind: 'tool_use';
  toolName: string;
  /** Brief description extracted from tool input (e.g., file path). */
  detail: string;
  /** Session identifier for session-scoped context. */
  session?: string;
}

/** A recorded text response event. */
export interface TextEvent {
  kind: 'text';
  /** First portion of the text response. */
  snippet: string;
  /** Session identifier for session-scoped context. */
  session?: string;
}

export type ActivityEvent = ToolUseEvent | TextEvent;

/** Maximum snippet length for text events. */
const MAX_SNIPPET_LENGTH = 80;

/** Map of tools whose detail is a single string field. */
const SINGLE_FIELD_TOOLS: Readonly<Record<string, string>> = {
  Read: 'file_path',
  Write: 'file_path',
  Edit: 'file_path',
  NotebookEdit: 'notebook_path',
  Bash: 'command',
  TaskCreate: 'subject',
  TeamCreate: 'team_name',
  Task: 'description',
  Skill: 'skill',
  WebSearch: 'query',
  WebFetch: 'url',
};

/** Extract the first question text from an AskUserQuestion input. */
function extractFirstQuestion(questions: unknown): string {
  if (!Array.isArray(questions) || questions.length === 0) return '';
  const first: unknown = questions[0];
  if (typeof first !== 'object' || first === null) return '';
  const q: unknown = 'question' in first
    ? (first as Record<string, unknown>).question
    : undefined;
  return typeof q === 'string' ? q : '';
}

/**
 * Extract a brief detail string from a tool_use input.
 * Returns an empty string if no useful detail is found.
 * Exported for testing.
 */
export function extractToolDetail(
  toolName: string,
  input: Record<string, unknown>,
): string {
  const fieldName = SINGLE_FIELD_TOOLS[toolName];
  if (fieldName !== undefined) {
    return typeof input[fieldName] === 'string' ? (input[fieldName]) : '';
  }

  switch (toolName) {
    case 'Grep':
    case 'Glob': {
      const pattern
        = typeof input.pattern === 'string' ? (input.pattern) : '';
      const path
        = typeof input.path === 'string' ? (input.path) : '';
      return path.length > 0 ? `${pattern} in ${path}` : pattern;
    }
    case 'TaskUpdate': {
      const status
        = typeof input.status === 'string' ? (input.status) : '';
      const subject
        = typeof input.subject === 'string' ? (input.subject) : '';
      if (status.length > 0 && subject.length > 0) {
        return `${status} ${subject}`;
      }
      return status.length > 0 ? status : subject;
    }
    case 'SendMessage': {
      const recipient
        = typeof input.recipient === 'string' ? (input.recipient) : '';
      const summary
        = typeof input.summary === 'string' ? (input.summary) : '';
      if (recipient.length > 0 && summary.length > 0) {
        return `to ${recipient}: "${summary}"`;
      }
      return recipient.length > 0 ? recipient : summary;
    }
    case 'AskUserQuestion':
      return extractFirstQuestion(input.questions);
    default:
      return '';
  }
}

/**
 * Create an ActivityEvent from a parsed ExtractedToolUse message.
 * Exported for use by Daemon.
 */
export function createToolUseEvent(
  toolName: string,
  toolInput: Record<string, unknown>,
  session?: string,
): ToolUseEvent {
  return {
    kind: 'tool_use',
    toolName,
    detail: extractToolDetail(toolName, toolInput),
    session,
  };
}

/**
 * Create an ActivityEvent from a text message snippet.
 * Exported for use by Daemon.
 */
export function createTextEvent(text: string, session?: string): TextEvent {
  const snippet
    = text.length > MAX_SNIPPET_LENGTH
      ? `${text.slice(0, MAX_SNIPPET_LENGTH)}…`
      : text;
  return {
    kind: 'text',
    snippet,
    session,
  };
}
