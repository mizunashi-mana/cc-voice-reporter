import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  detectHookReceiverCommand,
  mergeHooks,
  readClaudeCodeSettings,
  registerHooks,
  writeClaudeCodeSettings,
} from './claude-code-settings.js';

describe('detectHookReceiverCommand', () => {
  it('returns cc-voice-reporter when not running via npx', () => {
    const result = detectHookReceiverCommand({});
    expect(result).toBe('cc-voice-reporter hook-receiver');
  });

  it('returns npx command when npm_command is exec', () => {
    const result = detectHookReceiverCommand({ npm_command: 'exec' });
    expect(result).toBe('npx -y @mizunashi_mana/cc-voice-reporter hook-receiver');
  });

  it('returns cc-voice-reporter when npm_command is not exec', () => {
    const result = detectHookReceiverCommand({ npm_command: 'run' });
    expect(result).toBe('cc-voice-reporter hook-receiver');
  });
});

describe('mergeHooks', () => {
  const command = 'cc-voice-reporter hook-receiver';

  it('adds hooks to empty settings', () => {
    const { settings, result } = mergeHooks({}, command);

    expect(result.modified).toBe(true);
    expect(result.registered).toEqual(['SessionStart', 'Notification']);
    expect(result.skipped).toEqual([]);
    expect(settings.hooks).toEqual({
      SessionStart: [{
        hooks: [{ type: 'command', command }],
      }],
      Notification: [{
        matcher: 'permission_prompt',
        hooks: [{ type: 'command', command }],
      }],
    });
  });

  it('adds hooks to settings with existing unrelated hooks', () => {
    const existing = {
      hooks: {
        PostToolUse: [{
          matcher: 'Edit',
          hooks: [{ type: 'command', command: 'lint-hook' }],
        }],
      },
    };

    const { settings, result } = mergeHooks(existing, command);

    expect(result.modified).toBe(true);
    expect(result.registered).toEqual(['SessionStart', 'Notification']);
    // Existing hooks preserved
    expect(settings.hooks?.PostToolUse).toEqual(existing.hooks.PostToolUse);
  });

  it('skips already registered hooks (exact command)', () => {
    const existing = {
      hooks: {
        SessionStart: [{
          hooks: [{ type: 'command', command }],
        }],
        Notification: [{
          matcher: 'permission_prompt',
          hooks: [{ type: 'command', command }],
        }],
      },
    };

    const { result } = mergeHooks(existing, command);

    expect(result.modified).toBe(false);
    expect(result.registered).toEqual([]);
    expect(result.skipped).toEqual(['SessionStart', 'Notification']);
  });

  it('skips hooks when npx variant is already registered', () => {
    const npxCommand = 'npx -y @mizunashi_mana/cc-voice-reporter hook-receiver';
    const existing = {
      hooks: {
        SessionStart: [{
          hooks: [{ type: 'command', command: npxCommand }],
        }],
      },
    };

    // Registering the non-npx variant should still detect the existing one
    const { result } = mergeHooks(existing, command);

    expect(result.skipped).toContain('SessionStart');
  });

  it('partially registers when one hook already exists', () => {
    const existing = {
      hooks: {
        Notification: [{
          matcher: 'permission_prompt',
          hooks: [{ type: 'command', command }],
        }],
      },
    };

    const { settings, result } = mergeHooks(existing, command);

    expect(result.modified).toBe(true);
    expect(result.registered).toEqual(['SessionStart']);
    expect(result.skipped).toEqual(['Notification']);
    expect(settings.hooks?.SessionStart).toBeDefined();
  });

  it('appends to existing event rules without replacing them', () => {
    const existing = {
      hooks: {
        SessionStart: [{
          matcher: 'startup',
          hooks: [{ type: 'command', command: 'other-tool' }],
        }],
      },
    };

    const { settings } = mergeHooks(existing, command);

    // Should have both the existing rule and the new one
    expect(settings.hooks?.SessionStart).toHaveLength(2);
    expect(settings.hooks?.SessionStart?.[0]).toEqual(existing.hooks.SessionStart[0]);
  });

  it('preserves non-hooks settings', () => {
    const existing = {
      permissions: { allow: ['Bash(npm run build:*)'] },
      hooks: {},
    };

    const { settings } = mergeHooks(existing, command);

    expect(settings.permissions).toEqual(existing.permissions);
  });

  it('does not mutate the input', () => {
    const existing = { hooks: {} };
    const original = JSON.stringify(existing);

    mergeHooks(existing, command);

    expect(JSON.stringify(existing)).toBe(original);
  });
});

