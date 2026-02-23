/**
 * Summarizer prompt construction and text utilities.
 *
 * Builds the system prompt and user prompt for the Ollama-based summary
 * generation. Handles event selection/filtering when the number of events
 * exceeds the configured limit.
 */

import type { ActivityEvent } from './summarizer-events.js';

/**
 * Default maximum number of events to include in the prompt.
 * When exceeded, events are filtered and truncated to prevent
 * Ollama context window overflow or request timeouts.
 */
const DEFAULT_MAX_PROMPT_EVENTS = 10;

/**
 * Characters that count as sentence-ending delimiters.
 * Includes comma (`,`) because LLM-generated narrations sometimes end
 * mid-clause; treating commas as valid delimiters avoids appending an
 * unnecessary period after them.
 */
const SENTENCE_DELIMITERS = '。.,？?！!';

/**
 * Map a language code to a human-readable language name for LLM prompts.
 * Falls back to the code itself for unmapped languages.
 * Exported for testing.
 */
export function resolveLanguageName(code: string): string {
  const map: Record<string, string> = {
    ja: 'Japanese',
    en: 'English',
    zh: 'Chinese',
    ko: 'Korean',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    pt: 'Portuguese',
    ru: 'Russian',
  };
  return map[code] ?? code;
}

/**
 * Build the system prompt for the narration-style summary.
 * The language parameter determines the output language.
 * Exported for testing.
 */
export function buildSystemPrompt(language: string): string {
  const langName = resolveLanguageName(language);
  return [
    'You are Claude Code, an AI coding assistant.',
    'You will receive a log of your recent actions (tool calls and text outputs), and optionally up to two previous narrations for context.',
    'Narrate what you are doing in the first person, as a brief live commentary.',
    'When previous narrations are provided, build on them — maintain a consistent tone and style, describe what changed since then and how the work is progressing, rather than repeating what was already said.',
    'Consider the flow and story of the work — not just listing operations, but explaining the intent behind them.',
    'Keep it to 1-2 short sentences, suitable for text-to-speech.',
    'Preserve file names, command names, and code elements as-is.',
    `Output in ${langName} only. Output ONLY the narration, nothing else.`,
  ].join(' ');
}

/**
 * Select events for the prompt, applying filtering when the number of
 * events exceeds `maxPromptEvents`:
 *
 * - When text events exist: only text events are kept, truncated to the
 *   first `maxPromptEvents` entries.
 * - When no text events exist: all events are truncated to the first
 *   `maxPromptEvents` entries.
 *
 * Returns the selected events and the number omitted.
 * Exported for testing.
 */
export function selectEventsForPrompt(
  events: ActivityEvent[],
  maxPromptEvents: number = DEFAULT_MAX_PROMPT_EVENTS,
): { selected: ActivityEvent[]; omitted: number } {
  if (events.length <= maxPromptEvents) {
    return { selected: events, omitted: 0 };
  }

  const textEvents = events.filter(e => e.kind === 'text');

  if (textEvents.length > 0) {
    const selected = textEvents.slice(0, maxPromptEvents);
    return { selected, omitted: events.length - selected.length };
  }

  const selected = events.slice(0, maxPromptEvents);
  return { selected, omitted: events.length - selected.length };
}

/**
 * Build a prompt describing the collected activity events.
 * When previousSummaries are provided, they are included as context
 * so the LLM can build on the narrative continuity.
 *
 * When the number of events exceeds the threshold, events are filtered
 * and truncated via `selectEventsForPrompt` to prevent prompt overflow.
 *
 * Exported for testing.
 */
export function buildPrompt(
  events: ActivityEvent[],
  previousSummaries?: string[],
  maxPromptEvents?: number,
): string {
  const { selected, omitted } = selectEventsForPrompt(events, maxPromptEvents);
  const lines: string[] = [];

  const summaries = previousSummaries?.filter(s => s.length > 0) ?? [];
  if (summaries.length > 0) {
    lines.push(`Previous narration: ${summaries.map(ensureTrailingDelimiter).join(' ')}`);
    lines.push('');
  }

  if (omitted > 0) {
    lines.push(`Recent actions (${omitted} actions omitted, showing first ${selected.length} of ${events.length}):`);
  }
  else {
    lines.push('Recent actions:');
  }

  for (let i = 0; i < selected.length; i += 1) {
    const event = selected[i];
    if (event === undefined) continue;
    lines.push('---');
    const step = `${i + 1}.`;
    if (event.kind === 'tool_use') {
      if (event.detail.length > 0) {
        lines.push(`${step} ${event.toolName}: ${event.detail}`);
      }
      else {
        lines.push(`${step} ${event.toolName}`);
      }
    }
    else {
      lines.push(`${step} Message: ${event.snippet}`);
    }
  }

  return lines.join('\n');
}

/**
 * Ensure a text string ends with a sentence delimiter.
 * If the trimmed text does not end with one of the recognised delimiters,
 * a period (`.`) is appended.
 * Exported for testing and for use by Daemon.
 */
export function ensureTrailingDelimiter(text: string): string {
  const trimmed = text.trimEnd();
  if (trimmed.length === 0) return trimmed;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- length > 0 guarantees last char exists
  if (SENTENCE_DELIMITERS.includes(trimmed[trimmed.length - 1]!)) {
    return trimmed;
  }
  return `${trimmed}.`;
}
