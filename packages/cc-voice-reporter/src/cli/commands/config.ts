/**
 * config subcommand — manage the configuration file.
 *
 * Subcommands:
 *   init   Generate a config file (interactive wizard by default)
 *   path   Show the config file path
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseArgs } from 'node:util';
import {
  createStdioWizardIO,
  getDefaultConfigPath,
  runWizard,
  type WizardIO,
  type WizardResult,
} from '#cli';
import { CliError, println, errorln } from './output.js';

const USAGE = `\
Usage: cc-voice-reporter config <subcommand>

Manage the configuration file.

Subcommands:
  init    Generate a config file (interactive wizard)
  path    Show the config file path

Options:
  --help, -h  Show this help message`;

const CONFIG_TEMPLATE = `\
{
  "logLevel": "info",
  "language": "ja",
  "filter": {
    "include": [],
    "exclude": []
  },
  "speaker": {
    "command": ["say"]
  }
}
`;

/** Dependencies for config init, injectable for testing. */
export interface ConfigInitDeps {
  createWizardIO: () => WizardIO;
  executeWizard: (io: WizardIO) => Promise<WizardResult>;
}

const defaultDeps: ConfigInitDeps = {
  createWizardIO: createStdioWizardIO,
  executeWizard: runWizard,
};

export async function runConfigCommand(
  args: string[],
  deps: ConfigInitDeps = defaultDeps,
): Promise<void> {
  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case 'init':
      await runConfigInit(subArgs, deps);
      break;
    case 'path':
      runConfigPath(subArgs);
      break;
    case '--help':
    case '-h':
    case undefined:
      println(USAGE);
      break;
    default:
      throw new CliError(`Unknown config subcommand: ${subcommand}\n\n${USAGE}`);
  }
}

async function runConfigInit(
  args: string[],
  deps: ConfigInitDeps,
): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      'force': { type: 'boolean', short: 'f' },
      'non-interactive': { type: 'boolean' },
      'help': { type: 'boolean', short: 'h' },
    },
  });

  if (values.help === true) {
    println(`\
Usage: cc-voice-reporter config init [options]

Generate a config file. Launches an interactive wizard by default.

Options:
  --force, -f        Overwrite existing config file
  --non-interactive  Generate a fixed template without prompts
  --help, -h         Show this help message`);
    return;
  }

  const configPath = getDefaultConfigPath();

  if (values.force !== true) {
    let exists = false;
    try {
      await fs.promises.access(configPath);
      exists = true;
    }
    catch {
      // File doesn't exist — proceed
    }
    if (exists) {
      errorln(`Config file already exists: ${configPath}`);
      throw new CliError('Use --force to overwrite.');
    }
  }

  if (values['non-interactive'] === true) {
    await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
    await fs.promises.writeFile(configPath, CONFIG_TEMPLATE, 'utf-8');
    println(`Config file created: ${configPath}`);
    return;
  }

  const io = deps.createWizardIO();
  try {
    const { config, confirmed } = await deps.executeWizard(io);
    if (!confirmed) {
      println('Aborted.');
      return;
    }

    const json = `${JSON.stringify(config, null, 2)}\n`;
    await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
    await fs.promises.writeFile(configPath, json, 'utf-8');
    println(`Config file created: ${configPath}`);
  }
  finally {
    io.close();
  }
}

function runConfigPath(args: string[]): void {
  const { values } = parseArgs({
    args,
    options: {
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help === true) {
    println(`\
Usage: cc-voice-reporter config path

Show the config file path.

Options:
  --help, -h  Show this help message`);
    return;
  }

  println(getDefaultConfigPath());
}