describe('readClaudeCodeSettings / writeClaudeCodeSettings', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'cc-voice-reporter-claude-settings-test-'),
    );
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns empty object when file does not exist', async () => {
    const result = await readClaudeCodeSettings(
      path.join(tmpDir, 'nonexistent.json'),
    );
    expect(result).toEqual({});
  });

  it('throws descriptive error for corrupted JSON', async () => {
    const filePath = path.join(tmpDir, 'settings.json');
    await fs.promises.writeFile(filePath, '{ invalid json }');

    await expect(readClaudeCodeSettings(filePath)).rejects.toThrow(
      /Failed to parse Claude Code settings/,
    );
  });

  it('reads existing settings', async () => {
    const filePath = path.join(tmpDir, 'settings.json');
    await fs.promises.writeFile(
      filePath,
      JSON.stringify({ permissions: { allow: [] } }),
    );

    const result = await readClaudeCodeSettings(filePath);
    expect(result).toEqual({ permissions: { allow: [] } });
  });

  it('writes settings and creates directories', async () => {
    const filePath = path.join(tmpDir, 'sub', 'dir', 'settings.json');

    await writeClaudeCodeSettings({ hooks: {} }, filePath);

    const content = await fs.promises.readFile(filePath, 'utf-8');
    expect(JSON.parse(content)).toEqual({ hooks: {} });
  });
});

describe('registerHooks', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'cc-voice-reporter-register-hooks-test-'),
    );
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates settings file when it does not exist', async () => {
    const filePath = path.join(tmpDir, 'settings.json');
    const command = 'cc-voice-reporter hook-receiver';

    const result = await registerHooks(command, filePath);

    expect(result.modified).toBe(true);
    expect(result.registered).toEqual(['SessionStart', 'Notification']);

    const content = await fs.promises.readFile(filePath, 'utf-8');
    const settings = JSON.parse(content) as Record<string, unknown>;
    expect(settings.hooks).toBeDefined();
  });

  it('merges into existing settings preserving other fields', async () => {
    const filePath = path.join(tmpDir, 'settings.json');
    await fs.promises.writeFile(filePath, JSON.stringify({
      permissions: { allow: ['Bash(npm run build:*)'] },
      hooks: {
        PostToolUse: [{
          matcher: 'Edit',
          hooks: [{ type: 'command', command: 'lint-hook' }],
        }],
      },
    }));

    const command = 'cc-voice-reporter hook-receiver';
    const result = await registerHooks(command, filePath);

    expect(result.modified).toBe(true);

    const content = await fs.promises.readFile(filePath, 'utf-8');
    const settings = JSON.parse(content) as Record<string, Record<string, unknown>>;
    expect(settings.permissions).toEqual({ allow: ['Bash(npm run build:*)'] });
    expect(settings.hooks?.PostToolUse).toBeDefined();
    expect(settings.hooks?.SessionStart).toBeDefined();
    expect(settings.hooks?.Notification).toBeDefined();
  });

  it('does not write when hooks are already registered', async () => {
    const filePath = path.join(tmpDir, 'settings.json');
    const command = 'cc-voice-reporter hook-receiver';

    // First registration
    await registerHooks(command, filePath);
    const stat1 = await fs.promises.stat(filePath);

    // Wait a tick to ensure mtime would change if file is rewritten
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });

    // Second registration
    const result = await registerHooks(command, filePath);

    expect(result.modified).toBe(false);
    const stat2 = await fs.promises.stat(filePath);
    expect(stat2.mtimeMs).toBe(stat1.mtimeMs);
  });
});
