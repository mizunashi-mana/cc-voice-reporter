import { describe, expect, it } from 'vitest';
import {
  buildPrompt,
  selectEventsForPrompt,
  type ActivityEvent,
} from './summarizer.js';

describe('selectEventsForPrompt', () => {
  it('returns all events when at or below FILTER_THRESHOLD', () => {
    const events: ActivityEvent[] = Array.from({ length: 10 }, (_, i) => ({
      kind: 'tool_use' as const, toolName: 'Read', detail: `/f${i}.ts`,
    }));
    const { selected, omitted } = selectEventsForPrompt(events, 30);
    expect(selected).toHaveLength(10);
    expect(omitted).toBe(0);
  });

  it('prioritises text events when over FILTER_THRESHOLD', () => {
    const events: ActivityEvent[] = [
      ...Array.from({ length: 8 }, (_, i) => ({ kind: 'tool_use' as const, toolName: 'Read', detail: `/f${i}.ts` })),
      ...Array.from({ length: 5 }, (_, i) => ({ kind: 'text' as const, snippet: `msg ${i}` })),
    ];
    const { selected, omitted } = selectEventsForPrompt(events, 8);
    expect(selected.filter(e => e.kind === 'text')).toHaveLength(5);
    expect(selected.filter(e => e.kind === 'tool_use')).toHaveLength(3);
    expect(omitted).toBe(5);
  });

  it('preserves original event order after filtering', () => {
    const events: ActivityEvent[] = [
      { kind: 'tool_use', toolName: 'Read', detail: '/a.ts' },
      { kind: 'text', snippet: 'first' },
      ...Array.from({ length: 8 }, (_, i) => ({ kind: 'tool_use' as const, toolName: 'Read', detail: `/f${i}.ts` })),
      { kind: 'text', snippet: 'second' },
    ];
    const { selected } = selectEventsForPrompt(events, 5);
    expect(selected).toHaveLength(5);
    expect(selected.map(e => e.kind).indexOf('text')).toBeGreaterThanOrEqual(0);
  });

  it('caps text events when they alone exceed maxPromptEvents', () => {
    const events: ActivityEvent[] = Array.from({ length: 15 }, (_, i) => ({
      kind: 'text' as const, snippet: `msg ${i}`,
    }));
    const { selected, omitted } = selectEventsForPrompt(events, 5);
    expect(selected).toHaveLength(5);
    expect(omitted).toBe(10);
    expect((selected[4] as { snippet: string }).snippet).toBe('msg 14');
  });

  it('keeps all events when over FILTER_THRESHOLD but within maxPromptEvents', () => {
    const events: ActivityEvent[] = [
      ...Array.from({ length: 9 }, (_, i) => ({ kind: 'tool_use' as const, toolName: 'Read', detail: `/f${i}.ts` })),
      ...Array.from({ length: 3 }, (_, i) => ({ kind: 'text' as const, snippet: `msg ${i}` })),
    ];
    const { selected, omitted } = selectEventsForPrompt(events, 30);
    expect(selected).toHaveLength(12);
    expect(omitted).toBe(0);
  });
});

describe('buildPrompt with event limiting', () => {
  it('shows omission info when events exceed maxPromptEvents', () => {
    const events: ActivityEvent[] = Array.from({ length: 15 }, (_, i) => ({
      kind: 'tool_use' as const, toolName: 'Read', detail: `/src/file${i}.ts`,
    }));
    const prompt = buildPrompt(events, undefined, 5);
    expect(prompt).toContain('10 older actions omitted');
    expect(prompt).toContain('showing last 5 of 15');
    expect(prompt.match(/^\d+\./gm)).toHaveLength(5);
  });

  it('does not show omission info when events are within limit', () => {
    const events: ActivityEvent[] = [
      { kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' },
    ];
    const prompt = buildPrompt(events, undefined, 30);
    expect(prompt).toContain('Recent actions:');
    expect(prompt).not.toContain('omitted');
  });
});
