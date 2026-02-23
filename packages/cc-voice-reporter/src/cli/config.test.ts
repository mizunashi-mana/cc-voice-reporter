import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ConfigSchema,
  getDefaultConfigPath,
  getDefaultStateDir,
  getHooksDir,
  loadConfig,
  resolveOptions,
} from './config.js';

describe('ConfigSchema', () => {
  it('accepts an empty object', () => {
    const result = ConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts a full config', () => {
    const result = ConfigSchema.safeParse({
      filter: {
        include: ['project-a'],
        exclude: ['/absolute/path'],
      },
      projectsDir: '/custom/projects',
      speaker: {
        command: ['say', '-v', 'Kyoko'],
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts speaker.command', () => {
    const result = ConfigSchema.safeParse({
      speaker: { command: ['espeak'] },
    });
    expect(result.success).toBe(true);
    expect(result.data?.speaker?.command).toEqual(['espeak']);
  });

  it('rejects empty speaker.command', () => {
    const result = ConfigSchema.safeParse({
      speaker: { command: [] },
    });
    expect(result.success).toBe(false);
  });

  it('rejects speaker.command with empty string element', () => {
    const result = ConfigSchema.safeParse({
      speaker: { command: [''] },
    });
    expect(result.success).toBe(false);
  });

  it('accepts a partial config', () => {
    const result = ConfigSchema.safeParse({
      projectsDir: '/custom',
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ projectsDir: '/custom' });
  });

  it('rejects unknown keys', () => {
    const result = ConfigSchema.safeParse({
      unknownKey: 'value',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown speaker keys', () => {
    const result = ConfigSchema.safeParse({
      speaker: { maxLength: 200 },
    });
    expect(result.success).toBe(false);
  });

  it('accepts ollama config with model', () => {
    const result = ConfigSchema.safeParse({
      ollama: { model: 'gemma3' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts ollama config without model (auto-detect)', () => {
    const result = ConfigSchema.safeParse({
      ollama: {},
    });
    expect(result.success).toBe(true);
  });

  it('accepts ollama config with baseUrl', () => {
    const result = ConfigSchema.safeParse({
      ollama: { model: 'gemma3', baseUrl: 'http://localhost:9999' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects ollama config with invalid baseUrl', () => {
    const result = ConfigSchema.safeParse({
      ollama: { model: 'gemma3', baseUrl: 'not-a-url' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts stateDir config', () => {
    const result = ConfigSchema.safeParse({ stateDir: '/custom/state' });
    expect(result.success).toBe(true);
    expect(result.data?.stateDir).toBe('/custom/state');
  });

  it('accepts language config', () => {
    const result = ConfigSchema.safeParse({ language: 'en' });
    expect(result.success).toBe(true);
  });

  it('accepts summary config', () => {
    const result = ConfigSchema.safeParse({
      summary: { intervalMs: 30000 },
    });
    expect(result.success).toBe(true);
  });

  it('accepts summary config with only empty object', () => {
    const result = ConfigSchema.safeParse({
      summary: {},
    });
    expect(result.success).toBe(true);
  });

  it('rejects summary with invalid intervalMs', () => {
    const result = ConfigSchema.safeParse({
      summary: { intervalMs: -1 },
    });
    expect(result.success).toBe(false);
  });
});

describe('getDefaultConfigPath', () => {
  const originalEnv = process.env.XDG_CONFIG_HOME;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    }
    else {
      process.env.XDG_CONFIG_HOME = originalEnv;
    }
  });

  it('uses XDG_CONFIG_HOME when set', () => {
    process.env.XDG_CONFIG_HOME = '/custom/config';
    expect(getDefaultConfigPath()).toBe(
      '/custom/config/cc-voice-reporter/config.json',
    );
  });

  it('falls back to ~/.config when XDG_CONFIG_HOME is not set', () => {
    delete process.env.XDG_CONFIG_HOME;
    const expected = path.join(
      os.homedir(),
      '.config',
      'cc-voice-reporter',
      'config.json',
    );
    expect(getDefaultConfigPath()).toBe(expected);
  });
});

describe('getDefaultStateDir', () => {
  const originalEnv = process.env.XDG_STATE_HOME;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.XDG_STATE_HOME;
    }
    else {
      process.env.XDG_STATE_HOME = originalEnv;
    }
  });

  it('uses XDG_STATE_HOME when set', () => {
    process.env.XDG_STATE_HOME = '/custom/state';
    expect(getDefaultStateDir()).toBe('/custom/state/cc-voice-reporter');
  });

  it('falls back to ~/.local/state when XDG_STATE_HOME is not set', () => {
    delete process.env.XDG_STATE_HOME;
    const expected = path.join(
      os.homedir(),
      '.local',
      'state',
      'cc-voice-reporter',
    );
    expect(getDefaultStateDir()).toBe(expected);
  });
});

describe('getHooksDir', () => {
  const originalEnv = process.env.XDG_STATE_HOME;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.XDG_STATE_HOME;
    }
    else {
      process.env.XDG_STATE_HOME = originalEnv;
    }
  });

  it('uses stateDir when provided', () => {
    expect(getHooksDir('/custom/state')).toBe('/custom/state/hooks');
  });

  it('falls back to XDG default when stateDir is not provided', () => {
    process.env.XDG_STATE_HOME = '/xdg/state';
    expect(getHooksDir()).toBe('/xdg/state/cc-voice-reporter/hooks');
  });
});

describe('loadConfig', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'cc-voice-reporter-config-test-'),
    );
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns empty config when default path does not exist', async () => {
    // loadConfig with no arg uses getDefaultConfigPath().
    // Override XDG to point to a non-existent dir.
    const originalEnv = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = path.join(tmpDir, 'nonexistent');
    try {
      const config = await loadConfig();
      expect(config).toEqual({});
    }
    finally {
      if (originalEnv === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      }
      else {
        process.env.XDG_CONFIG_HOME = originalEnv;
      }
    }
  });

  it('throws when --config path does not exist', async () => {
    const missingPath = path.join(tmpDir, 'missing.json');
    await expect(loadConfig(missingPath)).rejects.toThrow(
      'Config file not found',
    );
  });

  it('loads a valid config file', async () => {
    const configPath = path.join(tmpDir, 'config.json');
    await fs.promises.writeFile(
      configPath,
      JSON.stringify({ projectsDir: '/custom' }),
    );
    const config = await loadConfig(configPath);
    expect(config).toEqual({ projectsDir: '/custom' });
  });

  it('loads a full config file', async () => {
    const configPath = path.join(tmpDir, 'config.json');
    const fullConfig = {
      filter: { include: ['a'], exclude: ['b'] },
      projectsDir: '/custom',
      speaker: { command: ['say'] },
    };
    await fs.promises.writeFile(configPath, JSON.stringify(fullConfig));
    const config = await loadConfig(configPath);
    expect(config).toEqual(fullConfig);
  });

  it('throws on invalid JSON', async () => {
    const configPath = path.join(tmpDir, 'config.json');
    await fs.promises.writeFile(configPath, 'not json {{{');
    await expect(loadConfig(configPath)).rejects.toThrow('Invalid JSON');
  });

  it('throws on schema validation error', async () => {
    const configPath = path.join(tmpDir, 'config.json');
    await fs.promises.writeFile(
      configPath,
      JSON.stringify({ unknownKey: true }),
    );
    await expect(loadConfig(configPath)).rejects.toThrow('Invalid config file');
  });

  it('throws on invalid field type', async () => {
    const configPath = path.join(tmpDir, 'config.json');
    await fs.promises.writeFile(
      configPath,
      JSON.stringify({ projectsDir: 123 }),
    );
    await expect(loadConfig(configPath)).rejects.toThrow('Invalid config file');
  });
});

