import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runHookReceiverCommand, type HookReceiverDeps } from './hook-receiver.js';
import { CliError } from './output.js';

// vi import needed for spy

describe('runHookReceiverCommand', () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'cc-voice-reporter-hook-receiver-test-'),
    );
    const stateDir = path.join(tmpDir, 'state');
    configPath = path.join(tmpDir, 'config.json');
    await fs.promises.writeFile(
      configPath,
      JSON.stringify({ stateDir }),
    );
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  function makeDeps(input: string): HookReceiverDeps {
    return {
      readInput: async () => input,
    };
  }

  it('writes hook event to session-specific JSONL file', async () => {
    const hookEvent = {
      session_id: 'test-session-123',
      hook_event_name: 'Notification',
      notification_type: 'permission_prompt',
      message: 'Permission needed',
    };

    await runHookReceiverCommand(
      ['--config', configPath],
      makeDeps(JSON.stringify(hookEvent)),
    );

    const hooksDir = path.join(tmpDir, 'state', 'hooks');
    const filePath = path.join(hooksDir, 'test-session-123.jsonl');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toEqual(hookEvent);
  });

  it('appends to existing file', async () => {
    const stateDir = path.join(tmpDir, 'state');
    const hooksDir = path.join(stateDir, 'hooks');
    await fs.promises.mkdir(hooksDir, { recursive: true });

    const filePath = path.join(hooksDir, 'session-append.jsonl');
    const existing = JSON.stringify({
      session_id: 'session-append',
      hook_event_name: 'SessionStart',
    });
    await fs.promises.writeFile(filePath, `${existing}\n`);

    const newEvent = {
      session_id: 'session-append',
      hook_event_name: 'Notification',
      notification_type: 'permission_prompt',
    };

    await runHookReceiverCommand(
      ['--config', configPath],
      makeDeps(JSON.stringify(newEvent)),
    );

    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[1]!)).toEqual(newEvent);
  });

  it('throws CliError on empty stdin', async () => {
    await expect(
      runHookReceiverCommand(['--config', configPath], makeDeps('')),
    ).rejects.toThrow(CliError);
  });

  it('throws CliError on invalid JSON', async () => {
    await expect(
      runHookReceiverCommand(['--config', configPath], makeDeps('not json')),
    ).rejects.toThrow(CliError);
  });

  it('throws CliError when session_id is missing', async () => {
    const input = JSON.stringify({ hook_event_name: 'Notification' });
    await expect(
      runHookReceiverCommand(['--config', configPath], makeDeps(input)),
    ).rejects.toThrow(CliError);
  });

  it('throws CliError when session_id contains path separators', async () => {
    const input = JSON.stringify({
      session_id: '../../etc/passwd',
      hook_event_name: 'Notification',
    });
    await expect(
      runHookReceiverCommand(['--config', configPath], makeDeps(input)),
    ).rejects.toThrow(CliError);
  });

  it('shows help with --help flag', async () => {
    const writeSpy = vi.fn();
    const originalWrite = process.stdout.write;
    process.stdout.write = writeSpy as typeof process.stdout.write;

    try {
      await runHookReceiverCommand(['--help'], makeDeps(''));
    }
    finally {
      process.stdout.write = originalWrite;
    }

    const output = writeSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('');
    expect(output).toContain('hook-receiver');
  });
});
