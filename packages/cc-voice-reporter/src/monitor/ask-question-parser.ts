/**
 * AskUserQuestion input parser.
 *
 * Validates and extracts question text from AskUserQuestion tool_use input
 * using a Zod schema. Used by the Daemon to determine what to announce
 * when Claude asks the user a question.
 */

import { z } from 'zod';
import { ensureTrailingDelimiter } from './summarizer-prompt.js';

/** Schema for AskUserQuestion input validation. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- Zod schema convention
const AskUserQuestionInputSchema = z.object({
  questions: z
    .array(z.looseObject({ question: z.string() }))
    .min(1),
});

/**
 * Extract the question text from an AskUserQuestion tool_use input.
 * Returns null if the input doesn't contain valid questions.
 */
export function extractAskUserQuestion(
  input: Record<string, unknown>,
): string | null {
  const result = AskUserQuestionInputSchema.safeParse(input);
  if (!result.success) return null;

  return result.data.questions.map(q => ensureTrailingDelimiter(q.question)).join(' ');
}
