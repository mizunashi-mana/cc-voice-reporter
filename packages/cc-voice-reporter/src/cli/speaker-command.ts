/**
 * TTS command auto-detection for cross-platform speech output.
 *
 * When the user does not explicitly configure `speaker.command`, this module
 * probes known TTS commands by executing a lightweight check command:
 *   1. say       (macOS built-in)   — `say -v ?`
 *   2. espeak-ng (Linux, widely available) — `espeak-ng --version`
 *   3. espeak    (Linux, legacy fallback)  — `espeak --version`
 *
 * If none are found, an error is thrown at startup with a clear message.
 */

import { execFileSync } from 'node:child_process';

/** TTS commands to probe, in priority order, with their check arguments. */
const TTS_CANDIDATES: ReadonlyArray<{ command: string; checkArgs: string[] }> = [
  { command: 'say', checkArgs: ['-v', '?'] },
  { command: 'espeak-ng', checkArgs: ['--version'] },
  { command: 'espeak', checkArgs: ['--version'] },
];

/**
 * Check whether a TTS command is available by executing it with check arguments.
 *
 * Runs the command with a lightweight flag (e.g. `--version`) and checks
 * whether it exits successfully. This is more reliable than PATH scanning
 * because it verifies the command actually works.
 */
function isCommandAvailable(command: string, checkArgs: string[]): boolean {
  try {
    execFileSync(command, checkArgs, { stdio: 'ignore' });
    return true;
  }
  catch {
    return false;
  }
}

/**
 * Auto-detect an available TTS command by executing check commands.
 *
 * @returns The command name (e.g. `"say"`, `"espeak-ng"`) wrapped in a
 *          single-element array suitable for `SpeakerOptions.command`.
 * @throws  If no known TTS command is found.
 */
export function detectSpeakerCommand(): [string] {
  for (const candidate of TTS_CANDIDATES) {
    if (isCommandAvailable(candidate.command, candidate.checkArgs)) {
      return [candidate.command];
    }
  }
  throw new Error(
    'No TTS command found. Install espeak-ng or espeak, '
    + 'or set speaker.command in the config file.',
  );
}

/**
 * Resolve the speaker command: use the user-configured command if present,
 * otherwise auto-detect from the system.
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