describe('resolveOptions', () => {
  const defaults = { ollamaModel: 'gemma3', speakerCommand: ['say'], language: 'en' };

  it('returns config values when no CLI args', () => {
    const options = resolveOptions(
      {
        filter: { include: ['a'], exclude: ['b'] },
        projectsDir: '/custom',
      },
      {},
      { ...defaults, speakerCommand: ['espeak'] },
    );
    expect(options).toMatchObject({
      watcher: {
        projectsDir: '/custom',
        filter: { include: ['a'], exclude: ['b'] },
      },
      speaker: { command: ['espeak'] },
    });
  });

  it('returns CLI args when no config', () => {
    const options = resolveOptions({}, { include: ['x'], exclude: ['y'] }, defaults);
    expect(options).toMatchObject({
      watcher: {
        projectsDir: undefined,
        filter: { include: ['x'], exclude: ['y'] },
      },
      speaker: { command: ['say'] },
    });
  });

  it('CLI args override config filter', () => {
    const options = resolveOptions(
      { filter: { include: ['config-a'], exclude: ['config-b'] } },
      { include: ['cli-a'] },
      defaults,
    );
    // include from CLI overrides config, but exclude from config is preserved
    expect(options.watcher?.filter?.include).toEqual(['cli-a']);
    expect(options.watcher?.filter?.exclude).toEqual(['config-b']);
  });

  it('CLI exclude overrides config exclude', () => {
    const options = resolveOptions(
      { filter: { exclude: ['config-b'] } },
      { exclude: ['cli-b'] },
      defaults,
    );
    expect(options.watcher?.filter?.exclude).toEqual(['cli-b']);
  });

  it('returns defaults when both config and CLI are empty', () => {
    const options = resolveOptions({}, {}, defaults);
    expect(options).toMatchObject({
      watcher: {
        projectsDir: undefined,
        filter: {},
      },
      speaker: { command: ['say'] },
    });
  });

  it('uses speakerCommand from resolved deps', () => {
    const options = resolveOptions(
      {},
      {},
      { ...defaults, speakerCommand: ['say', '-v', 'Kyoko'] },
    );
    expect(options.speaker).toEqual({
      command: ['say', '-v', 'Kyoko'],
    });
  });

  it('always includes summary with resolved model', () => {
    const options = resolveOptions({}, {}, defaults);
    expect(options.summary).toEqual({
      ollama: { model: 'gemma3', baseUrl: 'http://localhost:11434', timeoutMs: undefined },
      intervalMs: undefined,
      maxPromptEvents: 10,
      language: 'en',
    });
  });

  it('uses ollama config for baseUrl and timeoutMs', () => {
    const options = resolveOptions(
      {
        ollama: { baseUrl: 'http://localhost:9999', timeoutMs: 30000 },
      },
      {},
      defaults,
    );
    expect(options.summary).toEqual({
      ollama: { model: 'gemma3', baseUrl: 'http://localhost:9999', timeoutMs: 30000 },
      intervalMs: undefined,
      maxPromptEvents: 10,
      language: 'en',
    });
  });

  it('uses summary config for intervalMs', () => {
    const options = resolveOptions(
      { summary: { intervalMs: 10000 } },
      {},
      defaults,
    );
    expect(options.summary?.intervalMs).toBe(10000);
  });

  it('uses the language from resolved deps', () => {
    const options = resolveOptions({}, {}, { ...defaults, language: 'ja' });
    expect(options.language).toBe('ja');
    expect(options.summary?.language).toBe('ja');
  });
});
