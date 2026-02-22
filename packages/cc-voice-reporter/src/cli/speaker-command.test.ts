import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectSpeakerCommand, resolveSpeakerCommand } from './speaker-command.js';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

const execFileSyncMock = vi.mocked(execFileSync);

describe('detectSpeakerCommand', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns ["say"] when say is available', () => {
    // say -v ? succeeds
    execFileSyncMock.mockImplementation(() => Buffer.from(''));

    expect(detectSpeakerCommand()).toEqual(['say']);
    expect(execFileSyncMock).toHaveBeenCalledWith('say', ['-v', '?'], { stdio: 'ignore' });
  });

  it('returns ["espeak-ng"] when say is absent but espeak-ng is available', () => {
    execFileSyncMock.mockImplementation((command) => {
      if (command === 'say') throw new Error('not found');
      return Buffer.from('');
    });

    expect(detectSpeakerCommand()).toEqual(['espeak-ng']);
  });

  it('returns ["espeak"] when say and espeak-ng are absent but espeak is available', () => {
    execFileSyncMock.mockImplementation((command) => {
      if (command === 'say' || command === 'espeak-ng') throw new Error('not found');
      return Buffer.from('');
    });

    expect(detectSpeakerCommand()).toEqual(['espeak']);
  });

  it('prefers say over espeak-ng when both are available', () => {
    execFileSyncMock.mockImplementation(() => Buffer.from(''));

    expect(detectSpeakerCommand()).toEqual(['say']);
  });

  it('throws when no TTS command is found', () => {
    execFileSyncMock.mockImplementation(() => {
      throw new Error('not found');
    });

    expect(() => detectSpeakerCommand()).toThrow('No TTS command found');
  });

  it('checks say with -v ? flag', () => {
    execFileSyncMock.mockImplementation(() => Buffer.from(''));

    detectSpeakerCommand();

    expect(execFileSyncMock).toHaveBeenCalledWith('say', ['-v', '?'], { stdio: 'ignore' });
  });

  it('checks espeak-ng with --version flag', () => {
    execFileSyncMock.mockImplementation((command) => {
      if (command === 'say') throw new Error('not found');
      return Buffer.from('');
    });

    detectSpeakerCommand();

    expect(execFileSyncMock).toHaveBeenCalledWith('espeak-ng', ['--version'], { stdio: 'ignore' });
  });

  it('checks espeak with --version flag', () => {
    execFileSyncMock.mockImplementation((command) => {
      if (command === 'say' || command === 'espeak-ng') throw new Error('not found');
      return Buffer.from('');
    });

    detectSpeakerCommand();

    expect(execFileSyncMock).toHaveBeenCalledWith('espeak', ['--version'], { stdio: 'ignore' });
  });
});

describe('resolveSpeakerCommand', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns config command when explicitly provided', () => {
    execFileSyncMock.mockClear();

    expect(resolveSpeakerCommand(['say', '-v', 'Kyoko'])).toEqual([
      'say',
      '-v',
      'Kyoko',
    ]);
    // Should not attempt detection
    expect(execFileSyncMock).not.toHaveBeenCalled();
  });

  it('calls detectSpeakerCommand when config command is undefined', () => {
    execFileSyncMock.mockImplementation(() => Buffer.from(''));

    expect(resolveSpeakerCommand(undefined)).toEqual(['say']);
    expect(execFileSyncMock).toHaveBeenCalled();
  });
});
