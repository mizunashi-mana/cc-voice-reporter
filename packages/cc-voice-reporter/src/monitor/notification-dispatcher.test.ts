import { describe, expect, it, vi } from 'vitest';
import {
  dispatchNotification,
  type DispatchDeps,
  type DispatchNotificationParams,
} from './notification-dispatcher.js';
import {
  NotificationStateManager,
  LEVEL_TURN_COMPLETE,
  LEVEL_ASK_QUESTION,
} from './notification-state.js';
import type { Logger } from './logger.js';

const silentLogger: Logger = { debug() {}, info() {}, warn() {}, error() {} };

/** Flush microtask queue so `.then()` / `.catch()` handlers execute. */
async function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(resolve);
  });
}

function createDeps(overrides?: Partial<DispatchDeps>): DispatchDeps {
  return {
    notificationState: new NotificationStateManager(),
    speakFn: vi.fn(),
    summarizer: null,
    logger: silentLogger,
    onError: vi.fn(),
    ...overrides,
  };
}

function createParams(overrides?: Partial<DispatchNotificationParams>): DispatchNotificationParams {
  return {
    sessionKey: '',
    level: LEVEL_TURN_COMPLETE,
    message: 'Waiting for input',
    project: null,
    session: null,
    debugLabel: 'test',
    flushSummary: false,
    ...overrides,
  };
}

describe('dispatchNotification', () => {
  it('speaks the notification synchronously when no summarizer', () => {
    const deps = createDeps();
    dispatchNotification(createParams(), deps);
    expect(deps.speakFn).toHaveBeenCalledWith(
      'Waiting for input',
      undefined,
      undefined,
      'notification:',
    );
  });

  it('passes project and session to speakFn', () => {
    const deps = createDeps();
    dispatchNotification(createParams({
      sessionKey: 'sess-1',
      project: { dir: '-proj', displayName: 'proj' },
      session: 'sess-1',
    }), deps);
    expect(deps.speakFn).toHaveBeenCalledWith(
      'Waiting for input',
      { dir: '-proj', displayName: 'proj' },
      'sess-1',
      'notification:sess-1',
    );
  });

  it('suppresses notification when generation has advanced (async path)', async () => {
    const notificationState = new NotificationStateManager();
    const summarizer = {
      flush: vi.fn().mockImplementation(async () => {
        // Simulate new activity during flush — advances generation
        notificationState.cancelActivity('');
        return Promise.resolve();
      }),
    };
    const deps = createDeps({ notificationState, summarizer });

    dispatchNotification(createParams({ flushSummary: true }), deps);
    await flushMicrotasks();

    expect(deps.speakFn).not.toHaveBeenCalled();
  });

  it('suppresses notification when priority level is not high enough', () => {
    const notificationState = new NotificationStateManager();
    notificationState.setNotificationLevel('', LEVEL_ASK_QUESTION);
    const deps = createDeps({ notificationState });
    dispatchNotification(createParams({ level: LEVEL_TURN_COMPLETE }), deps);
    expect(deps.speakFn).not.toHaveBeenCalled();
  });

  it('updates notification level after speaking', () => {
    const notificationState = new NotificationStateManager();
    const deps = createDeps({ notificationState });
    dispatchNotification(createParams({ level: LEVEL_ASK_QUESTION }), deps);
    expect(notificationState.getSessionState('').notificationLevel).toBe(LEVEL_ASK_QUESTION);
  });

  describe('with summarizer flush', () => {
    it('flushes summarizer before speaking', async () => {
      const flushOrder: string[] = [];
      const summarizer = {
        flush: vi.fn().mockImplementation(async () => {
          flushOrder.push('flush');
          return Promise.resolve();
        }),
      };
      const speakFn = vi.fn().mockImplementation(() => {
        flushOrder.push('speak');
      });

      const deps = createDeps({ summarizer, speakFn });
      dispatchNotification(createParams({ flushSummary: true }), deps);

      await flushMicrotasks();

      expect(summarizer.flush).toHaveBeenCalled();
      expect(speakFn).toHaveBeenCalled();
      expect(flushOrder).toEqual(['flush', 'speak']);
    });

    it('calls onError when flush rejects', async () => {
      const error = new Error('flush failed');
      const summarizer = {
        flush: vi.fn().mockRejectedValue(error),
      };
      const deps = createDeps({ summarizer });
      dispatchNotification(createParams({ flushSummary: true }), deps);

      await flushMicrotasks();

      expect(deps.onError).toHaveBeenCalledWith(error);
      expect(deps.speakFn).not.toHaveBeenCalled();
    });

    it('wraps non-Error rejections in Error', async () => {
      const summarizer = {
        flush: vi.fn().mockRejectedValue('string error'),
      };
      const deps = createDeps({ summarizer });
      dispatchNotification(createParams({ flushSummary: true }), deps);

      await flushMicrotasks();

      expect(deps.onError).toHaveBeenCalledWith(new Error('string error'));
    });

    it('does not flush when flushSummary is false', () => {
      const summarizer = { flush: vi.fn() };
      const deps = createDeps({ summarizer });
      dispatchNotification(createParams({ flushSummary: false }), deps);

      expect(summarizer.flush).not.toHaveBeenCalled();
      expect(deps.speakFn).toHaveBeenCalled();
    });

    it('does not flush when summarizer is null', () => {
      const deps = createDeps({ summarizer: null });
      dispatchNotification(createParams({ flushSummary: true }), deps);

      // Should speak synchronously
      expect(deps.speakFn).toHaveBeenCalled();
    });
  });
});
