import { describe, expect, it } from 'vitest';
import {
  buildPrompt,
  buildSystemPrompt,
  resolveLanguageName,
  ensureTrailingDelimiter,
  selectEventsForPrompt,
} from './summarizer-prompt.js';
import type { ActivityEvent } from './summarizer-events.js';

describe('resolveLanguageName', () => {
  it('maps ja to Japanese', () => {
    expect(resolveLanguageName('ja')).toBe('Japanese');
  });

  it('maps en to English', () => {
    expect(resolveLanguageName('en')).toBe('English');
  });

  it('falls back to code for unmapped languages', () => {
    expect(resolveLanguageName('tl')).toBe('tl');
  });
});

describe('buildSystemPrompt', () => {
  it('includes language name in prompt', () => {
    const prompt = buildSystemPrompt('ja');
    expect(prompt).toContain('Japanese');
  });

  it('uses English name when specified', () => {
    const prompt = buildSystemPrompt('en');
    expect(prompt).toContain('English');
  });

  it('instructs first-person narration', () => {
    const prompt = buildSystemPrompt('ja');
    expect(prompt).toContain('first person');
    expect(prompt).toContain('narrat');
  });

  it('instructs story continuity from previous narrations', () => {
    const prompt = buildSystemPrompt('ja');
    expect(prompt).toContain('previous narrations');
    expect(prompt).toContain('build on them');
  });

  it('falls back to code for unmapped language', () => {
    const prompt = buildSystemPrompt('tl');
    expect(prompt).toContain('tl only');
  });
});

