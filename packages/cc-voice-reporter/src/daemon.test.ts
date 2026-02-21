import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Daemon } from './daemon.js';
import { Logger } from './logger.js';
import { DEFAULT_PROJECTS_DIR } from './watcher.js';
import type { ProjectInfo } from './speaker.js';

const silentLogger = new Logger({ writeFn: () => {} });

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
  let daemon: Daemon | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    spoken = [];
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    await daemon?.stop();
  });

  function createDaemon() {
    daemon = new Daemon({
      logger: silentLogger,
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
      expect(spoken).toEqual(['確認待ち: どの方式を使いますか？']);
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
      expect(spoken).toEqual(['確認待ち: 質問1？ 質問2？']);
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
  });

  describe('non-relevant records', () => {
    it('ignores user records', () => {
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
      expect(spokenWithProject[0]!.message).toBe('確認待ち: 確認しますか？');
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
      expect(spokenWithProject[0]!.message).toBe('入力待ちです');
      expect(spokenWithProject[0]!.project).toEqual({
        dir: '-proj-a',
        displayName: 'a',
      });
    });

    it('uses DEFAULT_PROJECTS_DIR when watcher.projectsDir is not specified', () => {
      spokenWithProject = [];
      daemon = new Daemon({
        logger: silentLogger,
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
      expect(spokenWithContext[0]!.message).toBe('入力待ちです');
      expect(spokenWithContext[0]!.session).toBe('abc-123');
    });
  });

  describe('turn complete notification', () => {
    it('speaks notification on turn complete', () => {
      createDaemon();
      daemon.handleLines([turnDurationLine(5000)]);

      expect(spoken).toEqual(['入力待ちです']);
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

      expect(spoken).toEqual(['入力待ちです']);
    });
  });

  describe('turn complete suppression when new turn starts', () => {
    it('speaks notification synchronously when no async operations are pending', () => {
      createDaemon();
      daemon.handleLines([turnDurationLine()]);
      expect(spoken).toEqual(['入力待ちです']);
    });
  });

  describe('summary flush before notifications', () => {
    function createDaemonWithSummary() {
      daemon = new Daemon({
        logger: silentLogger,
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

      // Summary should come before "入力待ちです"
      expect(spoken).toContain('ファイルを編集しました');
      expect(spoken).toContain('入力待ちです');
      const summaryIdx = spoken.indexOf('ファイルを編集しました');
      const notifyIdx = spoken.indexOf('入力待ちです');
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
      expect(spoken).toContain('確認待ち: どちらにしますか？');
      const summaryIdx = spoken.indexOf('コードを確認しました');
      const askIdx = spoken.indexOf('確認待ち: どちらにしますか？');
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
      expect(spoken).toEqual(['入力待ちです']);
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
