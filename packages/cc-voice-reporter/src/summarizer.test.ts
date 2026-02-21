import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Summarizer,
  buildPrompt,
  buildSystemPrompt,
  resolveLanguageName,
  extractToolDetail,
  createToolUseEvent,
  createTextEvent,
  type ActivityEvent,
} from './summarizer.js';
import type { Logger } from './logger.js';

describe('extractToolDetail', () => {
  it('extracts file_path from Read', () => {
    expect(extractToolDetail('Read', { file_path: '/src/app.ts' })).toBe(
      '/src/app.ts',
    );
  });

  it('extracts file_path from Edit', () => {
    expect(extractToolDetail('Edit', { file_path: '/src/config.ts' })).toBe(
      '/src/config.ts',
    );
  });

  it('extracts file_path from Write', () => {
    expect(extractToolDetail('Write', { file_path: '/src/new.ts' })).toBe(
      '/src/new.ts',
    );
  });

  it('extracts notebook_path from NotebookEdit', () => {
    expect(
      extractToolDetail('NotebookEdit', { notebook_path: '/nb/test.ipynb' }),
    ).toBe('/nb/test.ipynb');
  });

  it('extracts command from Bash', () => {
    expect(extractToolDetail('Bash', { command: 'npm test' })).toBe(
      'npm test',
    );
  });

  it('extracts pattern from Grep', () => {
    expect(extractToolDetail('Grep', { pattern: 'TODO' })).toBe('TODO');
  });

  it('extracts pattern and path from Grep', () => {
    expect(
      extractToolDetail('Grep', { pattern: 'TODO', path: '/src' }),
    ).toBe('TODO in /src');
  });

  it('extracts pattern from Glob', () => {
    expect(extractToolDetail('Glob', { pattern: '**/*.ts' })).toBe(
      '**/*.ts',
    );
  });

  it('returns empty string for unknown tools', () => {
    expect(extractToolDetail('UnknownTool', { foo: 'bar' })).toBe('');
  });

  it('returns empty string when expected field is missing', () => {
    expect(extractToolDetail('Read', {})).toBe('');
  });

  it('returns empty string when field is not a string', () => {
    expect(extractToolDetail('Read', { file_path: 123 })).toBe('');
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
  it('builds numbered prompt from tool_use events', () => {
    const events: ActivityEvent[] = [
      { kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' },
      { kind: 'tool_use', toolName: 'Edit', detail: '/src/config.ts' },
    ];
    const prompt = buildPrompt(events);
    expect(prompt).toContain('Recent actions:');
    expect(prompt).toContain('1. Read: /src/app.ts');
    expect(prompt).toContain('2. Edit: /src/config.ts');
  });

  it('builds prompt from text events', () => {
    const events: ActivityEvent[] = [
      { kind: 'text', snippet: 'テストを実行します' },
    ];
    const prompt = buildPrompt(events);
    expect(prompt).toContain('1. Text output: テストを実行します');
  });

  it('builds prompt with tool_use without detail', () => {
    const events: ActivityEvent[] = [
      { kind: 'tool_use', toolName: 'AskUserQuestion', detail: '' },
    ];
    const prompt = buildPrompt(events);
    expect(prompt).toContain('1. AskUserQuestion');
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
    expect(lines).toHaveLength(4); // header + 3 events
  });

  it('includes previous summary when provided', () => {
    const events: ActivityEvent[] = [
      { kind: 'tool_use', toolName: 'Edit', detail: '/src/config.ts' },
    ];
    const prompt = buildPrompt(events, 'テストファイルを編集していました');
    expect(prompt).toContain('Previous narration: テストファイルを編集していました');
    expect(prompt).toContain('Recent actions:');
    expect(prompt).toContain('1. Edit: /src/config.ts');
    // Previous narration should come before Recent actions
    const narrationIdx = prompt.indexOf('Previous narration:');
    const actionsIdx = prompt.indexOf('Recent actions:');
    expect(narrationIdx).toBeLessThan(actionsIdx);
  });

  it('does not include previous narration section when previousSummary is null', () => {
    const events: ActivityEvent[] = [
      { kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' },
    ];
    const prompt = buildPrompt(events, null);
    expect(prompt).not.toContain('Previous narration:');
    expect(prompt).toContain('Recent actions:');
  });

  it('does not include previous narration section when previousSummary is omitted', () => {
    const events: ActivityEvent[] = [
      { kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' },
    ];
    const prompt = buildPrompt(events);
    expect(prompt).not.toContain('Previous narration:');
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

  it('instructs story continuity from previous narration', () => {
    const prompt = buildSystemPrompt('ja');
    expect(prompt).toContain('previous narration');
    expect(prompt).toContain('build on it');
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

    it('warns on HTTP error and does not speak', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Internal Server Error', { status: 500 }),
      );

      const summarizer = createSummarizer();
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' });
      await summarizer.flush();

      expect(spokenSummaries).toEqual([]);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('HTTP 500');
    });

    it('warns on invalid response format', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ unexpected: 'format' }), { status: 200 }),
      );

      const summarizer = createSummarizer();
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' });
      await summarizer.flush();

      expect(spokenSummaries).toEqual([]);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('invalid response format');
    });

    it('warns on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(
        new Error('Connection refused'),
      );

      const summarizer = createSummarizer();
      summarizer.record({ kind: 'tool_use', toolName: 'Read', detail: '/src/app.ts' });
      await summarizer.flush();

      expect(spokenSummaries).toEqual([]);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('Connection refused');
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
        callCount++;
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
        concurrentCalls++;
        maxConcurrentCalls = Math.max(maxConcurrentCalls, concurrentCalls);
        // Simulate async work so concurrent calls can overlap
        await Promise.resolve();
        concurrentCalls--;
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
      expect(prompts[0]).toContain('Text output: テスト');
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

      // Second flush — should include previous summary
      summarizer.record({ kind: 'tool_use', toolName: 'Edit', detail: '/b.ts', session: 's1' });
      await summarizer.flush();

      expect(prompts).toHaveLength(2);
      expect(prompts[0]).not.toContain('Previous narration:');
      expect(prompts[1]).toContain('Previous narration: テストを実行しました');
    });

    it('keeps previous summary per session independently', async () => {
      let callCount = 0;
      const prompts: string[] = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        callCount++;
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
      expect(prompts[2]).toContain('Previous narration: 要約1');
      // s2's second prompt should contain "要約2" (s2's first summary)
      expect(prompts[3]).toContain('Previous narration: 要約2');
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
      expect(prompts[0]).not.toContain('Previous narration:');
      expect(prompts[1]).not.toContain('Previous narration:');
    });

    it('does not store previous summary on empty response', async () => {
      const prompts: string[] = [];
      let callCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        callCount++;
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
      expect(prompts[1]).not.toContain('Previous narration:');
    });
  });
});
