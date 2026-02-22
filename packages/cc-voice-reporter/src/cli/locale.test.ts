import { describe, expect, it } from 'vitest';
import { extractLanguageCode, resolveLanguage } from './locale.js';

describe('extractLanguageCode', () => {
  it('extracts from BCP 47 tag with region (ja-JP)', () => {
    expect(extractLanguageCode('ja-JP')).toBe('ja');
  });

  it('extracts from BCP 47 tag with region (en-US)', () => {
    expect(extractLanguageCode('en-US')).toBe('en');
  });

  it('extracts from POSIX locale with encoding (ja_JP.UTF-8)', () => {
    expect(extractLanguageCode('ja_JP.UTF-8')).toBe('ja');
  });

  it('extracts from POSIX locale without encoding (en_US)', () => {
    expect(extractLanguageCode('en_US')).toBe('en');
  });

  it('extracts bare 2-letter code (ja)', () => {
    expect(extractLanguageCode('ja')).toBe('ja');
  });

  it('lowercases language code (JA-JP)', () => {
    expect(extractLanguageCode('JA-JP')).toBe('ja');
  });

  it('returns undefined for empty string', () => {
    expect(extractLanguageCode('')).toBeUndefined();
  });

  it('returns undefined for "C"', () => {
    expect(extractLanguageCode('C')).toBeUndefined();
  });

  it('returns undefined for "POSIX"', () => {
    expect(extractLanguageCode('POSIX')).toBeUndefined();
  });

  it('returns undefined for single letter', () => {
    expect(extractLanguageCode('a')).toBeUndefined();
  });

  it('trims whitespace', () => {
    expect(extractLanguageCode('  ja-JP  ')).toBe('ja');
  });

  it('strips surrounding quotes', () => {
    expect(extractLanguageCode('"ja-JP"')).toBe('ja');
  });
});

describe('resolveLanguage', () => {
  it('returns config language when provided', () => {
    expect(resolveLanguage('ja')).toBe('ja');
  });

  it('returns a string when config language is undefined (auto-detect or fallback)', () => {
    const result = resolveLanguage(undefined);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});
