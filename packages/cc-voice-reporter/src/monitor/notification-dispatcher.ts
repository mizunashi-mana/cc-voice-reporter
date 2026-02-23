/**
 * Notification dispatch logic.
 *
 * Encapsulates the common pattern shared by all notification types
 * (turn_complete, AskUserQuestion, permission_prompt, idle_prompt):
 *
 *   1. Capture generation (for async cancellation)
 *   2. Optionally flush the summarizer
 *   3. Check generation (skip if new activity arrived)
 *   4. Check priority level (skip if higher-priority notification active)
 *   5. Speak the notification with a cancel tag
 *
 * Extracted from Daemon to keep the class focused on orchestration.
 */

import {
  notificationCancelTag,
  type NotificationStateManager,
} from './notification-state.js';
import type { SpeakFn } from './daemon.js';
import type { Logger } from './logger.js';
import type { ProjectInfo } from './speaker.js';

/** Summarizer subset used by the dispatcher (flush only). */
export interface Flushable {
  flush: () => Promise<void>;
}

/** Parameters for a single notification dispatch. */
export interface DispatchNotificationParams {
  sessionKey: string;
  level: number;
  message: string;
  project: ProjectInfo | null;
  session: string | null;
  debugLabel: string;
  flushSummary: boolean;
}

/** External dependencies injected into the dispatcher. */
export interface DispatchDeps {
  notificationState: NotificationStateManager;
  speakFn: SpeakFn;
  summarizer: Flushable | null;
  logger: Logger;
  onError: (err: Error) => void;
}

/**
 * Dispatch a notification with generation-based async cancellation
 * and priority-based suppression.
 */
export function dispatchNotification(
  params: DispatchNotificationParams,
  deps: DispatchDeps,
): void {
  const {
    sessionKey, level, message, project, session, debugLabel, flushSummary,
  } = params;
  const { notificationState, speakFn, summarizer, logger, onError } = deps;
  const { generation } = notificationState.getSessionState(sessionKey);

  const speak = (): void => {
    if (notificationState.getSessionState(sessionKey).generation !== generation) {
      logger.debug(
        `skip: ${debugLabel} suppressed (new activity)`,
      );
      return;
    }
    if (!notificationState.shouldNotify(sessionKey, level)) {
      logger.debug(
        `skip: ${debugLabel} suppressed (higher priority notification active)`,
      );
      return;
    }
    notificationState.setNotificationLevel(sessionKey, level);
    logger.debug(`speak: ${debugLabel}`);
    speakFn(
      message,
      project ?? undefined,
      session ?? undefined,
      notificationCancelTag(sessionKey),
    );
  };

  if (flushSummary && summarizer) {
    void summarizer
      .flush()
      .then(speak)
      .catch((err: unknown) => {
        onError(
          err instanceof Error ? err : new Error(String(err)),
        );
      });
    return;
  }

  speak();
}
