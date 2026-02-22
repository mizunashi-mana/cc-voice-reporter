/**
 * TTS command auto-detection for cross-platform speech output.
 *
 * When the user does not explicitly configure `speaker.command`, this module
 * probes the system PATH for known TTS commands in priority order:
 *   1. say       (macOS built-in)
 *   2. espeak-ng (Linux, widely available)
 *   3. espeak    (Linux, legacy fallback)
 *
 * If none are found, an error is thrown at startup with a clear message.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** TTS commands to probe, in priority order. */
const TTS_CANDIDATES: readonly string[] = ['say', 'espeak-ng', 'espeak'];

/**
 * Check whether a command name is available as an executable in PATH.
 *
 * Iterates over `$PATH` directories and checks for an executable file
 * without spawning a subprocess.
 */
function isCommandAvailable(command: string): boolean {
  const pathEnv = process.env.PATH ?? '';
  const dirs = pathEnv.split(path.delimiter);
  for (const dir of dirs) {
    try {
      const fullPath = path.join(dir, command);
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        fs.accessSync(fullPath, fs.constants.X_OK);
        return true;
      }
    }
    catch {
      // Not found in this directory — continue
    }
  }
  return false;
}

/**
 * Auto-detect an available TTS command from the system PATH.
 *
 * @returns The command name (e.g. `"say"`, `"espeak-ng"`) wrapped in a
 *          single-element array suitable for `SpeakerOptions.command`.
 * @throws  If no known TTS command is found.
 */
export function detectSpeakerCommand(): [string] {
  for (const candidate of TTS_CANDIDATES) {
    if (isCommandAvailable(candidate)) {
      return [candidate];
    }
  }
  throw new Error(
    'No TTS command found. Install espeak-ng or espeak, '
    + 'or set speaker.command in the config file.',
  );
}

/**
 * Resolve the speaker command: use the user-configured command if present,
 * otherwise auto-detect from the system PATH.
 *
 * @param configCommand - The `speaker.command` value from the config file
 *                        (`undefined` when not explicitly set).
 * @returns The resolved command array.
 */
export function resolveSpeakerCommand(
  configCommand: string[] | undefined,
): string[] {
  if (configCommand !== undefined) {
    return configCommand;
  }
  return detectSpeakerCommand();
}
