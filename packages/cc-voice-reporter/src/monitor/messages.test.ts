import { describe, expect, it } from 'vitest';
import { getMessages } from './messages.js';

describe('getMessages', () => {
  describe('ja (Japanese)', () => {
    const messages = getMessages('ja');

    it('returns Japanese turn complete message', () => {
      expect(messages.turnComplete).toBe('入力待ちです');
    });

    it('returns Japanese ask user question message', () => {
      expect(messages.askUserQuestion('質問内容')).toBe('質問内容。確認待ちです');
    });

    it('returns Japanese project switch message', () => {
      expect(messages.projectSwitch('my-app')).toBe(
        '別のプロジェクト「my-app」の実行内容を再生します',
      );
    });

    it('returns Japanese summary failed message', () => {
      expect(messages.summaryFailed(5)).toBe(
        '要約の生成に失敗しました。5件のアクティビティがありました。',
      );
    });

    it('returns Japanese permission request message', () => {
      expect(messages.permissionRequest).toBe('パーミッション確認です');
    });
  });

  describe('en (English)', () => {
    const messages = getMessages('en');

    it('returns English turn complete message', () => {
      expect(messages.turnComplete).toBe('Waiting for input');
    });

    it('returns English ask user question message', () => {
      expect(messages.askUserQuestion('Which option?')).toBe(
        'Which option?. Awaiting confirmation',
      );
    });

    it('returns English project switch message', () => {
      expect(messages.projectSwitch('my-app')).toBe(
        'Playing content from another project, my-app',
      );
    });

    it('returns English summary failed message', () => {
      expect(messages.summaryFailed(3)).toBe(
        'Failed to generate summary. There were 3 activities.',
      );
    });

    it('returns English permission request message', () => {
      expect(messages.permissionRequest).toBe('Permission required');
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
