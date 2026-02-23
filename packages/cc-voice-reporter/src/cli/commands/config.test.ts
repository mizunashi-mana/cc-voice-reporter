import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runConfigCommand } from './config.js';
import { CliError } from './output.js';
import type { ConfigInitDeps } from './config.js';

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

  describe('config init --non-interactive', () => {
    it('creates a config file template and registers hooks', async () => {
      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      const hooksRegistered = vi.fn(async () => ({
        modified: true,
        registered: ['SessionStart', 'Notification'],
        skipped: [],
      }));
      const deps: ConfigInitDeps = {
        createWizardIO: vi.fn() as ConfigInitDeps['createWizardIO'],
        executeWizard: vi.fn() as ConfigInitDeps['executeWizard'],
        detectHookCommand: () => 'cc-voice-reporter hook-receiver',
        executeHooksRegistration: hooksRegistered,
        getSettingsPath: () => path.join(tmpDir, 'claude', 'settings.json'),
      };
      try {
        await runConfigCommand(['init', '--non-interactive'], deps);
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
        expect(hooksRegistered).toHaveBeenCalledWith(
          'cc-voice-reporter hook-receiver',
          path.join(tmpDir, 'claude', 'settings.json'),
        );
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
        await expect(
          runConfigCommand(['init', '--non-interactive']),
        ).rejects.toThrow(CliError);
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
      const deps: ConfigInitDeps = {
        createWizardIO: vi.fn() as ConfigInitDeps['createWizardIO'],
        executeWizard: vi.fn() as ConfigInitDeps['executeWizard'],
        detectHookCommand: () => 'cc-voice-reporter hook-receiver',
        executeHooksRegistration: vi.fn(async () => ({
          modified: false,
          registered: [],
          skipped: ['SessionStart', 'Notification'],
        })),
        getSettingsPath: () => path.join(tmpDir, 'claude', 'settings.json'),
      };
      try {
        await runConfigCommand(['init', '--non-interactive', '--force'], deps);
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

    it('shows warning when hooks registration fails', async () => {
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
      const deps: ConfigInitDeps = {
        createWizardIO: vi.fn() as ConfigInitDeps['createWizardIO'],
        executeWizard: vi.fn() as ConfigInitDeps['executeWizard'],
        detectHookCommand: () => 'cc-voice-reporter hook-receiver',
        executeHooksRegistration: vi.fn(async () => {
          throw new Error('Permission denied');
        }),
        getSettingsPath: () => path.join(tmpDir, 'claude', 'settings.json'),
      };
      try {
        await runConfigCommand(['init', '--non-interactive'], deps);
        expect(stderrSpy).toHaveBeenCalledWith(
          expect.stringContaining('Warning: Failed to register hooks'),
        );
      }
      finally {
        stdoutSpy.mockRestore();
        stderrSpy.mockRestore();
      }
    });
  });

  describe('config init (interactive)', () => {
    function createMockDeps(
      overrides: {
        confirmed?: boolean;
        registerHooks?: boolean;
        config?: Record<string, unknown>;
        hooksResult?: { modified: boolean; registered: string[]; skipped: string[] };
      } = {},
    ): ConfigInitDeps {
      const {
        confirmed = true,
        registerHooks = true,
        config = { language: 'en', speaker: { command: ['say'] } },
        hooksResult = { modified: true, registered: ['SessionStart', 'Notification'], skipped: [] },
      } = overrides;
      const mockIO = {
        question: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      };
      return {
        createWizardIO: () => mockIO,
        executeWizard: vi.fn(async () => ({ config, confirmed, registerHooks })),
        detectHookCommand: () => 'cc-voice-reporter hook-receiver',
        executeHooksRegistration: vi.fn(async () => hooksResult),
        getSettingsPath: () => path.join(tmpDir, 'claude', 'settings.json'),
      };
    }

    it('writes config file and registers hooks when wizard confirms', async () => {
      const deps = createMockDeps();
      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      try {
        await runConfigCommand(['init'], deps);
        const configPath = path.join(
          tmpDir,
          'cc-voice-reporter',
          'config.json',
        );
        const content = await fs.promises.readFile(configPath, 'utf-8');
        const parsed: unknown = JSON.parse(content);
        expect(parsed).toMatchObject({ language: 'en' });
        expect(deps.executeHooksRegistration).toHaveBeenCalledWith(
          'cc-voice-reporter hook-receiver',
          path.join(tmpDir, 'claude', 'settings.json'),
        );
      }
      finally {
        writeSpy.mockRestore();
      }
    });

    it('does not register hooks when wizard declines hooks', async () => {
      const deps = createMockDeps({ registerHooks: false });
      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      try {
        await runConfigCommand(['init'], deps);
        expect(deps.executeHooksRegistration).not.toHaveBeenCalled();
      }
      finally {
        writeSpy.mockRestore();
      }
    });

    it('does not write config when wizard is cancelled', async () => {
      const deps = createMockDeps({ confirmed: false });
      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      try {
        await runConfigCommand(['init'], deps);
        const configPath = path.join(
          tmpDir,
          'cc-voice-reporter',
          'config.json',
        );
        await expect(
          fs.promises.access(configPath),
        ).rejects.toThrow();
        expect(writeSpy).toHaveBeenCalledWith('Aborted.\n');
        expect(deps.executeHooksRegistration).not.toHaveBeenCalled();
      }
      finally {
        writeSpy.mockRestore();
      }
    });

    it('closes IO even when wizard throws', async () => {
      const mockIO = {
        question: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      };
      const deps: ConfigInitDeps = {
        createWizardIO: () => mockIO,
        executeWizard: vi.fn(async () => {
          throw new Error('wizard error');
        }),
        detectHookCommand: () => 'cc-voice-reporter hook-receiver',
        executeHooksRegistration: vi.fn(),
        getSettingsPath: () => path.join(tmpDir, 'claude', 'settings.json'),
      };
      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      try {
        await expect(runConfigCommand(['init'], deps)).rejects.toThrow('wizard error');
        expect(mockIO.close).toHaveBeenCalled();
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
