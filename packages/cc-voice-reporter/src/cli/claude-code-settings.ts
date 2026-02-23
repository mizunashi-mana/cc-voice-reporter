/**
 * Claude Code settings management for hook registration.
 *
 * Reads/writes ~/.claude/settings.json to register cc-voice-reporter
 * as a Claude Code hook handler for SessionStart and Notification events.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const PACKAGE_NAME = '@mizunashi_mana/cc-voice-reporter';
const HOOK_RECEIVER_SUBCOMMAND = 'hook-receiver';

/**
 * Return the path to Claude Code's user-level settings file.
 */
export function getClaudeCodeSettingsPath(): string {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

/**
 * Detect the appropriate hook-receiver command based on how this CLI was invoked.
 *
 * If running via `npx` (npm_command === 'exec'), returns
 * `npx -y @mizunashi_mana/cc-voice-reporter hook-receiver`.
 * Otherwise, returns `cc-voice-reporter hook-receiver`.
 */
export function detectHookReceiverCommand(
  env: Record<string, string | undefined> = process.env,
): string {
  if (env.npm_command === 'exec') {
    return `npx -y ${PACKAGE_NAME} ${HOOK_RECEIVER_SUBCOMMAND}`;
  }
  return `cc-voice-reporter ${HOOK_RECEIVER_SUBCOMMAND}`;
}

interface HookHandler {
  type: string;
  command?: string;
  [key: string]: unknown;
}

interface HookRule {
  matcher?: string;
  hooks?: HookHandler[];
  [key: string]: unknown;
}

type HooksConfig = Record<string, HookRule[]>;

interface ClaudeCodeSettings {
  hooks?: HooksConfig;
  [key: string]: unknown;
}

/**
 * Build the hook rules to register for cc-voice-reporter.
 */
function buildHookRules(
  command: string,
): Array<{ eventName: string; rule: HookRule }> {
  return [
    {
      eventName: 'SessionStart',
      rule: {
        hooks: [{ type: 'command', command }],
      },
    },
    {
      eventName: 'Notification',
      rule: {
        matcher: 'permission_prompt',
        hooks: [{ type: 'command', command }],
      },
    },
  ];
}

/**
 * Check if any rule in the list already contains a cc-voice-reporter hook-receiver command.
 */
function hasHookReceiverCommand(rules: HookRule[]): boolean {
  return rules.some(rule =>
    Array.isArray(rule.hooks) && rule.hooks.some(h =>
      typeof h.command === 'string'
      && h.command.includes('cc-voice-reporter')
      && h.command.includes(HOOK_RECEIVER_SUBCOMMAND),
    ),
  );
}

export interface MergeResult {
  /** Whether the settings were modified. */
  modified: boolean;
  /** Hook event names that were newly registered. */
  registered: string[];
  /** Hook event names that were already registered (skipped). */
  skipped: string[];
}

/**
 * Merge cc-voice-reporter hook rules into existing Claude Code settings.
 *
 * Returns a new settings object and a report of what was changed.
 * Does not mutate the input.
 */
export function mergeHooks(
  settings: ClaudeCodeSettings,
  command: string,
): { settings: ClaudeCodeSettings; result: MergeResult } {
  const hooks: HooksConfig = { ...settings.hooks };
  const result: MergeResult = { modified: false, registered: [], skipped: [] };

  for (const { eventName, rule } of buildHookRules(command)) {
    const existingRules = hooks[eventName];
    if (existingRules !== undefined && hasHookReceiverCommand(existingRules)) {
      result.skipped.push(eventName);
      continue;
    }
    hooks[eventName] = [...(existingRules ?? []), rule];
    result.registered.push(eventName);
    result.modified = true;
  }

  return {
    settings: { ...settings, hooks },
    result,
  };
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}

/**
 * Read Claude Code settings from a file.
 * Returns an empty object if the file doesn't exist.
 */
export async function readClaudeCodeSettings(
  settingsPath?: string,
): Promise<ClaudeCodeSettings> {
  const filePath = settingsPath ?? getClaudeCodeSettingsPath();
  let content: string;
  try {
    content = await fs.promises.readFile(filePath, 'utf-8');
  }
  catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return {};
    }
    throw err;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  }
  catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Failed to parse Claude Code settings (${filePath}): ${err.message}`);
    }
    throw err;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {};
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- validated above
  return parsed as ClaudeCodeSettings;
}

/**
 * Write Claude Code settings to a file.
 */
export async function writeClaudeCodeSettings(
  settings: ClaudeCodeSettings,
  settingsPath?: string,
): Promise<void> {
  const filePath = settingsPath ?? getClaudeCodeSettingsPath();
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const json = `${JSON.stringify(settings, null, 2)}\n`;
  await fs.promises.writeFile(filePath, json, 'utf-8');
}

/**
 * Register cc-voice-reporter hooks in Claude Code settings.
 *
 * Reads the settings file, merges hooks, and writes back if modified.
 */
export async function registerHooks(
  command: string,
  settingsPath?: string,
): Promise<MergeResult> {
  const existing = await readClaudeCodeSettings(settingsPath);
  const { settings, result } = mergeHooks(existing, command);
  if (result.modified) {
    await writeClaudeCodeSettings(settings, settingsPath);
  }
  return result;
}
