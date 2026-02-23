import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Summarizer,
  buildPrompt,
  buildSystemPrompt,
  resolveLanguageName,
  extractToolDetail,
  createToolUseEvent,
  createTextEvent,
  ensureTrailingDelimiter,
  type ActivityEvent,
} from './summarizer.js';
import type { Logger } from './logger.js';

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
    [{ recipient: 'researcher', summary: 'コード調査完了の報告' }, 'researcher へ「コード調査完了の報告」'],
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

describe('Summarizer', () => {
  let warnings: string[];
  let spokenSummaries: string[];

  beforeEach(() => {
    vi.useFakeTimers();
    warnings = [];
    spokenSummaries = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function createSummarizer(options?: { intervalMs?: number; language?: string }) {
    const logger: Logger = {
      debug() {},
      info() {},
      warn(msg: string) { warnings.push(msg); },
      error(msg: string) { warnings.push(msg); },
    };
    return new Summarizer(
      {
        ollama: {
          model: 'test-model',
          baseUrl: 'http://localhost:11434',
        },
        intervalMs: options?.intervalMs ?? 60_000,
        language: options?.language ?? 'en',
      },
      message => spokenSummaries.push(message),
      logger,
    );
  }

  describe('record', () => {
    it('tracks events', () => {
      const summarizer = createSummarizer();
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' });
      summarizer.record({ kind: 'text', snippet: 'テスト' });
      expect(summarizer.pendingEvents).toBe(2);
    });

    it('tracks events per session', () => {
      const summarizer = createSummarizer();
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/a.ts', session: 's1' });
      summarizer.record({ kind: 'tool_use', toolName: 'Edit', detail: '/b.ts', session: 's2' });
      summarizer.record({ kind: 'text', snippet: 'テスト', session: 's1' });
      expect(summarizer.pendingEvents).toBe(3);
    });
  });

  describe('flush', () => {
    it('does nothing when no events are recorded', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const summarizer = createSummarizer();
      await summarizer.flush();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(spokenSummaries).toEqual([]);
    });

    it('calls Ollama and speaks the summary', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            message: { content: 'ファイルを読み取り、編集しました' },
          }),
          { status: 200 },
        ),
      );

      const summarizer = createSummarizer();
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' });
      summarizer.record({ kind: 'tool_use', toolName: 'Edit', detail: '/src/config.ts' });
      await summarizer.flush();

      expect(spokenSummaries).toEqual(['ファイルを読み取り、編集しました']);
    });

    it('clears events after flush', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ message: { content: '要約' } }),
          { status: 200 },
        ),
      );

      const summarizer = createSummarizer();
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' });
      await summarizer.flush();

      expect(summarizer.pendingEvents).toBe(0);
    });

    it('sends correct request to Ollama API', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ message: { content: '要約' } }),
          { status: 200 },
        ),
      );

      const summarizer = createSummarizer();
      summarizer.record({ kind: 'tool_use', toolName: 'Bash', detail: 'npm test' });
      await summarizer.flush();

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, init] = fetchSpy.mock.calls[0]!;
      expect(url).toBe('http://localhost:11434/api/chat');

      const body = JSON.parse(init?.body as string) as {
        model: string;
        stream: boolean;
        messages: Array<{ role: string; content: string }>;
      };
      expect(body.model).toBe('test-model');
      expect(body.stream).toBe(false);
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0]!.role).toBe('system');
      expect(body.messages[0]!.content).toContain('first person');
      expect(body.messages[0]!.content).toContain('English');
      expect(body.messages[1]!.role).toBe('user');
      expect(body.messages[1]!.content).toContain('Bash: npm test');
    });

    it('uses configured language in system prompt', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ message: { content: 'summary' } }),
          { status: 200 },
        ),
      );

      const summarizer = createSummarizer({ language: 'en' });
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' });
      await summarizer.flush();

      const body = JSON.parse(fetchSpy.mock.calls[0]![1]?.body as string) as {
        messages: Array<{ content: string }>;
      };
      expect(body.messages[0]!.content).toContain('English');
    });

    it('warns and speaks failure message on HTTP error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Internal Server Error', { status: 500 }),
      );

      const summarizer = createSummarizer();
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' });
      await summarizer.flush();

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('HTTP 500');
      expect(spokenSummaries).toHaveLength(1);
      expect(spokenSummaries[0]).toContain('1');
    });

    it('warns and speaks failure message on invalid response format', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ unexpected: 'format' }), { status: 200 }),
      );

      const summarizer = createSummarizer();
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' });
      await summarizer.flush();

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('invalid response format');
      expect(spokenSummaries).toHaveLength(1);
      expect(spokenSummaries[0]).toContain('1');
    });

    it('warns and speaks failure message on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(
        new Error('Connection refused'),
      );

      const summarizer = createSummarizer();
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' });
      await summarizer.flush();

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('Connection refused');
      expect(spokenSummaries).toHaveLength(1);
      expect(spokenSummaries[0]).toContain('1');
    });

    it('speaks failure message with correct event count', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(
        new Error('Connection refused'),
      );

      const summarizer = createSummarizer();
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' });
      summarizer.record({ kind: 'tool_use', toolName: 'Edit', detail: '/src/config.ts' });
      summarizer.record({ kind: 'text', snippet: 'テスト' });
      await summarizer.flush();

      expect(spokenSummaries).toHaveLength(1);
      expect(spokenSummaries[0]).toContain('3');
    });

    it('speaks failure message in Japanese when language is ja', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(
        new Error('Connection refused'),
      );

      const summarizer = createSummarizer({ language: 'ja' });
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' });
      summarizer.record({ kind: 'tool_use', toolName: 'Edit', detail: '/src/config.ts' });
      await summarizer.flush();

      expect(spokenSummaries).toHaveLength(1);
      expect(spokenSummaries[0]).toBe(
        '要約の生成に失敗しました。2件のアクティビティがありました。',
      );
    });

    it('speaks failure message in English when language is en', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(
        new Error('Connection refused'),
      );

      const summarizer = createSummarizer({ language: 'en' });
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' });
      await summarizer.flush();

      expect(spokenSummaries).toHaveLength(1);
      expect(spokenSummaries[0]).toBe(
        'Failed to generate summary. There were 1 activities.',
      );
    });

    it('does not speak empty summary', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ message: { content: '  \n  ' } }),
          { status: 200 },
        ),
      );

      const summarizer = createSummarizer();
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' });
      await summarizer.flush();

      expect(spokenSummaries).toEqual([]);
    });
  });

  describe('event-driven throttle', () => {
    it('flushes after intervalMs when triggered by record', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ message: { content: '定期要約' } }),
          { status: 200 },
        ),
      );

      const summarizer = createSummarizer({ intervalMs: 10_000 });
      summarizer.start();
      summarizer.record(
        { kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' },
        true,
      );

      await vi.advanceTimersByTimeAsync(10_000);
      expect(spokenSummaries).toEqual(['定期要約']);
    });

    it('does not schedule timer when trigger is false', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const summarizer = createSummarizer({ intervalMs: 10_000 });
      summarizer.start();
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' });

      await vi.advanceTimersByTimeAsync(10_000);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('does not schedule timer when not active', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const summarizer = createSummarizer({ intervalMs: 10_000 });
      // Not calling start() — summarizer is inactive
      summarizer.record(
        { kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' },
        true,
      );

      await vi.advanceTimersByTimeAsync(10_000);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('does not create multiple timers for rapid triggers', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ message: { content: 'まとめて要約' } }),
          { status: 200 },
        ),
      );

      const summarizer = createSummarizer({ intervalMs: 10_000 });
      summarizer.start();
      summarizer.record(
        { kind: 'tool_use', toolName: 'Read', detail: '/src/a.ts' },
        true,
      );
      summarizer.record(
        { kind: 'tool_use', toolName: 'Edit', detail: '/src/b.ts' },
        true,
      );

      await vi.advanceTimersByTimeAsync(10_000);
      // Only one Ollama call, both events included
      expect(fetchSpy).toHaveBeenCalledOnce();
      expect(spokenSummaries).toEqual(['まとめて要約']);
    });

    it('stop cancels the throttle timer', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const summarizer = createSummarizer({ intervalMs: 10_000 });
      summarizer.start();
      summarizer.record(
        { kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' },
        true,
      );
      summarizer.stop();

      await vi.advanceTimersByTimeAsync(10_000);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('explicit flush cancels pending throttle timer', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ message: { content: '要約' } }),
          { status: 200 },
        ),
      );

      const summarizer = createSummarizer({ intervalMs: 10_000 });
      summarizer.start();
      summarizer.record(
        { kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' },
        true,
      );

      // Explicit flush before timer fires
      await summarizer.flush();
      expect(fetchSpy).toHaveBeenCalledOnce();

      // Timer should not cause another flush
      await vi.advanceTimersByTimeAsync(10_000);
      expect(fetchSpy).toHaveBeenCalledOnce();
    });

    it('start is idempotent', () => {
      const summarizer = createSummarizer({ intervalMs: 10_000 });
      summarizer.start();
      summarizer.start(); // Should not cause issues
      summarizer.stop();
    });

    it('reschedules after flush completes when events accumulated during flush', async () => {
      const summarizer = createSummarizer({ intervalMs: 5_000 });
      let callCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callCount += 1;
        if (callCount === 1) {
          // Simulate slow Ollama response; add event during flush
          summarizer.record(
            { kind: 'tool_use', toolName: 'Edit', detail: '/src/new.ts' },
            true,
          );
        }
        return Promise.resolve(new Response(
          JSON.stringify({ message: { content: `要約${callCount}` } }),
          { status: 200 },
        ));
      });
      summarizer.start();
      summarizer.record(
        { kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' },
        true,
      );

      // First timer fires, triggers first flush
      await vi.advanceTimersByTimeAsync(5_000);
      expect(spokenSummaries).toEqual(['要約1']);

      // Rescheduled timer fires, triggers second flush with accumulated events
      await vi.advanceTimersByTimeAsync(5_000);
      expect(spokenSummaries).toEqual(['要約1', '要約2']);
    });
  });

  describe('flush serialization', () => {
    it('serializes concurrent flush calls to prevent simultaneous Ollama requests', async () => {
      let concurrentCalls = 0;
      let maxConcurrentCalls = 0;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        concurrentCalls += 1;
        maxConcurrentCalls = Math.max(maxConcurrentCalls, concurrentCalls);
        // Simulate async work so concurrent calls can overlap
        await Promise.resolve();
        concurrentCalls -= 1;
        return new Response(
          JSON.stringify({ message: { content: '要約' } }),
          { status: 200 },
        );
      });

      const summarizer = createSummarizer();
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/a.ts' });

      // Start first flush
      const flush1 = summarizer.flush();

      // Record more events and start second flush before first completes
      summarizer.record({ kind: 'tool_use', toolName: 'Edit', detail: '/b.ts' });
      const flush2 = summarizer.flush();

      await flush1;
      await flush2;

      // Ollama should never have been called concurrently
      expect(maxConcurrentCalls).toBe(1);
    });

    it('second flush processes events accumulated during first flush', async () => {
      const prompts: string[] = [];
      let resolveFirstFetch!: (value: Response) => void;
      let firstFetchStarted = false;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        const body = JSON.parse(init?.body as string) as {
          messages: Array<{ content: string }>;
        };
        prompts.push(body.messages[1]!.content);

        if (!firstFetchStarted) {
          firstFetchStarted = true;
          // First call: block until manually resolved
          return new Promise<Response>((resolve) => {
            resolveFirstFetch = resolve;
          });
        }
        return Promise.resolve(new Response(
          JSON.stringify({ message: { content: '要約' } }),
          { status: 200 },
        ));
      });

      const summarizer = createSummarizer();
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/a.ts' });

      // Start first flush (blocks on deferred fetch)
      const flush1 = summarizer.flush();

      // Allow microtasks to drain so doFlush starts and fetch is called
      await Promise.resolve();

      // Record events while first Ollama call is in progress
      summarizer.record({ kind: 'tool_use', toolName: 'Edit', detail: '/b.ts' });
      const flush2 = summarizer.flush();

      // Resolve first fetch
      resolveFirstFetch(new Response(
        JSON.stringify({ message: { content: '要約1' } }),
        { status: 200 },
      ));

      await flush1;
      await flush2;

      // First flush should contain Read, second should contain Edit
      expect(prompts).toHaveLength(2);
      expect(prompts[0]).toContain('Read: /a.ts');
      expect(prompts[0]).not.toContain('Edit: /b.ts');
      expect(prompts[1]).toContain('Edit: /b.ts');
      expect(prompts[1]).not.toContain('Read: /a.ts');
    });

    it('flush during active flush is a no-op when no new events exist', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ message: { content: '要約' } }),
          { status: 200 },
        ),
      );

      const summarizer = createSummarizer();
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/a.ts' });

      const flush1 = summarizer.flush();
      // No new events recorded
      const flush2 = summarizer.flush();

      await flush1;
      await flush2;

      // Only one Ollama call (second flush had no events)
      expect(fetchSpy).toHaveBeenCalledOnce();
    });
  });

  describe('session-scoped events', () => {
    it('flushes events per session separately', async () => {
      const prompts: string[] = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        const body = JSON.parse(init?.body as string) as {
          messages: Array<{ content: string }>;
        };
        prompts.push(body.messages[1]!.content);
        return Promise.resolve(new Response(
          JSON.stringify({ message: { content: '要約' } }),
          { status: 200 },
        ));
      });

      const summarizer = createSummarizer();
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/a.ts', session: 's1' });
      summarizer.record({ kind: 'tool_use', toolName: 'Edit', detail: '/b.ts', session: 's2' });
      await summarizer.flush();

      // Two separate Ollama calls, one per session
      expect(prompts).toHaveLength(2);
      expect(prompts[0]).toContain('Read: /a.ts');
      expect(prompts[0]).not.toContain('Edit: /b.ts');
      expect(prompts[1]).toContain('Edit: /b.ts');
      expect(prompts[1]).not.toContain('Read: /a.ts');
    });

    it('does not mix events from different sessions', async () => {
      const prompts: string[] = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        const body = JSON.parse(init?.body as string) as {
          messages: Array<{ content: string }>;
        };
        prompts.push(body.messages[1]!.content);
        return Promise.resolve(new Response(
          JSON.stringify({ message: { content: '要約' } }),
          { status: 200 },
        ));
      });

      const summarizer = createSummarizer();
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/a.ts', session: 's1' });
      summarizer.record({ kind: 'text', snippet: 'テスト', session: 's1' });
      summarizer.record({ kind: 'tool_use', toolName: 'Bash', detail: 'npm test', session: 's2' });
      await summarizer.flush();

      expect(prompts).toHaveLength(2);
      // Session s1 has Read + text
      expect(prompts[0]).toContain('Read: /a.ts');
      expect(prompts[0]).toContain('Message: テスト');
      // Session s2 has only Bash
      expect(prompts[1]).toContain('Bash: npm test');
      expect(prompts[1]).not.toContain('Read');
    });
  });

  describe('previous summary context', () => {
    it('includes previous summary in the prompt on second flush', async () => {
      const prompts: string[] = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        const body = JSON.parse(init?.body as string) as {
          messages: Array<{ content: string }>;
        };
        prompts.push(body.messages[1]!.content);
        return Promise.resolve(new Response(
          JSON.stringify({ message: { content: 'テストを実行しました' } }),
          { status: 200 },
        ));
      });

      const summarizer = createSummarizer();

      // First flush — no previous summary
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/a.ts', session: 's1' });
      await summarizer.flush();

      // Second flush — should include previous summary (single)
      summarizer.record({ kind: 'tool_use', toolName: 'Edit', detail: '/b.ts', session: 's1' });
      await summarizer.flush();

      expect(prompts).toHaveLength(2);
      expect(prompts[0]).not.toContain('Previous narration');
      expect(prompts[1]).toContain('Previous narration: テストを実行しました.');
      expect(prompts[1]).not.toContain('(older)');
      expect(prompts[1]).not.toContain('(recent)');
    });

    it('joins two previous summaries on third flush', async () => {
      let callCount = 0;
      const prompts: string[] = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        callCount += 1;
        const body = JSON.parse(init?.body as string) as {
          messages: Array<{ content: string }>;
        };
        prompts.push(body.messages[1]!.content);
        return Promise.resolve(new Response(
          JSON.stringify({ message: { content: `要約${callCount}` } }),
          { status: 200 },
        ));
      });

      const summarizer = createSummarizer();

      // First flush
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/a.ts', session: 's1' });
      await summarizer.flush();

      // Second flush — 1 previous
      summarizer.record({ kind: 'tool_use', toolName: 'Edit', detail: '/b.ts', session: 's1' });
      await summarizer.flush();

      // Third flush — 2 previous summaries joined
      summarizer.record({ kind: 'tool_use', toolName: 'Bash', detail: 'npm test', session: 's1' });
      await summarizer.flush();

      expect(prompts).toHaveLength(3);
      expect(prompts[0]).not.toContain('Previous narration');
      expect(prompts[1]).toContain('Previous narration: 要約1.');
      expect(prompts[2]).toContain('Previous narration: 要約1. 要約2.');
      expect(prompts[2]).not.toContain('(older)');
      expect(prompts[2]).not.toContain('(recent)');
    });

    it('keeps only the last 2 summaries on fourth flush', async () => {
      let callCount = 0;
      const prompts: string[] = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        callCount += 1;
        const body = JSON.parse(init?.body as string) as {
          messages: Array<{ content: string }>;
        };
        prompts.push(body.messages[1]!.content);
        return Promise.resolve(new Response(
          JSON.stringify({ message: { content: `要約${callCount}` } }),
          { status: 200 },
        ));
      });

      const summarizer = createSummarizer();

      // Flush 1, 2, 3
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/a.ts', session: 's1' });
      await summarizer.flush();
      summarizer.record({ kind: 'tool_use', toolName: 'Edit', detail: '/b.ts', session: 's1' });
      await summarizer.flush();
      summarizer.record({ kind: 'tool_use', toolName: 'Bash', detail: 'npm test', session: 's1' });
      await summarizer.flush();

      // Fourth flush — should have 要約2 and 要約3 joined, not 要約1
      summarizer.record({ kind: 'tool_use', toolName: 'Write', detail: '/c.ts', session: 's1' });
      await summarizer.flush();

      expect(prompts).toHaveLength(4);
      expect(prompts[3]).toContain('Previous narration: 要約2. 要約3.');
      expect(prompts[3]).not.toContain('要約1');
    });

    it('keeps previous summary per session independently', async () => {
      let callCount = 0;
      const prompts: string[] = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        callCount += 1;
        const body = JSON.parse(init?.body as string) as {
          messages: Array<{ content: string }>;
        };
        prompts.push(body.messages[1]!.content);
        return Promise.resolve(new Response(
          JSON.stringify({ message: { content: `要約${callCount}` } }),
          { status: 200 },
        ));
      });

      const summarizer = createSummarizer();

      // First flush: s1 and s2 each get their own summary
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/a.ts', session: 's1' });
      summarizer.record({ kind: 'tool_use', toolName: 'Bash', detail: 'npm test', session: 's2' });
      await summarizer.flush();
      // callCount=1 for s1 ("要約1"), callCount=2 for s2 ("要約2")

      // Second flush: each session sees its own previous summary
      summarizer.record({ kind: 'tool_use', toolName: 'Edit', detail: '/c.ts', session: 's1' });
      summarizer.record({ kind: 'tool_use', toolName: 'Write', detail: '/d.ts', session: 's2' });
      await summarizer.flush();

      expect(prompts).toHaveLength(4);
      // s1's second prompt should contain "要約1" (s1's first summary)
      expect(prompts[2]).toContain('Previous narration: 要約1.');
      // s2's second prompt should contain "要約2" (s2's first summary)
      expect(prompts[3]).toContain('Previous narration: 要約2.');
    });

    it('does not include previous summary for a new session', async () => {
      const prompts: string[] = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        const body = JSON.parse(init?.body as string) as {
          messages: Array<{ content: string }>;
        };
        prompts.push(body.messages[1]!.content);
        return Promise.resolve(new Response(
          JSON.stringify({ message: { content: '要約' } }),
          { status: 200 },
        ));
      });

      const summarizer = createSummarizer();

      // Flush session s1
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/a.ts', session: 's1' });
      await summarizer.flush();

      // Flush a different session s2 — no previous summary for s2
      summarizer.record({ kind: 'tool_use', toolName: 'Edit', detail: '/b.ts', session: 's2' });
      await summarizer.flush();

      expect(prompts).toHaveLength(2);
      expect(prompts[0]).not.toContain('Previous narration');
      expect(prompts[1]).not.toContain('Previous narration');
    });

    it('does not store previous summary on empty response', async () => {
      const prompts: string[] = [];
      let callCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        callCount += 1;
        const body = JSON.parse(init?.body as string) as {
          messages: Array<{ content: string }>;
        };
        prompts.push(body.messages[1]!.content);
        return Promise.resolve(new Response(
          JSON.stringify({
            message: { content: callCount === 1 ? '  ' : '要約2' },
          }),
          { status: 200 },
        ));
      });

      const summarizer = createSummarizer();

      // First flush returns empty
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/a.ts', session: 's1' });
      await summarizer.flush();

      // Second flush — no previous summary since first was empty
      summarizer.record({ kind: 'tool_use', toolName: 'Edit', detail: '/b.ts', session: 's1' });
      await summarizer.flush();

      expect(prompts).toHaveLength(2);
      expect(prompts[1]).not.toContain('Previous narration');
    });
  });
});
