import { describe, expect, it } from 'vitest';
import { getMessages } from './messages.js';

describe('getMessages', () => {
  describe('ja (Japanese)', () => {
    const messages = getMessages('ja');

    it('returns Japanese turn complete message', () => {
      expect(messages.turnComplete).toBe('入力待ちです');
    });

    it('returns Japanese ask user question message', () => {
      expect(messages.askUserQuestion('質問内容')).toBe('確認待ち: 質問内容');
    });

    it('returns Japanese project switch message', () => {
      expect(messages.projectSwitch('my-app')).toBe(
        '別のプロジェクト「my-app」の実行内容を再生します',
      );
    });
  });

  describe('en (English)', () => {
    const messages = getMessages('en');

    it('returns English turn complete message', () => {
      expect(messages.turnComplete).toBe('Waiting for input');
    });

    it('returns English ask user question message', () => {
      expect(messages.askUserQuestion('Which option?')).toBe(
        'Confirmation: Which option?',
      );
    });

    it('returns English project switch message', () => {
      expect(messages.projectSwitch('my-app')).toBe(
        'Playing content from another project, my-app',
      );
    });
  });

  describe('fallback', () => {
    it('falls back to English for unknown language codes', () => {
      const messages = getMessages('fr');
      expect(messages.turnComplete).toBe('Waiting for input');
    });

    it('falls back to English for empty string', () => {
      const messages = getMessages('');
      expect(messages.turnComplete).toBe('Waiting for input');
    });
  });
});
