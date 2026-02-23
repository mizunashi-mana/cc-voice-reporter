import { describe, expect, it } from 'vitest';
import {
  extractToolDetail,
  createToolUseEvent,
  createTextEvent,
} from './summarizer-events.js';

describe('extractToolDetail', () => {
  it.each([
    ['Read', { file_path: '/src/app.ts' }, '/src/app.ts'],
    ['Edit', { file_path: '/src/config.ts' }, '/src/config.ts'],
    ['Write', { file_path: '/src/new.ts' }, '/src/new.ts'],
    ['NotebookEdit', { notebook_path: '/nb/test.ipynb' }, '/nb/test.ipynb'],
    ['Bash', { command: 'npm test' }, 'npm test'],
    ['TaskCreate', { subject: 'PR #123 をレビュー' }, 'PR #123 をレビュー'],
    ['TeamCreate', { team_name: 'review-pr-123' }, 'review-pr-123'],
    ['Task', { description: 'Review PR #116' }, 'Review PR #116'],
    ['Skill', { skill: 'commit' }, 'commit'],
    ['WebSearch', { query: 'TypeScript best practices' }, 'TypeScript best practices'],
    ['WebFetch', { url: 'https://example.com' }, 'https://example.com'],
  ] as const)('extracts single field from %s', (tool, input, expected) => {
    expect(extractToolDetail(tool, input)).toBe(expected);
  });

  it('extracts pattern from Grep', () => {
    expect(extractToolDetail('Grep', { pattern: 'TODO' })).toBe('TODO');
  });

  it('extracts pattern and path from Grep', () => {
    expect(extractToolDetail('Grep', { pattern: 'TODO', path: '/src' })).toBe('TODO in /src');
  });

  it('extracts pattern from Glob', () => {
    expect(extractToolDetail('Glob', { pattern: '**/*.ts' })).toBe('**/*.ts');
  });

  it.each([
    [{ status: 'completed' }, 'completed'],
    [{ status: 'completed', subject: 'PR #123 をレビュー' }, 'completed PR #123 をレビュー'],
    [{ subject: 'PR #123 をレビュー' }, 'PR #123 をレビュー'],
    [{}, ''],
  ] as const)('extracts detail from TaskUpdate with %o', (input, expected) => {
    expect(extractToolDetail('TaskUpdate', input)).toBe(expected);
  });

  it.each([
    [{ recipient: 'researcher', summary: 'コード調査完了の報告' }, 'to researcher: "コード調査完了の報告"'],
    [{ recipient: 'researcher' }, 'researcher'],
    [{ summary: 'コード調査完了の報告' }, 'コード調査完了の報告'],
    [{}, ''],
  ] as const)('extracts detail from SendMessage with %o', (input, expected) => {
    expect(extractToolDetail('SendMessage', input)).toBe(expected);
  });

  it.each([
    [{ questions: [{ question: 'どの方針にしますか？' }] }, 'どの方針にしますか？'],
    [{ questions: [] }, ''],
    [{ questions: [{}] }, ''],
    [{}, ''],
  ] as const)('extracts detail from AskUserQuestion with %o', (input, expected) => {
    expect(extractToolDetail('AskUserQuestion', input)).toBe(expected);
  });

  it.each([
    ['UnknownTool', { foo: 'bar' }],
    ['Read', {}],
    ['Read', { file_path: 123 }],
  ] as const)('returns empty string for %s with %o', (tool, input) => {
    expect(extractToolDetail(tool, input)).toBe('');
  });
});

describe('createToolUseEvent', () => {
  it('creates a tool_use event with detail', () => {
    const event = createToolUseEvent('Read', { file_path: '/src/app.ts' });
    expect(event).toEqual({
      kind: 'tool_use',
      toolName: 'Read',
      detail: '/src/app.ts',
      session: undefined,
    });
  });

  it('creates a tool_use event without detail for unknown tools', () => {
    const event = createToolUseEvent('Unknown', {});
    expect(event).toEqual({
      kind: 'tool_use',
      toolName: 'Unknown',
      detail: '',
      session: undefined,
    });
  });

  it('creates a tool_use event with session', () => {
    const event = createToolUseEvent('Read', { file_path: '/src/app.ts' }, 'session-1');
    expect(event).toEqual({
      kind: 'tool_use',
      toolName: 'Read',
      detail: '/src/app.ts',
      session: 'session-1',
    });
  });
});

describe('createTextEvent', () => {
  it('creates a text event with short text', () => {
    const event = createTextEvent('短いテキスト');
    expect(event).toEqual({
      kind: 'text',
      snippet: '短いテキスト',
      session: undefined,
    });
  });

  it('truncates long text with ellipsis', () => {
    const longText = 'a'.repeat(100);
    const event = createTextEvent(longText);
    expect(event.snippet).toHaveLength(81); // 80 chars + "…"
    expect(event.snippet.endsWith('…')).toBe(true);
  });

  it('does not truncate text at exactly 80 chars', () => {
    const text = 'a'.repeat(80);
    const event = createTextEvent(text);
    expect(event.snippet).toBe(text);
  });

  it('creates a text event with session', () => {
    const event = createTextEvent('テスト', 'session-1');
    expect(event).toEqual({
      kind: 'text',
      snippet: 'テスト',
      session: 'session-1',
    });
  });
});
