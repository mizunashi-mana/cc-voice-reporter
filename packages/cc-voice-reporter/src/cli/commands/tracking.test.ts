import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CliError } from './output.js';
import { runTrackingCommand } from './tracking.js';

describe('runTrackingCommand', () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'cc-voice-reporter-cli-tracking-test-'),
    );
    configPath = path.join(tmpDir, 'config.json');
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  describe('tracking add', () => {
    it('adds a project path to include filter', async () => {
      await fs.promises.writeFile(configPath, '{}');
      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      try {
        await runTrackingCommand(['add', '/my/project', '--config', configPath]);
        const content = await fs.promises.readFile(configPath, 'utf-8');
        const parsed = JSON.parse(content) as { filter: { include: string[] } };
        expect(parsed.filter.include).toContain('/my/project');
      }
      finally {
        writeSpy.mockRestore();
      }
    });

    it('does not duplicate an already tracked path', async () => {
      await fs.promises.writeFile(
        configPath,
        JSON.stringify({ filter: { include: ['/my/project'] } }),
      );
      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      try {
        await runTrackingCommand(['add', '/my/project', '--config', configPath]);
        expect(writeSpy).toHaveBeenCalledWith(
          expect.stringContaining('Already tracked'),
        );
      }
      finally {
        writeSpy.mockRestore();
      }
    });

    it('creates config file if it does not exist', async () => {
      const newConfigPath = path.join(tmpDir, 'sub', 'config.json');
      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      try {
        await runTrackingCommand([
          'add',
          '/my/project',
          '--config',
          newConfigPath,
        ]);
        const content = await fs.promises.readFile(newConfigPath, 'utf-8');
        const parsed = JSON.parse(content) as { filter: { include: string[] } };
        expect(parsed.filter.include).toContain('/my/project');
      }
      finally {
        writeSpy.mockRestore();
      }
    });

    it('resolves relative path to absolute path', async () => {
      await fs.promises.writeFile(configPath, '{}');
      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      try {
        await runTrackingCommand(['add', './my-project', '--config', configPath]);
        const content = await fs.promises.readFile(configPath, 'utf-8');
        const parsed = JSON.parse(content) as { filter: { include: string[] } };
        expect(parsed.filter.include).toHaveLength(1);
        expect(path.isAbsolute(parsed.filter.include[0]!)).toBe(true);
        expect(parsed.filter.include[0]).toBe(path.resolve('./my-project'));
      }
      finally {
        writeSpy.mockRestore();
      }
    });

    it('throws CliError for invalid JSON config file', async () => {
      await fs.promises.writeFile(configPath, '{invalid json}');
      await expect(
        runTrackingCommand(['add', '/my/project', '--config', configPath]),
      ).rejects.toThrow(CliError);
    });

    it('throws CliError when path is missing', async () => {
      await expect(
        runTrackingCommand(['add', '--config', configPath]),
      ).rejects.toThrow(CliError);
    });
  });

  describe('tracking remove', () => {
    it('removes a tracked project path', async () => {
      await fs.promises.writeFile(
        configPath,
        JSON.stringify({ filter: { include: ['/my/project', '/other'] } }),
      );
      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      try {
        await runTrackingCommand([
          'remove',
          '/my/project',
          '--config',
          configPath,
        ]);
        const content = await fs.promises.readFile(configPath, 'utf-8');
        const parsed = JSON.parse(content) as { filter: { include: string[] } };
        expect(parsed.filter.include).toEqual(['/other']);
      }
      finally {
        writeSpy.mockRestore();
      }
    });

    it('throws CliError when path is not tracked', async () => {
      await fs.promises.writeFile(configPath, '{}');
      await expect(
        runTrackingCommand([
          'remove',
          '/not-tracked',
          '--config',
          configPath,
        ]),
      ).rejects.toThrow(CliError);
    });

    it('throws CliError when path argument is missing', async () => {
      await expect(
        runTrackingCommand(['remove', '--config', configPath]),
      ).rejects.toThrow(CliError);
    });
  });

  describe('tracking list', () => {
    it('shows include and exclude filters', async () => {
      await fs.promises.writeFile(
        configPath,
        JSON.stringify({
          filter: { include: ['/proj-a'], exclude: ['/proj-b'] },
        }),
      );
      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      try {
        await runTrackingCommand(['list', '--config', configPath]);
        const output = writeSpy.mock.calls.map(c => c[0]).join('');
        expect(output).toContain('Include:');
        expect(output).toContain('/proj-a');
        expect(output).toContain('Exclude:');
        expect(output).toContain('/proj-b');
      }
      finally {
        writeSpy.mockRestore();
      }
    });

    it('shows message when no filters configured', async () => {
      await fs.promises.writeFile(configPath, '{}');
      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      try {
        await runTrackingCommand(['list', '--config', configPath]);
        const output = writeSpy.mock.calls.map(c => c[0]).join('');
        expect(output).toContain('All projects are tracked');
      }
      finally {
        writeSpy.mockRestore();
      }
    });
  });

  describe('unknown subcommand', () => {
    it('throws CliError for unknown subcommand', async () => {
      await expect(runTrackingCommand(['unknown'])).rejects.toThrow(CliError);
    });
  });
});
