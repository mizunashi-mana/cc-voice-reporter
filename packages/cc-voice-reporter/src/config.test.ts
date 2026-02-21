import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ConfigSchema,
  getDefaultConfigPath,
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
        maxLength: 150,
        truncationSeparator: '...',
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

  it('rejects invalid speaker.maxLength (non-positive)', () => {
    const result = ConfigSchema.safeParse({
      speaker: { maxLength: 0 },
    });
    expect(result.success).toBe(false);
  });

  it('accepts ollama config', () => {
    const result = ConfigSchema.safeParse({
      ollama: { model: 'gemma3' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts ollama config with baseUrl', () => {
    const result = ConfigSchema.safeParse({
      ollama: { model: 'gemma3', baseUrl: 'http://localhost:9999' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects ollama config without model', () => {
    const result = ConfigSchema.safeParse({
      ollama: { baseUrl: 'http://localhost:11434' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects ollama config with invalid baseUrl', () => {
    const result = ConfigSchema.safeParse({
      ollama: { model: 'gemma3', baseUrl: 'not-a-url' },
    });
    expect(result.success).toBe(false);
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
      speaker: { maxLength: 50, truncationSeparator: '...' },
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
  it('returns config values when no CLI args', () => {
    const options = resolveOptions(
      {
        filter: { include: ['a'], exclude: ['b'] },
        projectsDir: '/custom',
        speaker: { maxLength: 50 },
      },
      {},
    );
    expect(options).toMatchObject({
      watcher: {
        projectsDir: '/custom',
        filter: { include: ['a'], exclude: ['b'] },
      },
      speaker: { maxLength: 50 },
    });
  });

  it('returns CLI args when no config', () => {
    const options = resolveOptions({}, { include: ['x'], exclude: ['y'] });
    expect(options).toMatchObject({
      watcher: {
        projectsDir: undefined,
        filter: { include: ['x'], exclude: ['y'] },
      },
      speaker: undefined,
    });
  });

  it('CLI args override config filter', () => {
    const options = resolveOptions(
      { filter: { include: ['config-a'], exclude: ['config-b'] } },
      { include: ['cli-a'] },
    );
    // include from CLI overrides config, but exclude from config is preserved
    expect(options.watcher?.filter?.include).toEqual(['cli-a']);
    expect(options.watcher?.filter?.exclude).toEqual(['config-b']);
  });

  it('CLI exclude overrides config exclude', () => {
    const options = resolveOptions(
      { filter: { exclude: ['config-b'] } },
      { exclude: ['cli-b'] },
    );
    expect(options.watcher?.filter?.exclude).toEqual(['cli-b']);
  });

  it('returns defaults when both config and CLI are empty', () => {
    const options = resolveOptions({}, {});
    expect(options).toMatchObject({
      watcher: {
        projectsDir: undefined,
        filter: {},
      },
      speaker: undefined,
    });
  });

  it('preserves speaker from config', () => {
    const options = resolveOptions(
      {
        speaker: { maxLength: 200, truncationSeparator: '...' },
      },
      {},
    );
    expect(options.speaker).toEqual({
      maxLength: 200,
      truncationSeparator: '...',
    });
  });

  it('resolves summary when ollama and summary are configured', () => {
    const options = resolveOptions(
      {
        ollama: { model: 'gemma3', baseUrl: 'http://localhost:9999' },
        summary: { intervalMs: 30000 },
      },
      {},
    );
    expect(options.summary).toEqual({
      ollama: { model: 'gemma3', baseUrl: 'http://localhost:9999' },
      intervalMs: 30000,
      language: 'ja',
    });
  });

  it('passes top-level language to summary', () => {
    const options = resolveOptions(
      {
        language: 'en',
        ollama: { model: 'gemma3' },
        summary: {},
      },
      {},
    );
    expect(options.summary?.language).toBe('en');
  });

  it('throws when summary is configured but ollama is missing', () => {
    expect(() =>
      resolveOptions(
        { summary: {} },
        {},
      ),
    ).toThrow('summary feature requires ollama configuration');
  });

  it('does not resolve summary when summary config is missing', () => {
    const options = resolveOptions(
      { ollama: { model: 'gemma3' } },
      {},
    );
    expect(options.summary).toBeUndefined();
  });
});
