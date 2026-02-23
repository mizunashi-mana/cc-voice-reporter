import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const CLI_PATH = new URL('./cli.ts', import.meta.url).pathname;

async function runCli(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('npx', ['tsx', CLI_PATH, ...args], {
    cwd: new URL('../..', import.meta.url).pathname,
  });
}

describe('CLI', () => {
  describe('--version', () => {
    it('outputs the version from package.json', async () => {
      const { stdout } = await runCli(['--version']);
      expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('--help', () => {
    it('outputs usage information', async () => {
      const { stdout } = await runCli(['--help']);
      expect(stdout).toContain('Usage: cc-voice-reporter');
      expect(stdout).toContain('Commands:');
      expect(stdout).toContain('monitor');
      expect(stdout).toContain('config');
      expect(stdout).toContain('tracking');
      expect(stdout).toContain('hook-receiver');
      expect(stdout).toContain('--version');
    });
  });

  describe('-h', () => {
    it('outputs usage information same as --help', async () => {
      const { stdout } = await runCli(['-h']);
      expect(stdout).toContain('Usage: cc-voice-reporter');
    });
  });

  describe('no arguments', () => {
    it('outputs usage information', async () => {
      const { stdout } = await runCli([]);
      expect(stdout).toContain('Usage: cc-voice-reporter');
    });
  });

  describe('unknown command', () => {
    it('exits with error', async () => {
      await expect(runCli(['nonexistent'])).rejects.toThrow();
    });
  });
});
