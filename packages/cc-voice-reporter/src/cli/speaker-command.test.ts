import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectSpeakerCommand, resolveSpeakerCommand } from './speaker-command.js';

describe('detectSpeakerCommand', () => {
  const originalPath = process.env.PATH;

  afterEach(() => {
    process.env.PATH = originalPath;
  });

  it('returns ["say"] when say is available', async () => {
    const tmpDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'tts-test-'),
    );
    try {
      const sayPath = path.join(tmpDir, 'say');
      await fs.promises.writeFile(sayPath, '#!/bin/sh\n');
      await fs.promises.chmod(sayPath, 0o755);

      process.env.PATH = tmpDir;
      expect(detectSpeakerCommand()).toEqual(['say']);
    }
    finally {
      await fs.promises.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns ["espeak-ng"] when say is absent but espeak-ng is available', async () => {
    const tmpDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'tts-test-'),
    );
    try {
      const espeakNgPath = path.join(tmpDir, 'espeak-ng');
      await fs.promises.writeFile(espeakNgPath, '#!/bin/sh\n');
      await fs.promises.chmod(espeakNgPath, 0o755);

      process.env.PATH = tmpDir;
      expect(detectSpeakerCommand()).toEqual(['espeak-ng']);
    }
    finally {
      await fs.promises.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns ["espeak"] when say and espeak-ng are absent but espeak is available', async () => {
    const tmpDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'tts-test-'),
    );
    try {
      const espeakPath = path.join(tmpDir, 'espeak');
      await fs.promises.writeFile(espeakPath, '#!/bin/sh\n');
      await fs.promises.chmod(espeakPath, 0o755);

      process.env.PATH = tmpDir;
      expect(detectSpeakerCommand()).toEqual(['espeak']);
    }
    finally {
      await fs.promises.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('prefers say over espeak-ng when both are available', async () => {
    const tmpDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'tts-test-'),
    );
    try {
      for (const cmd of ['say', 'espeak-ng']) {
        const cmdPath = path.join(tmpDir, cmd);
        await fs.promises.writeFile(cmdPath, '#!/bin/sh\n');
        await fs.promises.chmod(cmdPath, 0o755);
      }

      process.env.PATH = tmpDir;
      expect(detectSpeakerCommand()).toEqual(['say']);
    }
    finally {
      await fs.promises.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('throws when no TTS command is found', async () => {
    const tmpDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'tts-test-'),
    );
    try {
      // Empty directory — no commands available
      process.env.PATH = tmpDir;
      expect(() => detectSpeakerCommand()).toThrow('No TTS command found');
    }
    finally {
      await fs.promises.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('throws when PATH is empty', () => {
    process.env.PATH = '';
    expect(() => detectSpeakerCommand()).toThrow('No TTS command found');
  });
});

describe('resolveSpeakerCommand', () => {
  it('returns config command when explicitly provided', () => {
    expect(resolveSpeakerCommand(['say', '-v', 'Kyoko'])).toEqual([
      'say',
      '-v',
      'Kyoko',
    ]);
  });

  it('calls detectSpeakerCommand when config command is undefined', async () => {
    // This test relies on the actual system — on macOS `say` should exist.
    // We mock the detection by manipulating PATH to a temp dir with a fake `say`.
    const originalPath = process.env.PATH;
    const tmpDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'tts-test-'),
    );
    try {
      const sayPath = path.join(tmpDir, 'say');
      await fs.promises.writeFile(sayPath, '#!/bin/sh\n');
      await fs.promises.chmod(sayPath, 0o755);

      process.env.PATH = tmpDir;
      expect(resolveSpeakerCommand(undefined)).toEqual(['say']);
    }
    finally {
      process.env.PATH = originalPath;
      await fs.promises.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
