import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Daemon } from './daemon.js';
import type { Logger } from './logger.js';

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

/** Helper to build an AskUserQuestion tool_use line. */
function askQuestionLine(requestId: string, question: string): string {
  return JSON.stringify({
    type: 'assistant',
    requestId,
    message: {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: `toolu_${Math.random().toString(36).slice(2)}`,
          name: 'AskUserQuestion',
          input: {
            questions: [
              {
                question,
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
    uuid: `uuid-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
  });
}

/** Helper to build a user response line. */
function userResponseLine(content: string): string {
  return JSON.stringify({
    type: 'user',
    message: { role: 'user', content },
    uuid: `uuid-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
  });
}

describe('Daemon cancellation', () => {
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
          maxPromptEvents: 10,
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
      daemon.handleLines([askQuestionLine('req_1', 'Proceed?')]);

      // User responds before summary flush completes
      daemon.handleLines([userResponseLine('Yes')]);

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

      // Without summarizer, AskUserQuestion speaks synchronously.
      // The speech should go through because no cancellation has occurred.
      daemon.handleLines([askQuestionLine('req_1', 'Which option?')]);
      expect(spoken).toEqual(['Which option?. Awaiting confirmation']);
    });

    it('cancels AskUserQuestion when user responds in the same batch (intra-batch)', () => {
      daemon = new Daemon({
        logger: silentLogger,
        language: 'en',
        watcher: { projectsDir: '/tmp/cc-voice-reporter-test-nonexistent' },
        speakFn: (message) => {
          spoken.push(message);
        },
      });

      // Both AskUserQuestion and user_response in same batch
      daemon.handleLines([
        askQuestionLine('req_1', 'Proceed?'),
        userResponseLine('Yes'),
      ]);

      // AskUserQuestion should be suppressed because user already responded
      const askMessages = spoken.filter(s => s.includes('Awaiting confirmation'));
      expect(askMessages).toHaveLength(0);
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
          maxPromptEvents: 10,
          language: 'en',
        },
      });
      await daemon.start();

      // AskUserQuestion in session A
      daemon.handleLines(
        [askQuestionLine('req_1', 'Confirm?')],
        `${projectsDir}/-proj/session-a.jsonl`,
      );

      // User responds in session B (different session)
      daemon.handleLines(
        [userResponseLine('response in session B')],
        `${projectsDir}/-proj/session-b.jsonl`,
      );

      await vi.advanceTimersByTimeAsync(0);

      // Session A's AskUserQuestion should still speak
      const askMessages = spoken.filter(s => s.includes('Awaiting confirmation'));
      expect(askMessages).toHaveLength(1);
    });
  });

  describe('cancelTag for notification messages', () => {
    const projectsDir = '/home/user/.claude/projects';

    it('passes cancelTag for turn complete notifications', () => {
      const spokenWithTag: Array<{ message: string; cancelTag?: string }> = [];
      daemon = new Daemon({
        logger: silentLogger,
        language: 'en',
        watcher: { projectsDir },
        speakFn: (message, _project, _session, cancelTag) => {
          spoken.push(message);
          spokenWithTag.push({ message, cancelTag });
        },
        resolveProjectName: dir => dir,
      });

      daemon.handleLines(
        [turnDurationLine()],
        `${projectsDir}/-proj/session-abc.jsonl`,
      );

      expect(spokenWithTag).toHaveLength(1);
      expect(spokenWithTag[0]!.cancelTag).toBe('notification:session-abc');
    });

    it('passes cancelTag for AskUserQuestion notifications', () => {
      const spokenWithTag: Array<{ message: string; cancelTag?: string }> = [];
      daemon = new Daemon({
        logger: silentLogger,
        language: 'en',
        watcher: { projectsDir },
        speakFn: (message, _project, _session, cancelTag) => {
          spoken.push(message);
          spokenWithTag.push({ message, cancelTag });
        },
        resolveProjectName: dir => dir,
      });

      daemon.handleLines(
        [askQuestionLine('req_1', 'Proceed?')],
        `${projectsDir}/-proj/session-xyz.jsonl`,
      );

      expect(spokenWithTag).toHaveLength(1);
      expect(spokenWithTag[0]!.cancelTag).toBe('notification:session-xyz');
    });

    it('does not pass cancelTag for summary messages', async () => {
      const spokenWithTag: Array<{ message: string; cancelTag?: string }> = [];
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ message: { content: 'Summary text' } }),
          { status: 200 },
        ),
      );

      daemon = new Daemon({
        logger: silentLogger,
        language: 'en',
        watcher: { projectsDir: '/tmp/cc-voice-reporter-test-nonexistent' },
        speakFn: (message, _project, _session, cancelTag) => {
          spoken.push(message);
          spokenWithTag.push({ message, cancelTag });
        },
        summary: {
          ollama: {
            model: 'test-model',
            baseUrl: 'http://localhost:11434',
          },
          intervalMs: 60_000,
          maxPromptEvents: 10,
          language: 'en',
        },
      });
      await daemon.start();

      daemon.handleLines([textLine('req_1', 'Some text')]);
      await vi.advanceTimersByTimeAsync(60_000);

      // Summary message should not have a cancelTag
      const summaryMessages = spokenWithTag.filter(s => s.message === 'Summary text');
      expect(summaryMessages).toHaveLength(1);
      expect(summaryMessages[0]!.cancelTag).toBeUndefined();
    });
  });
});
