/**
 * Locale-aware message catalog for voice output.
 *
 * Provides predefined messages in Japanese (ja) and English (en).
 * The active locale is selected via the `language` config field.
 */

/** Message definitions used by Daemon and Speaker for voice output. */
export interface Messages {
  /** Spoken when Claude's turn completes and input is awaited. */
  turnComplete: string;
  /** Spoken when AskUserQuestion is triggered. */
  askUserQuestion: (question: string) => string;
  /** Spoken when the speaker switches to a different project's messages. */
  projectSwitch: (displayName: string) => string;
  /** Spoken when Ollama summary generation fails. */
  summaryFailed: (eventCount: number) => string;
  /** Spoken when a permission confirmation prompt is displayed. */
  permissionRequest: string;
}

const ja: Messages = {
  turnComplete: '入力待ちです',
  askUserQuestion: (question: string) => `${question}。確認待ちです`,
  projectSwitch: (displayName: string) =>
    `別のプロジェクト「${displayName}」の実行内容を再生します`,
  summaryFailed: (eventCount: number) =>
    `要約の生成に失敗しました。${String(eventCount)}件のアクティビティがありました。`,
  permissionRequest: 'パーミッション確認です',
};

const en: Messages = {
  turnComplete: 'Waiting for input',
  askUserQuestion: (question: string) => `${question}. Awaiting confirmation`,
  projectSwitch: (displayName: string) =>
    `Playing content from another project, ${displayName}`,
  summaryFailed: (eventCount: number) =>
    `Failed to generate summary. There were ${String(eventCount)} activities.`,
  permissionRequest: 'Permission required',
};

const locales: Record<string, Messages> = { ja, en };

/**
 * Resolve the message catalog for the given language code.
 *
 * Falls back to English (`en`) for unknown language codes.
 */
export function getMessages(language: string): Messages {
  return locales[language] ?? en;
}