describe('buildPrompt', () => {
  it('builds numbered prompt from tool_use events with separators', () => {
    const events: ActivityEvent[] = [
      { kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' },
      { kind: 'tool_use', toolName: 'Edit', detail: '/src/config.ts' },
    ];
    const prompt = buildPrompt(events);
    expect(prompt).toContain('Recent actions:');
    expect(prompt).toContain('---\n1. Read: /src/app.ts');
    expect(prompt).toContain('---\n2. Edit: /src/config.ts');
  });

  it('builds prompt from text events with separator', () => {
    const events: ActivityEvent[] = [
      { kind: 'text', snippet: 'テストを実行します' },
    ];
    const prompt = buildPrompt(events);
    expect(prompt).toContain('---\n1. Message: テストを実行します');
  });

  it('builds prompt with tool_use without detail', () => {
    const events: ActivityEvent[] = [
      { kind: 'tool_use', toolName: 'AskUserQuestion', detail: '' },
    ];
    const prompt = buildPrompt(events);
    expect(prompt).toContain('---\n1. AskUserQuestion');
    expect(prompt).not.toContain('1. AskUserQuestion:');
  });

  it('builds prompt from mixed events', () => {
    const events: ActivityEvent[] = [
      { kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' },
      { kind: 'text', snippet: 'ファイルを確認しました' },
      { kind: 'tool_use', toolName: 'Bash', detail: 'npm test' },
    ];
    const prompt = buildPrompt(events);
    const lines = prompt.split('\n');
    // header + 3 separators + 3 events = 7 lines
    expect(lines).toHaveLength(7);
  });

  it('includes single previous summary with trailing delimiter', () => {
    const events: ActivityEvent[] = [
      { kind: 'tool_use', toolName: 'Edit', detail: '/src/config.ts' },
    ];
    const prompt = buildPrompt(events, ['テストファイルを編集していました']);
    // No delimiter in input → period appended
    expect(prompt).toContain('Previous narration: テストファイルを編集していました.');
    expect(prompt).not.toContain('(older)');
    expect(prompt).not.toContain('(recent)');
    expect(prompt).toContain('Recent actions:');
    expect(prompt).toContain('1. Edit: /src/config.ts');
    // Previous narration should come before Recent actions
    const narrationIdx = prompt.indexOf('Previous narration:');
    const actionsIdx = prompt.indexOf('Recent actions:');
    expect(narrationIdx).toBeLessThan(actionsIdx);
  });

  it('preserves existing delimiter in single previous summary', () => {
    const events: ActivityEvent[] = [
      { kind: 'tool_use', toolName: 'Edit', detail: '/src/config.ts' },
    ];
    const prompt = buildPrompt(events, ['テストファイルを編集していました。']);
    expect(prompt).toContain('Previous narration: テストファイルを編集していました。');
  });

  it('joins two previous summaries with trailing delimiters', () => {
    const events: ActivityEvent[] = [
      { kind: 'tool_use', toolName: 'Bash', detail: 'npm test' },
    ];
    const prompt = buildPrompt(events, ['最初のナレーション', '次のナレーション']);
    // Both get period appended
    expect(prompt).toContain('Previous narration: 最初のナレーション. 次のナレーション.');
    expect(prompt).not.toContain('(older)');
    expect(prompt).not.toContain('(recent)');
    expect(prompt).toContain('Recent actions:');
    // Narration should come before Recent actions
    const narrationIdx = prompt.indexOf('Previous narration:');
    const actionsIdx = prompt.indexOf('Recent actions:');
    expect(narrationIdx).toBeLessThan(actionsIdx);
  });

  it('does not include previous narration section when empty array is provided', () => {
    const events: ActivityEvent[] = [
      { kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' },
    ];
    const prompt = buildPrompt(events, []);
    expect(prompt).not.toContain('Previous narration');
    expect(prompt).toContain('Recent actions:');
  });

  it('does not include previous narration section when previousSummaries is omitted', () => {
    const events: ActivityEvent[] = [
      { kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' },
    ];
    const prompt = buildPrompt(events);
    expect(prompt).not.toContain('Previous narration');
  });

  it('filters out empty strings from previousSummaries', () => {
    const events: ActivityEvent[] = [
      { kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' },
    ];
    const prompt = buildPrompt(events, ['', '有効なナレーション']);
    expect(prompt).toContain('Previous narration: 有効なナレーション.');
    expect(prompt).not.toContain('(older)');
    expect(prompt).not.toContain('(recent)');
  });
});

describe('ensureTrailingDelimiter', () => {
  it('returns text as-is when it ends with a period', () => {
    expect(ensureTrailingDelimiter('Hello.')).toBe('Hello.');
  });

  it('returns text as-is when it ends with Japanese period', () => {
    expect(ensureTrailingDelimiter('テスト。')).toBe('テスト。');
  });

  it('returns text as-is when it ends with comma', () => {
    expect(ensureTrailingDelimiter('Hello,')).toBe('Hello,');
  });

  it('returns text as-is when it ends with question mark', () => {
    expect(ensureTrailingDelimiter('Really?')).toBe('Really?');
  });

  it('returns text as-is when it ends with full-width question mark', () => {
    expect(ensureTrailingDelimiter('本当？')).toBe('本当？');
  });

  it('returns text as-is when it ends with exclamation mark', () => {
    expect(ensureTrailingDelimiter('Done!')).toBe('Done!');
  });

  it('returns text as-is when it ends with full-width exclamation mark', () => {
    expect(ensureTrailingDelimiter('完了！')).toBe('完了！');
  });

  it('appends period when text does not end with delimiter', () => {
    expect(ensureTrailingDelimiter('Hello')).toBe('Hello.');
  });

  it('trims trailing whitespace before checking', () => {
    expect(ensureTrailingDelimiter('Hello  ')).toBe('Hello.');
  });

  it('preserves text ending with delimiter followed by whitespace', () => {
    expect(ensureTrailingDelimiter('Hello. ')).toBe('Hello.');
  });

  it('returns empty string as-is', () => {
    expect(ensureTrailingDelimiter('')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(ensureTrailingDelimiter('   ')).toBe('');
  });
});

describe('selectEventsForPrompt', () => {
  it('returns all events when within maxPromptEvents', () => {
    const events: ActivityEvent[] = Array.from({ length: 5 }, (_, i) => ({
      kind: 'tool_use' as const, toolName: 'Read', detail: `/f${i}.ts`,
    }));
    const { selected, omitted } = selectEventsForPrompt(events, 10);
    expect(selected).toHaveLength(5);
    expect(omitted).toBe(0);
  });

  it('returns all events when exactly at maxPromptEvents', () => {
    const events: ActivityEvent[] = Array.from({ length: 10 }, (_, i) => ({
      kind: 'tool_use' as const, toolName: 'Read', detail: `/f${i}.ts`,
    }));
    const { selected, omitted } = selectEventsForPrompt(events, 10);
    expect(selected).toHaveLength(10);
    expect(omitted).toBe(0);
  });

  it('keeps only text events when text events exist and exceeds limit', () => {
    const events: ActivityEvent[] = [
      ...Array.from({ length: 8 }, (_, i) => ({ kind: 'tool_use' as const, toolName: 'Read', detail: `/f${i}.ts` })),
      ...Array.from({ length: 5 }, (_, i) => ({ kind: 'text' as const, snippet: `msg ${i}` })),
    ];
    const { selected, omitted } = selectEventsForPrompt(events, 8);
    expect(selected.every(e => e.kind === 'text')).toBe(true);
    expect(selected).toHaveLength(5);
    expect(omitted).toBe(8);
  });

  it('truncates text events from the beginning when they exceed maxPromptEvents', () => {
    const events: ActivityEvent[] = Array.from({ length: 15 }, (_, i) => ({
      kind: 'text' as const, snippet: `msg ${i}`,
    }));
    const { selected, omitted } = selectEventsForPrompt(events, 5);
    expect(selected).toHaveLength(5);
    expect(omitted).toBe(10);
    expect((selected[0] as { snippet: string }).snippet).toBe('msg 0');
    expect((selected[4] as { snippet: string }).snippet).toBe('msg 4');
  });

  it('truncates all events from the beginning when no text events', () => {
    const events: ActivityEvent[] = Array.from({ length: 15 }, (_, i) => ({
      kind: 'tool_use' as const, toolName: 'Read', detail: `/f${i}.ts`,
    }));
    const { selected, omitted } = selectEventsForPrompt(events, 5);
    expect(selected).toHaveLength(5);
    expect(omitted).toBe(10);
    expect((selected[0] as { detail: string }).detail).toBe('/f0.ts');
    expect((selected[4] as { detail: string }).detail).toBe('/f4.ts');
  });

  it('uses default maxPromptEvents (10) when not specified', () => {
    const events: ActivityEvent[] = Array.from({ length: 15 }, (_, i) => ({
      kind: 'tool_use' as const, toolName: 'Read', detail: `/f${i}.ts`,
    }));
    const { selected, omitted } = selectEventsForPrompt(events);
    expect(selected).toHaveLength(10);
    expect(omitted).toBe(5);
  });
});

describe('buildPrompt with event limiting', () => {
  it('shows omission info when events exceed maxPromptEvents', () => {
    const events: ActivityEvent[] = Array.from({ length: 15 }, (_, i) => ({
      kind: 'tool_use' as const, toolName: 'Read', detail: `/src/file${i}.ts`,
    }));
    const prompt = buildPrompt(events, undefined, 5);
    expect(prompt).toContain('10 actions omitted');
    expect(prompt).toContain('showing first 5 of 15');
    expect(prompt.match(/^\d+\./gm)).toHaveLength(5);
  });

  it('does not show omission info when events are within limit', () => {
    const events: ActivityEvent[] = [
      { kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' },
    ];
    const prompt = buildPrompt(events, undefined, 10);
    expect(prompt).toContain('Recent actions:');
    expect(prompt).not.toContain('omitted');
  });
});
