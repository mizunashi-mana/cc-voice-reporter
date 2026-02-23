/**
 * Notification state management for per-session notification priority.
 *
 * Tracks generation counters (for async cancellation) and notification
 * priority levels (for suppressing lower-priority notifications) on a
 * per-session basis.
 *
 * The Daemon uses this module to coordinate notification dispatch:
 * when new activity arrives, the generation counter is incremented and
 * the priority level is reset; in-flight async operations compare
 * generations to detect stale notifications.
 */

/**
 * Per-session notification state.
 *
 * - `generation` is incremented whenever new activity arrives (text,
 *   tool_use, user_response). Async operations capture the generation
 *   before starting and compare after completion; a mismatch means
 *   new activity arrived and the notification should be suppressed.
 * - `notificationLevel` tracks the highest-priority notification spoken
 *   since the last activity. Higher-priority notifications override
 *   lower ones; same or lower are suppressed. Reset on new activity.
 */
export interface SessionState {
  generation: number;
  notificationLevel: number;
}

/**
 * Notification priority levels (higher value = higher priority).
 * When multiple notification types fire for the same session,
 * only the highest-priority one speaks. Lower-priority notifications
 * arriving later are suppressed until new activity resets the level.
 */
export const LEVEL_TURN_COMPLETE = 1;
export const LEVEL_PERMISSION_PROMPT = 2;
export const LEVEL_IDLE_PROMPT = 3;
export const LEVEL_ASK_QUESTION = 4;

/** Build the cancel tag for notification messages of a given session. */
export function notificationCancelTag(sessionKey: string): string {
  return `notification:${sessionKey}`;
}

/**
 * Manages per-session notification state: generation counters and
 * priority levels. The Daemon holds one instance of this class and
 * delegates all state queries/mutations to it.
 *
 * Note: `cancelActivity` only updates internal state (generation++,
 * level reset). The caller is responsible for invoking
 * `speaker.cancelByTag(...)` separately.
 */
export class NotificationStateManager {
  private readonly sessionState = new Map<string, SessionState>();

  /** Get or create the session state for the given key. */
  getSessionState(sessionKey: string): SessionState {
    let state = this.sessionState.get(sessionKey);
    if (state === undefined) {
      state = { generation: 0, notificationLevel: 0 };
      this.sessionState.set(sessionKey, state);
    }
    return state;
  }

  /**
   * Cancel all pending notifications for the given session.
   * Increments the generation counter (invalidating in-flight async operations)
   * and resets the notification priority level.
   *
   * The caller must separately cancel queued Speaker messages via
   * `speaker.cancelByTag(notificationCancelTag(sessionKey))`.
   */
  cancelActivity(sessionKey: string): void {
    const state = this.getSessionState(sessionKey);
    state.generation += 1;
    state.notificationLevel = 0;
  }

  /**
   * Check whether a notification at the given level should be spoken.
   * Returns true if the level is higher than the current session level.
   */
  shouldNotify(sessionKey: string, level: number): boolean {
    return level > this.getSessionState(sessionKey).notificationLevel;
  }

  /** Update the notification level for the given session. */
  setNotificationLevel(sessionKey: string, level: number): void {
    this.getSessionState(sessionKey).notificationLevel = level;
  }
}
