import { describe, it, expect, vi, afterEach } from 'vitest';
import { Logger, parseLogLevel, resolveLogLevel } from './logger.js';

describe('parseLogLevel', () => {
  it('parses valid log levels', () => {
    expect(parseLogLevel('debug')).toBe('debug');
    expect(parseLogLevel('info')).toBe('info');
    expect(parseLogLevel('warn')).toBe('warn');
    expect(parseLogLevel('error')).toBe('error');
  });

  it('is case-insensitive', () => {
    expect(parseLogLevel('DEBUG')).toBe('debug');
    expect(parseLogLevel('Info')).toBe('info');
    expect(parseLogLevel('WARN')).toBe('warn');
  });

  it('returns undefined for invalid values', () => {
    expect(parseLogLevel('verbose')).toBeUndefined();
    expect(parseLogLevel('')).toBeUndefined();
    expect(parseLogLevel('trace')).toBeUndefined();
  });
});

describe('resolveLogLevel', () => {
  afterEach(() => {
    delete process.env.CC_VOICE_REPORTER_LOG_LEVEL;
  });

  it('defaults to info', () => {
    expect(resolveLogLevel()).toBe('info');
  });

  it('uses config level when provided', () => {
    expect(resolveLogLevel('debug')).toBe('debug');
  });

  it('env var takes precedence over config', () => {
    process.env.CC_VOICE_REPORTER_LOG_LEVEL = 'error';
    expect(resolveLogLevel('debug')).toBe('error');
  });

  it('falls back to config when env var is invalid', () => {
    process.env.CC_VOICE_REPORTER_LOG_LEVEL = 'invalid';
    expect(resolveLogLevel('warn')).toBe('warn');
  });

  it('falls back to default when both are invalid', () => {
    process.env.CC_VOICE_REPORTER_LOG_LEVEL = 'invalid';
    expect(resolveLogLevel('invalid')).toBe('info');
  });
});

describe('Logger', () => {
  it('outputs messages at or above the configured level', () => {
    const output: string[] = [];
    const logger = new Logger({
      level: 'info',
      writeFn: msg => output.push(msg),
    });

    logger.debug('debug msg');
    logger.info('info msg');
    logger.warn('warn msg');
    logger.error('error msg');

    expect(output).toEqual([
      '[cc-voice-reporter] info: info msg\n',
      '[cc-voice-reporter] warn: warn msg\n',
      '[cc-voice-reporter] error: error msg\n',
    ]);
  });

  it('suppresses all below error level', () => {
    const output: string[] = [];
    const logger = new Logger({
      level: 'error',
      writeFn: msg => output.push(msg),
    });

    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    expect(output).toEqual(['[cc-voice-reporter] error: e\n']);
  });

  it('outputs everything at debug level', () => {
    const output: string[] = [];
    const logger = new Logger({
      level: 'debug',
      writeFn: msg => output.push(msg),
    });

    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    expect(output).toHaveLength(4);
  });

  it('defaults to info level', () => {
    const output: string[] = [];
    const logger = new Logger({
      writeFn: msg => output.push(msg),
    });

    logger.debug('should not appear');
    logger.info('should appear');

    expect(output).toHaveLength(1);
    expect(output[0]).toContain('should appear');
  });

  it('uses process.stderr.write by default', () => {
    const spy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    const logger = new Logger({ level: 'info' });

    logger.info('test message');

    expect(spy).toHaveBeenCalledWith(
      '[cc-voice-reporter] info: test message\n',
    );
    spy.mockRestore();
  });
});
