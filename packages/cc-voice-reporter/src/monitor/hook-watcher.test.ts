import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HookWatcher, parseHookEvent, type HookEvent } from './hook-watcher.js';
import type { Logger } from './logger.js';

const silentLogger: Logger = { debug() {}, info() {}, warn() {}, error() {} };

describe('parseHookEvent', () => {
  it('parses a valid Notification hook event', () => {
    const json = JSON.stringify({
      session_id: 'abc-123',
      hook_event_name: 'Notification',
      notification_type: 'permission_prompt',
      message: 'Claude needs your permission to use Bash',
    });
    const event = parseHookEvent(json);
    expect(event).toEqual({
      sessionId: 'abc-123',
      hookEventName: 'Notification',
      notificationType: 'permission_prompt',
      message: 'Claude needs your permission to use Bash',
      transcriptPath: undefined,
    });
  });

  it('parses an idle_prompt notification', () => {
    const json = JSON.stringify({
      session_id: 'abc-123',
      hook_event_name: 'Notification',
      notification_type: 'idle_prompt',
      message: 'Claude is waiting for your input',
    });
    const event = parseHookEvent(json);
    expect(event).toEqual({
      sessionId: 'abc-123',
      hookEventName: 'Notification',
      notificationType: 'idle_prompt',
      message: 'Claude is waiting for your input',
      transcriptPath: undefined,
    });
  });

  it('parses transcript_path when present', () => {
    const json = JSON.stringify({
      session_id: 'abc-123',
      hook_event_name: 'Notification',
      notification_type: 'permission_prompt',
      transcript_path: '/home/user/.claude/projects/-proj/abc-123.jsonl',
    });
    const event = parseHookEvent(json);
    expect(event?.transcriptPath).toBe('/home/user/.claude/projects/-proj/abc-123.jsonl');
  });

  it('parses an event without optional fields', () => {
    const json = JSON.stringify({
      session_id: 'abc-123',
      hook_event_name: 'SessionStart',
    });
    const event = parseHookEvent(json);
    expect(event).toEqual({
      sessionId: 'abc-123',
      hookEventName: 'SessionStart',
      notificationType: undefined,
      message: undefined,
      transcriptPath: undefined,
    });
  });

  it('returns null for invalid JSON', () => {
    expect(parseHookEvent('not json')).toBeNull();
  });

  it('returns null for missing session_id', () => {
    const json = JSON.stringify({ hook_event_name: 'Notification' });
    expect(parseHookEvent(json)).toBeNull();
  });

  it('returns null for missing hook_event_name', () => {
    const json = JSON.stringify({ session_id: 'abc-123' });
    expect(parseHookEvent(json)).toBeNull();
  });

  it('ignores extra fields', () => {
    const json = JSON.stringify({
      session_id: 'abc-123',
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      extra: 'data',
    });
    const event = parseHookEvent(json);
    expect(event).not.toBeNull();
    expect(event?.hookEventName).toBe('PreToolUse');
  });
});

describe('HookWatcher', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'cc-voice-reporter-hook-watcher-test-'),
    );
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates the hooks directory if it does not exist', async () => {
    const hooksDir = path.join(tmpDir, 'hooks');
    const events: HookEvent[] = [];
    const watcher = new HookWatcher(
      { onEvents: evts => events.push(...evts) },
      { hooksDir, logger: silentLogger },
    );

    await watcher.start();
    expect(fs.existsSync(hooksDir)).toBe(true);
    await watcher.close();
  });

  it('emits events when a new file is created after start', async () => {
    const hooksDir = path.join(tmpDir, 'hooks');
    const events: HookEvent[] = [];
    const watcher = new HookWatcher(
      { onEvents: evts => events.push(...evts) },
      { hooksDir, logger: silentLogger },
    );

    await watcher.start();

    const filePath = path.join(hooksDir, 'session-1.jsonl');
    const line = JSON.stringify({
      session_id: 'session-1',
      hook_event_name: 'Notification',
      notification_type: 'permission_prompt',
      message: 'Permission needed',
    });
    await fs.promises.writeFile(filePath, `${line}\n`);

    await vi.waitFor(() => {
      expect(events.length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    expect(events[0]).toEqual({
      sessionId: 'session-1',
      hookEventName: 'Notification',
      notificationType: 'permission_prompt',
      message: 'Permission needed',
    });

    await watcher.close();
  });

  it('skips existing file content during initial scan', async () => {
    const hooksDir = path.join(tmpDir, 'hooks');
    await fs.promises.mkdir(hooksDir, { recursive: true });

    const filePath = path.join(hooksDir, 'session-old.jsonl');
    const line = JSON.stringify({
      session_id: 'session-old',
      hook_event_name: 'Notification',
      notification_type: 'permission_prompt',
    });
    await fs.promises.writeFile(filePath, `${line}\n`);

    const events: HookEvent[] = [];
    const watcher = new HookWatcher(
      { onEvents: evts => events.push(...evts) },
      { hooksDir, logger: silentLogger },
    );

    await watcher.start();

    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
    expect(events).toHaveLength(0);

    await watcher.close();
  });

  it('emits events when lines are appended to an existing file', async () => {
    const hooksDir = path.join(tmpDir, 'hooks');
    await fs.promises.mkdir(hooksDir, { recursive: true });

    const filePath = path.join(hooksDir, 'session-append.jsonl');
    const existingLine = JSON.stringify({
      session_id: 'session-append',
      hook_event_name: 'SessionStart',
    });
    await fs.promises.writeFile(filePath, `${existingLine}\n`);

    const events: HookEvent[] = [];
    const watcher = new HookWatcher(
      { onEvents: evts => events.push(...evts) },
      { hooksDir, logger: silentLogger },
    );

    await watcher.start();

    const newLine = JSON.stringify({
      session_id: 'session-append',
      hook_event_name: 'Notification',
      notification_type: 'idle_prompt',
    });
    await fs.promises.appendFile(filePath, `${newLine}\n`);

    await vi.waitFor(() => {
      expect(events.length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    expect(events[0]?.hookEventName).toBe('Notification');
    expect(events[0]?.notificationType).toBe('idle_prompt');

    await watcher.close();
  });

  it('calls onError when an error occurs', async () => {
    const hooksDir = path.join(tmpDir, 'hooks');
    const errors: Error[] = [];
    const watcher = new HookWatcher(
      {
        onEvents: () => {},
        onError: err => errors.push(err),
      },
      { hooksDir, logger: silentLogger },
    );

    await watcher.start();
    await watcher.close();

    expect(errors).toHaveLength(0);
  });
});
