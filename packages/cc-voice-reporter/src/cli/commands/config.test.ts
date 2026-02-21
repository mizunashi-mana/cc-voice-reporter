import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runConfigCommand } from './config.js';
import { CliError } from './output.js';

describe('runConfigCommand', () => {
  let tmpDir: string;
  const originalEnv = process.env.XDG_CONFIG_HOME;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'cc-voice-reporter-cli-config-test-'),
    );
    process.env.XDG_CONFIG_HOME = tmpDir;
  });

  afterEach(async () => {
    if (originalEnv === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    }
    else {
      process.env.XDG_CONFIG_HOME = originalEnv;
    }
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  describe('config path', () => {
    it('outputs the config file path', async () => {
      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      try {
        await runConfigCommand(['path']);
        expect(writeSpy).toHaveBeenCalledWith(
          expect.stringContaining('cc-voice-reporter/config.json'),
        );
      }
      finally {
        writeSpy.mockRestore();
      }
    });
  });

  describe('config init', () => {
    it('creates a config file template', async () => {
      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      try {
        await runConfigCommand(['init']);
        const configPath = path.join(
          tmpDir,
          'cc-voice-reporter',
          'config.json',
        );
        const content = await fs.promises.readFile(configPath, 'utf-8');
        const parsed: unknown = JSON.parse(content);
        expect(parsed).toMatchObject({
          logLevel: 'info',
          language: 'ja',
        });
      }
      finally {
        writeSpy.mockRestore();
      }
    });

    it('throws CliError when config file already exists', async () => {
      const configDir = path.join(tmpDir, 'cc-voice-reporter');
      await fs.promises.mkdir(configDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(configDir, 'config.json'),
        '{}',
      );
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
      try {
        await expect(runConfigCommand(['init'])).rejects.toThrow(CliError);
      }
      finally {
        stderrSpy.mockRestore();
      }
    });

    it('overwrites with --force', async () => {
      const configDir = path.join(tmpDir, 'cc-voice-reporter');
      await fs.promises.mkdir(configDir, { recursive: true });
      const configPath = path.join(configDir, 'config.json');
      await fs.promises.writeFile(configPath, '{"old": true}');

      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      try {
        await runConfigCommand(['init', '--force']);
        const content = await fs.promises.readFile(configPath, 'utf-8');
        const parsed: unknown = JSON.parse(content);
        expect(parsed).toMatchObject({
          logLevel: 'info',
        });
      }
      finally {
        writeSpy.mockRestore();
      }
    });
  });

  describe('unknown subcommand', () => {
    it('throws CliError for unknown subcommand', async () => {
      await expect(runConfigCommand(['unknown'])).rejects.toThrow(CliError);
    });
  });
});
