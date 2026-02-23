/**
 * Interactive configuration wizard for `config init`.
 *
 * Guides the user through setting up cc-voice-reporter by asking
 * about language, speaker command, and Ollama configuration.
 * Uses Node.js built-in readline — no external dependencies.
 */

import * as readline from 'node:readline';
import { detectSystemLanguage } from './locale.js';
import { listOllamaModels, OLLAMA_DEFAULT_BASE_URL } from './ollama.js';
import { detectSpeakerCommand } from './speaker-command.js';
import type { Config } from './config.js';

/** Abstraction over readline for testability. */
export interface WizardIO {
  question: (prompt: string) => Promise<string>;
  write: (message: string) => void;
  close: () => void;
}

/** Promisify readline.Interface.question. */
async function questionAsync(
  rl: readline.Interface,
  prompt: string,
): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

/** Create a WizardIO backed by a real readline interface. */
export function createStdioWizardIO(): WizardIO {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return {
    question: async (prompt: string) => questionAsync(rl, prompt),
    write: (message: string) => { process.stdout.write(message); },
    close: () => { rl.close(); },
  };
}

/**
 * Ask a question with a default value. Empty input returns the default.
 */
async function ask(
  io: WizardIO,
  prompt: string,
  defaultValue: string,
): Promise<string> {
  const answer = await io.question(`${prompt} [${defaultValue}]: `);
  const trimmed = answer.trim();
  return trimmed === '' ? defaultValue : trimmed;
}

/**
 * Ask a yes/no question. Returns true for yes (default), false for no.
 */
async function askYesNo(
  io: WizardIO,
  prompt: string,
  defaultYes: boolean,
): Promise<boolean> {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  const answer = await io.question(`${prompt} [${hint}]: `);
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === '') return defaultYes;
  return trimmed === 'y' || trimmed === 'yes';
}

/**
 * Step 1: Language selection.
 *
 * Detects system locale and uses it as the default.
 */
async function askLanguage(io: WizardIO): Promise<string> {
  const detected = detectSystemLanguage() ?? 'en';
  io.write('\n--- Language ---\n');
  return ask(io, 'Language code (e.g. ja, en)', detected);
}

/**
 * Step 2: Speaker command.
 *
 * Auto-detects available TTS commands and lets the user confirm or override.
 */
async function askSpeakerCommand(io: WizardIO): Promise<string[] | undefined> {
  io.write('\n--- Speaker ---\n');

  let detected: string | undefined;
  try {
    const result = detectSpeakerCommand();
    detected = result[0];
  }
  catch {
    // No TTS command found
  }

  if (detected !== undefined) {
    io.write(`Detected TTS command: ${detected}\n`);
    const useDetected = await askYesNo(io, `Use "${detected}"?`, true);
    if (useDetected) {
      return [detected];
    }
  }
  else {
    io.write('No TTS command detected (say, espeak-ng, espeak).\n');
  }

  const custom = await ask(io, 'Enter TTS command', detected ?? 'say');
  return [custom];
}

/**
 * Step 3: Ollama setup.
 *
 * Checks Ollama connectivity, guides installation if needed,
 * and lets the user select a model.
 */
async function askOllama(io: WizardIO): Promise<Config['ollama']> {
  io.write('\n--- Ollama ---\n');
  io.write('Ollama is required for periodic summary notifications.\n');

  const baseUrl = await ask(io, 'Ollama API URL', OLLAMA_DEFAULT_BASE_URL);

  let models: string[];
  try {
    models = await listOllamaModels(baseUrl);
  }
  catch {
    io.write('\n');
    io.write('Could not connect to Ollama.\n');
    io.write('Install Ollama:\n');
    io.write('  macOS / Linux: curl -fsSL https://ollama.com/install.sh | sh\n');
    io.write('  or visit: https://ollama.com/download\n');
    io.write('\n');
    io.write('After installing, start Ollama and pull a model:\n');
    io.write('  ollama serve\n');
    io.write('  ollama pull gemma3\n');
    io.write('\n');

    const model = await ask(io, 'Model name (to be configured)', 'gemma3');
    return {
      model,
      ...(baseUrl !== OLLAMA_DEFAULT_BASE_URL ? { baseUrl } : {}),
    };
  }

  if (models.length === 0) {
    io.write('\n');
    io.write('Ollama is running but no models are available.\n');
    io.write('Pull a model:\n');
    io.write('  ollama pull gemma3\n');
    io.write('\n');

    const model = await ask(io, 'Model name (to be configured)', 'gemma3');
    return {
      model,
      ...(baseUrl !== OLLAMA_DEFAULT_BASE_URL ? { baseUrl } : {}),
    };
  }

  io.write(`Available models: ${models.join(', ')}\n`);
  // models.length > 0 is guaranteed by the earlier check
  const defaultModel = models[0] ?? 'gemma3';
  const model = await ask(io, 'Select model', defaultModel);

  return {
    model,
    ...(baseUrl !== OLLAMA_DEFAULT_BASE_URL ? { baseUrl } : {}),
  };
}

/**
 * Build a Config object from wizard answers, omitting undefined fields.
 */
function buildConfig(
  language: string,
  speakerCommand: string[] | undefined,
  ollama: Config['ollama'],
): Config {
  const config: Config = {
    language,
  };

  if (speakerCommand !== undefined) {
    config.speaker = { command: speakerCommand };
  }

  if (ollama !== undefined) {
    config.ollama = ollama;
  }

  return config;
}

export interface WizardResult {
  config: Config;
  confirmed: boolean;
}

/**
 * Run the interactive configuration wizard.
 *
 * Returns the generated config and whether the user confirmed it.
 */
export async function runWizard(io: WizardIO): Promise<WizardResult> {
  io.write('cc-voice-reporter configuration wizard\n');
  io.write('======================================\n');

  const language = await askLanguage(io);
  const speakerCommand = await askSpeakerCommand(io);
  const ollama = await askOllama(io);

  const config = buildConfig(language, speakerCommand, ollama);

  io.write('\n--- Generated config ---\n');
  const json = JSON.stringify(config, null, 2);
  io.write(`${json}\n`);

  const confirmed = await askYesNo(io, '\nWrite this config?', true);

  return { config, confirmed };
}
