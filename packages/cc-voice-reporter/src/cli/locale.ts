/**
 * System locale detection for automatic language configuration.
 *
 * When the user does not explicitly set `language` in the config, this module
 * detects the system locale to determine the default voice language:
 *
 *   macOS:  `defaults read -g AppleLanguages` → first language code
 *   Other:  `locale` command, then LANG / LC_ALL environment variables
 *
 * Falls back to undefined when detection fails, letting the caller
 * use the hardcoded default ("en").
 */

import { execFileSync } from 'node:child_process';

/**
 * Extract a 2-letter language code from a locale-like string.
 *
 * Accepts formats such as:
 *   "ja-JP"      → "ja"
 *   "ja_JP.UTF-8" → "ja"
 *   "ja"          → "ja"
 *   "en-US"       → "en"
 *   "C"           → undefined (not a real language)
 *   "POSIX"       → undefined
 *
 * Returns undefined for unrecognizable input.
 */
export function extractLanguageCode(locale: string): string | undefined {
  const trimmed = locale.trim().replace(/^["'\s]+|["'\s]+$/g, '');
  if (trimmed === '' || trimmed === 'C' || trimmed === 'POSIX') {
    return undefined;
  }

  // Match a 2-letter language code at the start, optionally followed by
  // region/encoding separators (-, _, .)
  const match = /^([a-z]{2})(?:[-_.]|$)/i.exec(trimmed);
  if (match?.[1] === undefined) return undefined;
  return match[1].toLowerCase();
}

/**
 * Detect the system language on macOS by reading AppleLanguages.
 *
 * Runs `defaults read -g AppleLanguages` which returns a plist-style array:
 *   (
 *       "ja-JP",
 *       "en-US"
 *   )
 *
 * Extracts the first entry and returns its 2-letter language code.
 */
function detectMacOSLanguage(): string | undefined {
  try {
    const output = execFileSync('defaults', ['read', '-g', 'AppleLanguages'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    // Parse plist-style array: find quoted strings
    const entries = output.match(/"([^"]+)"/g);
    if (entries !== null && entries.length > 0) {
      // Remove quotes from the first entry
      const first = entries[0].replace(/"/g, '');
      return extractLanguageCode(first);
    }
  }
  catch {
    // Command not found or failed — fall through
  }
  return undefined;
}

/**
 * Detect the system language using the `locale` command.
 *
 * Runs `locale` and parses the LANG line from the output.
 * Output format:
 *   LANG="ja_JP.UTF-8"
 *   LC_CTYPE="ja_JP.UTF-8"
 *   ...
 */
function detectLocaleCommand(): string | undefined {
  try {
    const output = execFileSync('locale', [], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    for (const line of output.split('\n')) {
      const match = /^LANG=["']?(.+?)["']?\s*$/.exec(line);
      if (match?.[1] !== undefined) {
        return extractLanguageCode(match[1]);
      }
    }
  }
  catch {
    // Command not found or failed — fall through
  }
  return undefined;
}

/**
 * Detect the system language from environment variables.
 *
 * Checks LC_ALL first (overrides everything), then LANG.
 */
function detectEnvLanguage(): string | undefined {
  const lcAll = process.env.LC_ALL;
  if (lcAll !== undefined && lcAll !== '') {
    const code = extractLanguageCode(lcAll);
    if (code !== undefined) return code;
  }

  const lang = process.env.LANG;
  if (lang !== undefined && lang !== '') {
    return extractLanguageCode(lang);
  }

  return undefined;
}

/**
 * Detect the system language from OS locale settings.
 *
 * Detection order:
 *   - macOS: `defaults read -g AppleLanguages`
 *   - Other: `locale` command → LANG / LC_ALL env vars
 *
 * Returns a 2-letter language code (e.g. "ja", "en"), or undefined
 * if detection fails.
 */
export function detectSystemLanguage(): string | undefined {
  if (process.platform === 'darwin') {
    return detectMacOSLanguage() ?? detectEnvLanguage();
  }

  return detectLocaleCommand() ?? detectEnvLanguage();
}

/**
 * Resolve the language: use the user-configured value if present,
 * otherwise auto-detect from the system, falling back to "en".
 *
 * @param configLanguage - The `language` value from the config file
 *                         (`undefined` when not explicitly set).
 * @returns The resolved language code.
 */
export function resolveLanguage(
  configLanguage: string | undefined,
): string {
  if (configLanguage !== undefined) {
    return configLanguage;
  }
  return detectSystemLanguage() ?? 'en';
}
