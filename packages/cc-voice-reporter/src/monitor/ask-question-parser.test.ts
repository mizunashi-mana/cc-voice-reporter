import { describe, expect, it } from 'vitest';
import { extractAskUserQuestion } from './ask-question-parser.js';

describe('extractAskUserQuestion', () => {
  it('extracts a single question', () => {
    const result = extractAskUserQuestion({
      questions: [
        { question: 'Which option?', header: 'Choice', options: [], multiSelect: false },
      ],
    });
    expect(result).toBe('Which option?');
  });

  it('joins multiple questions with trailing delimiters', () => {
    const result = extractAskUserQuestion({
      questions: [
        { question: 'Question 1?', header: 'Q1', options: [], multiSelect: false },
        { question: 'Question 2?', header: 'Q2', options: [], multiSelect: false },
      ],
    });
    expect(result).toBe('Question 1? Question 2?');
  });

  it('returns null for empty questions array', () => {
    const result = extractAskUserQuestion({ questions: [] });
    expect(result).toBeNull();
  });

  it('returns null for missing questions field', () => {
    const result = extractAskUserQuestion({});
    expect(result).toBeNull();
  });

  it('returns null for non-array questions', () => {
    const result = extractAskUserQuestion({ questions: 'not an array' });
    expect(result).toBeNull();
  });

  it('returns null when question field is missing from item', () => {
    const result = extractAskUserQuestion({
      questions: [{ header: 'H', options: [] }],
    });
    expect(result).toBeNull();
  });

  it('adds trailing delimiter to questions without one', () => {
    const result = extractAskUserQuestion({
      questions: [
        { question: 'No delimiter here', header: 'Q', options: [], multiSelect: false },
      ],
    });
    // ensureTrailingDelimiter adds a period
    expect(result).toBe('No delimiter here.');
  });
});
