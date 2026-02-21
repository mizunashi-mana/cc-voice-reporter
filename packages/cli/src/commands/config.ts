/**
 * config subcommand — manage the configuration file.
 *
 * Subcommands:
 *   init   Generate a config file template
 *   path   Show the config file path
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseArgs } from 'node:util';
import { getDefaultConfigPath } from '#lib';
import { CliError, println, errorln } from './output.js';

const USAGE = `\
Usage: cc-voice-reporter config <subcommand>

Manage the configuration file.

Subcommands:
  init    Generate a config file template
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

export async function runConfigCommand(args: string[]): Promise<void> {
  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case 'init':
      await runConfigInit(subArgs);
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

async function runConfigInit(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      force: { type: 'boolean', short: 'f' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help === true) {
    println(`\
Usage: cc-voice-reporter config init [options]

Generate a config file template.

Options:
  --force, -f  Overwrite existing config file
  --help, -h   Show this help message`);
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

  await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
  await fs.promises.writeFile(configPath, CONFIG_TEMPLATE, 'utf-8');
  println(`Config file created: ${configPath}`);
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
