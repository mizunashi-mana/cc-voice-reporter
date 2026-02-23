import { describe, expect, it } from 'vitest';
import {
  NotificationStateManager,
  notificationCancelTag,
  LEVEL_TURN_COMPLETE,
  LEVEL_PERMISSION_PROMPT,
  LEVEL_IDLE_PROMPT,
  LEVEL_ASK_QUESTION,
} from './notification-state.js';

describe('notificationCancelTag', () => {
  it('returns a tag prefixed with "notification:"', () => {
    expect(notificationCancelTag('session-abc')).toBe('notification:session-abc');
  });

  it('handles empty session key', () => {
    expect(notificationCancelTag('')).toBe('notification:');
  });
});

describe('priority level constants', () => {
  it('defines increasing priority levels', () => {
    expect(LEVEL_TURN_COMPLETE).toBeLessThan(LEVEL_PERMISSION_PROMPT);
    expect(LEVEL_PERMISSION_PROMPT).toBeLessThan(LEVEL_IDLE_PROMPT);
    expect(LEVEL_IDLE_PROMPT).toBeLessThan(LEVEL_ASK_QUESTION);
  });
});

describe('NotificationStateManager', () => {
  it('creates default state for new session', () => {
    const mgr = new NotificationStateManager();
    const state = mgr.getSessionState('s1');
    expect(state).toEqual({ generation: 0, notificationLevel: 0 });
  });

  it('returns the same state object for the same key', () => {
    const mgr = new NotificationStateManager();
    const a = mgr.getSessionState('s1');
    const b = mgr.getSessionState('s1');
    expect(a).toBe(b);
  });

  it('returns different state objects for different keys', () => {
    const mgr = new NotificationStateManager();
    const a = mgr.getSessionState('s1');
    const b = mgr.getSessionState('s2');
    expect(a).not.toBe(b);
  });

  describe('cancelActivity', () => {
    it('increments generation and resets notificationLevel', () => {
      const mgr = new NotificationStateManager();
      mgr.setNotificationLevel('s1', LEVEL_IDLE_PROMPT);
      mgr.cancelActivity('s1');

      const state = mgr.getSessionState('s1');
      expect(state.generation).toBe(1);
      expect(state.notificationLevel).toBe(0);
    });

    it('increments generation on each call', () => {
      const mgr = new NotificationStateManager();
      mgr.cancelActivity('s1');
      mgr.cancelActivity('s1');
      mgr.cancelActivity('s1');
      expect(mgr.getSessionState('s1').generation).toBe(3);
    });

    it('does not affect other sessions', () => {
      const mgr = new NotificationStateManager();
      mgr.setNotificationLevel('s1', LEVEL_ASK_QUESTION);
      mgr.cancelActivity('s2');

      expect(mgr.getSessionState('s1').notificationLevel).toBe(LEVEL_ASK_QUESTION);
      expect(mgr.getSessionState('s1').generation).toBe(0);
    });
  });

  describe('shouldNotify', () => {
    it('returns true when level is higher than current', () => {
      const mgr = new NotificationStateManager();
      expect(mgr.shouldNotify('s1', LEVEL_TURN_COMPLETE)).toBe(true);
    });

    it('returns false when level equals current', () => {
      const mgr = new NotificationStateManager();
      mgr.setNotificationLevel('s1', LEVEL_PERMISSION_PROMPT);
      expect(mgr.shouldNotify('s1', LEVEL_PERMISSION_PROMPT)).toBe(false);
    });

    it('returns false when level is lower than current', () => {
      const mgr = new NotificationStateManager();
      mgr.setNotificationLevel('s1', LEVEL_ASK_QUESTION);
      expect(mgr.shouldNotify('s1', LEVEL_TURN_COMPLETE)).toBe(false);
    });

    it('returns true after cancelActivity resets level', () => {
      const mgr = new NotificationStateManager();
      mgr.setNotificationLevel('s1', LEVEL_ASK_QUESTION);
      mgr.cancelActivity('s1');
      expect(mgr.shouldNotify('s1', LEVEL_TURN_COMPLETE)).toBe(true);
    });
  });

  describe('setNotificationLevel', () => {
    it('updates the notification level', () => {
      const mgr = new NotificationStateManager();
      mgr.setNotificationLevel('s1', LEVEL_IDLE_PROMPT);
      expect(mgr.getSessionState('s1').notificationLevel).toBe(LEVEL_IDLE_PROMPT);
    });
  });
});
