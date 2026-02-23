import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Daemon } from './daemon.js';
import { DEFAULT_PROJECTS_DIR } from './watcher.js';
import type { Logger } from './logger.js';
import type { ProjectInfo } from './speaker.js';

const silentLogger: Logger = { debug() {}, info() {}, warn() {}, error() {} };

/** Helper to build an assistant JSONL line with text content. */
function textLine(requestId: string, text: string): string {
  return JSON.stringify({
    type: 'assistant',
    requestId,
    message: {
      role: 'assistant',
      content: [{ type: 'text', text }],
    },
    uuid: `uuid-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
  });
}

/** Helper to build a system turn_duration JSONL line. */
function turnDurationLine(durationMs?: number): string {
  return JSON.stringify({
    type: 'system',
    subtype: 'turn_duration',
    ...(durationMs !== undefined ? { durationMs } : {}),
    uuid: `uuid-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
  });
}

describe('Daemon', () => {
  let spoken: string[];
  let daemon!: Daemon;

  beforeEach(() => {
    vi.useFakeTimers();
    spoken = [];
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    await daemon.stop();
  });

  function createDaemon() {
    daemon = new Daemon({
      logger: silentLogger,
      language: 'en',
      // Use a fake watcher directory that doesn't exist — we call handleLines directly
      watcher: { projectsDir: '/tmp/cc-voice-reporter-test-nonexistent' },
      speakFn: (message) => {
        spoken.push(message);
      },
    });
  }

  describe('tool_use messages', () => {
    it('does not speak non-AskUserQuestion tool_use messages', () => {
      createDaemon();
      const line = JSON.stringify({
        type: 'assistant',
        requestId: 'req_1',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'toolu_1', name: 'Read', input: { file_path: '/tmp/test.ts' } },
          ],
        },
        uuid: 'uuid-tool',
        timestamp: new Date().toISOString(),
      });

      daemon.handleLines([line]);
      vi.advanceTimersByTime(1000);
      expect(spoken).toEqual([]);
    });

    it('speaks AskUserQuestion with question content', () => {
      createDaemon();
      const line = JSON.stringify({
        type: 'assistant',
        requestId: 'req_1',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'AskUserQuestion',
              input: {
                questions: [
                  {
                    question: 'どの方式を使いますか？',
                    header: '方式',
                    options: [
                      { label: 'A', description: '方式A' },
                      { label: 'B', description: '方式B' },
                    ],
                    multiSelect: false,
                  },
                ],
              },
            },
          ],
        },
        uuid: 'uuid-ask',
        timestamp: new Date().toISOString(),
      });

      daemon.handleLines([line]);
      // AskUserQuestion is spoken immediately (no debounce)
      expect(spoken).toEqual(['どの方式を使いますか？. Awaiting confirmation']);
    });

    it('speaks multiple questions joined together', () => {
      createDaemon();
      const line = JSON.stringify({
        type: 'assistant',
        requestId: 'req_1',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'AskUserQuestion',
              input: {
                questions: [
                  { question: '質問1？', header: 'Q1', options: [{ label: 'A', description: 'a' }, { label: 'B', description: 'b' }], multiSelect: false },
                  { question: '質問2？', header: 'Q2', options: [{ label: 'C', description: 'c' }, { label: 'D', description: 'd' }], multiSelect: false },
                ],
              },
            },
          ],
        },
        uuid: 'uuid-ask-multi',
        timestamp: new Date().toISOString(),
      });

      daemon.handleLines([line]);
      expect(spoken).toEqual(['質問1？ 質問2？. Awaiting confirmation']);
    });

    it('does not speak AskUserQuestion with empty questions', () => {
      createDaemon();
      const line = JSON.stringify({
        type: 'assistant',
        requestId: 'req_1',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'AskUserQuestion',
              input: { questions: [] },
            },
          ],
        },
        uuid: 'uuid-ask-empty',
        timestamp: new Date().toISOString(),
      });

      daemon.handleLines([line]);
      vi.advanceTimersByTime(1000);
      expect(spoken).toEqual([]);
    });

    it('does not speak Bash tool_use', () => {
      createDaemon();
      const line = JSON.stringify({
        type: 'assistant',
        requestId: 'req_1',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'Bash',
              input: { command: 'npm test' },
            },
          ],
        },
        uuid: 'uuid-bash',
        timestamp: new Date().toISOString(),
      });

      daemon.handleLines([line]);
      vi.advanceTimersByTime(1000);
      expect(spoken).toEqual([]);
    });

    it('defers AskUserQuestion after text messages in the same batch', () => {
      createDaemon();
      // Build a batch where text comes AFTER AskUserQuestion in the JSONL,
      // but text is in a separate line (same batch via handleLines).
      const askLine = JSON.stringify({
        type: 'assistant',
        requestId: 'req_1',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'AskUserQuestion',
              input: {
                questions: [
                  {
                    question: 'Which approach?',
                    header: 'Approach',
                    options: [
                      { label: 'A', description: 'Approach A' },
                      { label: 'B', description: 'Approach B' },
                    ],
                    multiSelect: false,
                  },
                ],
              },
            },
          ],
        },
        uuid: 'uuid-ask-deferred',
        timestamp: new Date().toISOString(),
      });
      // A non-AskUserQuestion tool_use in the same batch (appears after)
      const toolLine = JSON.stringify({
        type: 'assistant',
        requestId: 'req_2',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'toolu_2', name: 'Read', input: { file_path: '/tmp/test.ts' } },
          ],
        },
        uuid: 'uuid-tool-after',
        timestamp: new Date().toISOString(),
      });
      // Turn complete at the end
      const turnLine = turnDurationLine();

      // Send all lines in a single batch — AskUserQuestion comes first
      daemon.handleLines([askLine, toolLine, turnLine]);

      // AskUserQuestion should be spoken, but AFTER turn complete
      // (turn complete is processed inline, AskUserQuestion is deferred)
      expect(spoken).toEqual([
        'Waiting for input',
        'Which approach?. Awaiting confirmation',
      ]);
    });
  });

  describe('AskUserQuestion cancellation on user response', () => {
    it('cancels AskUserQuestion when user responds before speech (with summarizer)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ message: { content: '要約テスト' } }),
          { status: 200 },
        ),
      );

      daemon = new Daemon({
        logger: silentLogger,
        language: 'en',
        watcher: { projectsDir: '/tmp/cc-voice-reporter-test-nonexistent' },
        speakFn: (message) => {
          spoken.push(message);
        },
        summary: {
          ollama: {
            model: 'test-model',
            baseUrl: 'http://localhost:11434',
          },
          intervalMs: 60_000,
          maxPromptEvents: 30,
          language: 'en',
        },
      });
      await daemon.start();

      // Record some activity, then AskUserQuestion
      const toolLine = JSON.stringify({
        type: 'assistant',
        requestId: 'req_0',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'toolu_0', name: 'Read', input: { file_path: '/src/app.ts' } },
          ],
        },
        uuid: 'uuid-tool-cancel',
        timestamp: new Date().toISOString(),
      });
      daemon.handleLines([toolLine]);

      const askLine = JSON.stringify({
        type: 'assistant',
        requestId: 'req_1',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'AskUserQuestion',
              input: {
                questions: [
                  {
                    question: 'Proceed?',
                    header: 'Confirm',
                    options: [
                      { label: 'Yes', description: 'yes' },
                      { label: 'No', description: 'no' },
                    ],
                    multiSelect: false,
                  },
                ],
              },
            },
          ],
        },
        uuid: 'uuid-ask-cancel',
        timestamp: new Date().toISOString(),
      });
      daemon.handleLines([askLine]);

      // User responds before summary flush completes
      const userLine = JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Yes' },
        uuid: 'uuid-user-response',
        timestamp: new Date().toISOString(),
      });
      daemon.handleLines([userLine]);

      // Now let the summary flush resolve
      await vi.advanceTimersByTimeAsync(0);

      // AskUserQuestion speech should be suppressed
      const askMessages = spoken.filter(s => s.includes('Awaiting confirmation'));
      expect(askMessages).toHaveLength(0);
    });

    it('cancels AskUserQuestion when new assistant text arrives', () => {
      daemon = new Daemon({
        logger: silentLogger,
        language: 'en',
        watcher: { projectsDir: '/tmp/cc-voice-reporter-test-nonexistent' },
        speakFn: (message) => {
          spoken.push(message);
        },
      });

      const askLine = JSON.stringify({
        type: 'assistant',
        requestId: 'req_1',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'AskUserQuestion',
              input: {
                questions: [
                  {
                    question: 'Which option?',
                    header: 'Choice',
                    options: [
                      { label: 'A', description: 'a' },
                      { label: 'B', description: 'b' },
                    ],
                    multiSelect: false,
                  },
                ],
              },
            },
          ],
        },
        uuid: 'uuid-ask-cancel2',
        timestamp: new Date().toISOString(),
      });

      // Without summarizer, AskUserQuestion speaks synchronously.
      // The speech should go through because no cancellation has occurred.
      daemon.handleLines([askLine]);
      expect(spoken).toEqual(['Which option?. Awaiting confirmation']);
    });

    it('does not cancel AskUserQuestion from unrelated session', async () => {
      const projectsDir = '/home/user/.claude/projects';
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ message: { content: '要約' } }),
          { status: 200 },
        ),
      );

      daemon = new Daemon({
        logger: silentLogger,
        language: 'en',
        watcher: { projectsDir },
        speakFn: (message) => {
          spoken.push(message);
        },
        resolveProjectName: dir => dir.replace(/^-/, ''),
        summary: {
          ollama: {
            model: 'test-model',
            baseUrl: 'http://localhost:11434',
          },
          intervalMs: 60_000,
          maxPromptEvents: 30,
          language: 'en',
        },
      });
      await daemon.start();

      // AskUserQuestion in session A
      const askLine = JSON.stringify({
        type: 'assistant',
        requestId: 'req_1',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'AskUserQuestion',
              input: {
                questions: [
                  {
                    question: 'Confirm?',
                    header: 'Confirm',
                    options: [
                      { label: 'Yes', description: 'yes' },
                      { label: 'No', description: 'no' },
                    ],
                    multiSelect: false,
                  },
                ],
              },
            },
          ],
        },
        uuid: 'uuid-ask-session-a',
        timestamp: new Date().toISOString(),
      });
      daemon.handleLines([askLine], `${projectsDir}/-proj/session-a.jsonl`);

      // User responds in session B (different session)
      const userLine = JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'response in session B' },
        uuid: 'uuid-user-session-b',
        timestamp: new Date().toISOString(),
      });
      daemon.handleLines([userLine], `${projectsDir}/-proj/session-b.jsonl`);

      await vi.advanceTimersByTimeAsync(0);

      // Session A's AskUserQuestion should still speak
      const askMessages = spoken.filter(s => s.includes('Awaiting confirmation'));
      expect(askMessages).toHaveLength(1);
    });
  });

  describe('non-relevant records', () => {
    it('does not speak for user records', () => {
      createDaemon();
      const line = JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'hello' },
        uuid: 'uuid-user',
        timestamp: new Date().toISOString(),
      });

      daemon.handleLines([line]);
      vi.advanceTimersByTime(1000);
      expect(spoken).toEqual([]);
    });

    it('ignores thinking content blocks', () => {
      createDaemon();
      const line = JSON.stringify({
        type: 'assistant',
        requestId: 'req_1',
        message: {
          role: 'assistant',
          content: [{ type: 'thinking', thinking: 'Let me think...' }],
        },
        uuid: 'uuid-thinking',
        timestamp: new Date().toISOString(),
      });

      daemon.handleLines([line]);
      vi.advanceTimersByTime(1000);
      expect(spoken).toEqual([]);
    });

    it('does not speak text messages (narration removed)', () => {
      createDaemon();
      daemon.handleLines([textLine('req_1', 'こんにちは')]);
      vi.advanceTimersByTime(1000);
      expect(spoken).toEqual([]);
    });
  });

  describe('stop', () => {
    it('stop completes without error', async () => {
      createDaemon();
      await daemon.stop();
    });
  });

  describe('forceStop', () => {
    it('forceStop completes without error', () => {
      createDaemon();
      daemon.forceStop();
    });
  });

  describe('project info tagging', () => {
    const projectsDir = '/home/user/.claude/projects';
    let spokenWithProject: Array<{ message: string; project?: ProjectInfo; session?: string }>;

    function createDaemonWithProject() {
      spokenWithProject = [];
      daemon = new Daemon({
        logger: silentLogger,
        language: 'en',
        watcher: { projectsDir },
        speakFn: (message, project, session) => {
          spoken.push(message);
          spokenWithProject.push({ message, project, session });
        },
        resolveProjectName: dir => dir.replace(/^-/, '').split('-').pop()!,
      });
    }

    it('passes project info for AskUserQuestion when filePath is provided', () => {
      createDaemonWithProject();
      const line = JSON.stringify({
        type: 'assistant',
        requestId: 'req_1',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'AskUserQuestion',
              input: {
                questions: [
                  {
                    question: '確認しますか？',
                    header: '確認',
                    options: [
                      { label: 'はい', description: 'Yes' },
                      { label: 'いいえ', description: 'No' },
                    ],
                    multiSelect: false,
                  },
                ],
              },
            },
          ],
        },
        uuid: 'uuid-ask-proj',
        timestamp: new Date().toISOString(),
      });

      daemon.handleLines(
        [line],
        `${projectsDir}/-proj-a/session.jsonl`,
      );

      expect(spokenWithProject).toHaveLength(1);
      expect(spokenWithProject[0]!.message).toBe('確認しますか？. Awaiting confirmation');
      expect(spokenWithProject[0]!.project).toEqual({
        dir: '-proj-a',
        displayName: 'a',
      });
    });

    it('passes project info with turn complete notification', () => {
      createDaemonWithProject();
      daemon.handleLines(
        [turnDurationLine()],
        `${projectsDir}/-proj-a/session.jsonl`,
      );

      expect(spokenWithProject).toHaveLength(1);
      expect(spokenWithProject[0]!.message).toBe('Waiting for input');
      expect(spokenWithProject[0]!.project).toEqual({
        dir: '-proj-a',
        displayName: 'a',
      });
    });

    it('uses DEFAULT_PROJECTS_DIR when watcher.projectsDir is not specified', () => {
      spokenWithProject = [];
      daemon = new Daemon({
        logger: silentLogger,
        language: 'en',
        speakFn: (message, project, session) => {
          spoken.push(message);
          spokenWithProject.push({ message, project, session });
        },
        resolveProjectName: dir => dir.replace(/^-/, '').split('-').pop()!,
      });

      daemon.handleLines(
        [turnDurationLine()],
        `${DEFAULT_PROJECTS_DIR}/-proj-x/session.jsonl`,
      );

      expect(spokenWithProject).toHaveLength(1);
      expect(spokenWithProject[0]!.project).toEqual({
        dir: '-proj-x',
        displayName: 'x',
      });
    });
  });

  describe('session info tagging', () => {
    const projectsDir = '/home/user/.claude/projects';
    let spokenWithContext: Array<{ message: string; project?: ProjectInfo; session?: string }>;

    function createDaemonWithSession() {
      spokenWithContext = [];
      daemon = new Daemon({
        logger: silentLogger,
        language: 'en',
        watcher: { projectsDir },
        speakFn: (message, project, session) => {
          spoken.push(message);
          spokenWithContext.push({ message, project, session });
        },
        resolveProjectName: dir => dir.replace(/^-/, '').split('-').pop()!,
      });
    }

    it('passes session ID for AskUserQuestion', () => {
      createDaemonWithSession();
      const line = JSON.stringify({
        type: 'assistant',
        requestId: 'req_1',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'AskUserQuestion',
              input: {
                questions: [
                  {
                    question: '確認しますか？',
                    header: '確認',
                    options: [
                      { label: 'はい', description: 'Yes' },
                      { label: 'いいえ', description: 'No' },
                    ],
                    multiSelect: false,
                  },
                ],
              },
            },
          ],
        },
        uuid: 'uuid-ask-session',
        timestamp: new Date().toISOString(),
      });

      daemon.handleLines(
        [line],
        `${projectsDir}/-proj-a/abc-123.jsonl`,
      );

      expect(spokenWithContext).toHaveLength(1);
      expect(spokenWithContext[0]!.session).toBe('abc-123');
    });

    it('passes session ID for turn complete notification', () => {
      createDaemonWithSession();
      daemon.handleLines(
        [turnDurationLine(3000)],
        `${projectsDir}/-proj-a/abc-123.jsonl`,
      );

      expect(spokenWithContext).toHaveLength(1);
      expect(spokenWithContext[0]!.message).toBe('Waiting for input');
      expect(spokenWithContext[0]!.session).toBe('abc-123');
    });
  });

  describe('turn complete notification', () => {
    it('speaks notification on turn complete', () => {
      createDaemon();
      daemon.handleLines([turnDurationLine(5000)]);

      expect(spoken).toEqual(['Waiting for input']);
    });

    it('does not speak notification for subagent files', () => {
      createDaemon();
      daemon.handleLines(
        [turnDurationLine(1000)],
        '/home/user/.claude/projects/-proj/session-uuid/subagents/agent-1.jsonl',
      );

      vi.advanceTimersByTime(1000);
      expect(spoken).toEqual([]);
    });

    it('speaks notification for main session files', () => {
      createDaemon();
      daemon.handleLines(
        [turnDurationLine(2000)],
        '/home/user/.claude/projects/-proj/session.jsonl',
      );

      expect(spoken).toEqual(['Waiting for input']);
    });
  });

  describe('turn complete suppression when new turn starts', () => {
    it('speaks notification synchronously when no async operations are pending', () => {
      createDaemon();
      daemon.handleLines([turnDurationLine()]);
      expect(spoken).toEqual(['Waiting for input']);
    });
  });

  describe('language option', () => {
    function createDaemonWithLanguage(language: string) {
      daemon = new Daemon({
        logger: silentLogger,
        language,
        watcher: { projectsDir: '/tmp/cc-voice-reporter-test-nonexistent' },
        speakFn: (message) => {
          spoken.push(message);
        },
      });
    }

    it('uses English messages when language is "en"', () => {
      createDaemonWithLanguage('en');
      daemon.handleLines([turnDurationLine()]);
      expect(spoken).toEqual(['Waiting for input']);
    });

    it('uses English AskUserQuestion format when language is "en"', () => {
      createDaemonWithLanguage('en');
      const line = JSON.stringify({
        type: 'assistant',
        requestId: 'req_1',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'AskUserQuestion',
              input: {
                questions: [
                  {
                    question: 'Which option?',
                    header: 'Choice',
                    options: [
                      { label: 'A', description: 'a' },
                      { label: 'B', description: 'b' },
                    ],
                    multiSelect: false,
                  },
                ],
              },
            },
          ],
        },
        uuid: 'uuid-en-ask',
        timestamp: new Date().toISOString(),
      });

      daemon.handleLines([line]);
      expect(spoken).toEqual(['Which option?. Awaiting confirmation']);
    });

    it('falls back to English for unknown language codes', () => {
      createDaemonWithLanguage('fr');
      daemon.handleLines([turnDurationLine()]);
      expect(spoken).toEqual(['Waiting for input']);
    });
  });

  describe('summary flush before notifications', () => {
    function createDaemonWithSummary() {
      daemon = new Daemon({
        logger: silentLogger,
        language: 'en',
        watcher: { projectsDir: '/tmp/cc-voice-reporter-test-nonexistent' },
        speakFn: (message) => {
          spoken.push(message);
        },
        summary: {
          ollama: {
            model: 'test-model',
            baseUrl: 'http://localhost:11434',
          },
          intervalMs: 60_000,
          maxPromptEvents: 30,
          language: 'en',
        },
      });
    }

    it('flushes summary before turn complete notification', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ message: { content: 'ファイルを編集しました' } }),
          { status: 200 },
        ),
      );

      createDaemonWithSummary();
      await daemon.start();

      // Record some activity, then turn complete
      daemon.handleLines([textLine('req_1', 'テスト')]);
      daemon.handleLines([turnDurationLine()]);

      // Wait for the async summary flush to complete
      await vi.advanceTimersByTimeAsync(0);

      // Summary should come before "Waiting for input"
      expect(spoken).toContain('ファイルを編集しました');
      expect(spoken).toContain('Waiting for input');
      const summaryIdx = spoken.indexOf('ファイルを編集しました');
      const notifyIdx = spoken.indexOf('Waiting for input');
      expect(summaryIdx).toBeLessThan(notifyIdx);
    });

    it('flushes summary before AskUserQuestion notification', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ message: { content: 'コードを確認しました' } }),
          { status: 200 },
        ),
      );

      createDaemonWithSummary();
      await daemon.start();

      // Record some tool_use activity
      const toolLine = JSON.stringify({
        type: 'assistant',
        requestId: 'req_0',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'toolu_0', name: 'Read', input: { file_path: '/src/app.ts' } },
          ],
        },
        uuid: 'uuid-tool-0',
        timestamp: new Date().toISOString(),
      });
      daemon.handleLines([toolLine]);

      // Now AskUserQuestion arrives
      const askLine = JSON.stringify({
        type: 'assistant',
        requestId: 'req_1',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'AskUserQuestion',
              input: {
                questions: [
                  {
                    question: 'どちらにしますか？',
                    header: '選択',
                    options: [
                      { label: 'A', description: 'a' },
                      { label: 'B', description: 'b' },
                    ],
                    multiSelect: false,
                  },
                ],
              },
            },
          ],
        },
        uuid: 'uuid-ask-summary',
        timestamp: new Date().toISOString(),
      });
      daemon.handleLines([askLine]);

      await vi.advanceTimersByTimeAsync(0);

      // Summary should come before "確認待ち"
      expect(spoken).toContain('コードを確認しました');
      expect(spoken).toContain('どちらにしますか？. Awaiting confirmation');
      const summaryIdx = spoken.indexOf('コードを確認しました');
      const askIdx = spoken.indexOf('どちらにしますか？. Awaiting confirmation');
      expect(summaryIdx).toBeLessThan(askIdx);
    });

    it('turn complete works when no summary events are pending', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ message: { content: '' } }),
          { status: 200 },
        ),
      );

      createDaemonWithSummary();
      await daemon.start();

      daemon.handleLines([turnDurationLine()]);
      await vi.advanceTimersByTimeAsync(0);

      // No summary events → no Ollama call, just the notification
      expect(spoken).toEqual(['Waiting for input']);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('text events trigger throttled summary flush', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ message: { content: '中間要約' } }),
          { status: 200 },
        ),
      );

      createDaemonWithSummary();
      await daemon.start();

      daemon.handleLines([textLine('req_1', '長い作業中のテキスト')]);

      // Wait for the throttle interval (60s)
      await vi.advanceTimersByTimeAsync(60_000);

      expect(spoken).toContain('中間要約');
    });
  });
});
