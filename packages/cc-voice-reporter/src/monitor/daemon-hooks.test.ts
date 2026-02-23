import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Daemon } from './daemon.js';
import type { HookEvent } from './hook-watcher.js';
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

function hookEvent(overrides: Partial<HookEvent> = {}): HookEvent {
  return {
    sessionId: '',
    hookEventName: 'Notification',
    notificationType: 'permission_prompt',
    ...overrides,
  };
}

describe('Daemon hook events', () => {
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
      watcher: { projectsDir: '/tmp/cc-voice-reporter-test-nonexistent' },
      speakFn: (message) => {
        spoken.push(message);
      },
    });
  }

  describe('handleHookEvents', () => {
    it('speaks permission request for permission_prompt', () => {
      createDaemon();
      daemon.handleHookEvents([hookEvent({ sessionId: 's1' })]);
      expect(spoken).toEqual(['Permission required']);
    });

    it('speaks permission request for idle_prompt', () => {
      createDaemon();
      daemon.handleHookEvents([hookEvent({ sessionId: 's1', notificationType: 'idle_prompt' })]);
      expect(spoken).toEqual(['Permission required']);
    });

    it('ignores non-Notification hook events', () => {
      createDaemon();
      daemon.handleHookEvents([hookEvent({ hookEventName: 'PreToolUse' })]);
      expect(spoken).toEqual([]);
    });

    it('ignores notification types other than permission_prompt and idle_prompt', () => {
      createDaemon();
      daemon.handleHookEvents([hookEvent({ notificationType: 'other_type' })]);
      expect(spoken).toEqual([]);
    });

    it('uses Japanese message when language is ja', () => {
      daemon = new Daemon({
        logger: silentLogger, language: 'ja',
        watcher: { projectsDir: '/tmp/cc-voice-reporter-test-nonexistent' },
        speakFn: (msg) => { spoken.push(msg); },
      });
      daemon.handleHookEvents([hookEvent({ sessionId: 's1' })]);
      expect(spoken).toEqual(['パーミッション確認です']);
    });

    it('passes project and session from transcriptPath to speakFn', () => {
      const projectsDir = '/home/user/.claude/projects';
      const calls: Array<{ message: string; project?: { dir: string; displayName: string }; session?: string }> = [];
      daemon = new Daemon({
        logger: silentLogger,
        language: 'en',
        watcher: { projectsDir },
        speakFn: (message, project, session) => {
          calls.push({ message, project, session });
        },
        resolveProjectName: dir => dir.replace(/^-/, ''),
      });

      daemon.handleHookEvents([hookEvent({
        sessionId: 'sess-1',
        transcriptPath: `${projectsDir}/-my-project/sess-1.jsonl`,
      })]);

      expect(calls).toHaveLength(1);
      expect(calls[0]?.project).toEqual({ dir: '-my-project', displayName: 'my-project' });
      expect(calls[0]?.session).toBe('sess-1');
    });
  });

  describe('notification priority', () => {
    it('permission_prompt suppresses subsequent turn_complete', () => {
      createDaemon();
      daemon.handleHookEvents([hookEvent({ notificationType: 'permission_prompt' })]);
      daemon.handleLines([turnDurationLine()]);
      expect(spoken).toEqual(['Permission required']);
    });

    it('idle_prompt suppresses subsequent permission_prompt and turn_complete', () => {
      createDaemon();
      daemon.handleHookEvents([hookEvent({ notificationType: 'idle_prompt' })]);
      daemon.handleHookEvents([hookEvent({ notificationType: 'permission_prompt' })]);
      daemon.handleLines([turnDurationLine()]);
      expect(spoken).toEqual(['Permission required']);
    });

    it('idle_prompt overrides prior permission_prompt', () => {
      createDaemon();
      daemon.handleHookEvents([hookEvent({ notificationType: 'permission_prompt' })]);
      daemon.handleHookEvents([hookEvent({ notificationType: 'idle_prompt' })]);
      expect(spoken).toEqual(['Permission required', 'Permission required']);
    });

    it('turn_complete does not suppress subsequent idle_prompt', () => {
      createDaemon();
      daemon.handleLines([turnDurationLine()]);
      daemon.handleHookEvents([hookEvent({ notificationType: 'idle_prompt' })]);
      expect(spoken).toEqual(['Waiting for input', 'Permission required']);
    });

    it('AskQuestion suppresses subsequent hook notifications', () => {
      createDaemon();
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
                  { question: 'Q?', header: 'H', options: [{ label: 'A', description: 'a' }, { label: 'B', description: 'b' }], multiSelect: false },
                ],
              },
            },
          ],
        },
        uuid: 'uuid-ask-prio',
        timestamp: new Date().toISOString(),
      });
      daemon.handleLines([askLine]);
      daemon.handleHookEvents([hookEvent({ notificationType: 'idle_prompt' })]);
      daemon.handleHookEvents([hookEvent({ notificationType: 'permission_prompt' })]);
      expect(spoken).toEqual(['Q?. Awaiting confirmation']);
    });

    it('new activity resets notification level allowing new notifications', () => {
      createDaemon();
      daemon.handleHookEvents([hookEvent({ notificationType: 'idle_prompt' })]);
      daemon.handleLines([textLine('req_1', 'activity')]);
      daemon.handleHookEvents([hookEvent({ notificationType: 'permission_prompt' })]);
      expect(spoken).toEqual(['Permission required', 'Permission required']);
    });

    it('new user_response resets notification level', () => {
      createDaemon();
      daemon.handleHookEvents([hookEvent({ notificationType: 'permission_prompt' })]);
      const userLine = JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'yes' },
        uuid: 'uuid-user-reset',
        timestamp: new Date().toISOString(),
      });
      daemon.handleLines([userLine]);
      daemon.handleLines([turnDurationLine()]);
      expect(spoken).toEqual(['Permission required', 'Waiting for input']);
    });

    it('different sessions have independent notification levels', () => {
      const projectsDir = '/home/user/.claude/projects';
      daemon = new Daemon({
        logger: silentLogger,
        language: 'en',
        watcher: { projectsDir },
        speakFn: (msg) => { spoken.push(msg); },
        resolveProjectName: dir => dir.replace(/^-/, ''),
      });

      daemon.handleHookEvents([hookEvent({ sessionId: 'session-a', notificationType: 'idle_prompt' })]);
      daemon.handleLines(
        [turnDurationLine()],
        `${projectsDir}/-proj/session-b.jsonl`,
      );
      expect(spoken).toEqual(['Permission required', 'Waiting for input']);
    });
  });
});
