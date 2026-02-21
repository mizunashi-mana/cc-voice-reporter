/**
 * tracking subcommand — manage tracked projects.
 *
 * Manipulates the filter.include list in the config file to control
 * which projects are monitored.
 *
 * Subcommands:
 *   add <path>     Add a project path to include filter
 *   remove <path>  Remove a project path from include filter
 *   list           List current include/exclude filters
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseArgs } from 'node:util';
import { ConfigSchema, getDefaultConfigPath, type Config } from '#lib';
import { CliError, println } from './output.js';

const USAGE = `\
Usage: cc-voice-reporter tracking <subcommand>

Manage tracked projects.

Subcommands:
  add <path>     Add a project path to tracking
  remove <path>  Remove a project path from tracking
  list           List tracked projects

Options:
  --help, -h     Show this help message`;

export async function runTrackingCommand(args: string[]): Promise<void> {
  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case 'add':
      await runTrackingAdd(subArgs);
      break;
    case 'remove':
      await runTrackingRemove(subArgs);
      break;
    case 'list':
      await runTrackingList(subArgs);
      break;
    case '--help':
    case '-h':
    case undefined:
      println(USAGE);
      break;
    default:
      throw new CliError(`Unknown tracking subcommand: ${subcommand}\n\n${USAGE}`);
  }
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}

async function loadConfigFile(configPath: string): Promise<{ config: Config; raw: Record<string, unknown> }> {
  let content: string;
  try {
    content = await fs.promises.readFile(configPath, 'utf-8');
  }
  catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return { config: {}, raw: {} };
    }
    throw err;
  }

  let json: unknown;
  try {
    json = JSON.parse(content);
  }
  catch {
    throw new CliError(`Invalid JSON in config file: ${configPath}`);
  }
  const result = ConfigSchema.safeParse(json);
  if (!result.success) {
    throw new CliError(`Invalid config file ${configPath}: ${result.error.message}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- validated above
  return { config: result.data, raw: json as Record<string, unknown> };
}

async function saveConfigFile(configPath: string, raw: Record<string, unknown>): Promise<void> {
  await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
  await fs.promises.writeFile(
    configPath,
    `${JSON.stringify(raw, null, 2)}\n`,
    'utf-8',
  );
}

function resolveAbsolutePath(projectPath: string): string {
  return path.resolve(projectPath);
}

async function runTrackingAdd(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      config: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
  });

  if (values.help === true) {
    println(`\
Usage: cc-voice-reporter tracking add <path> [options]

Add a project path to tracking.

Options:
  --config <path>  Path to config file
  --help, -h       Show this help message`);
    return;
  }

  const projectPath = positionals[0];
  if (projectPath === undefined) {
    throw new CliError('Error: project path is required\n\nUsage: cc-voice-reporter tracking add <path>');
  }

  const absolutePath = resolveAbsolutePath(projectPath);
  const configPath = values.config ?? getDefaultConfigPath();
  const { raw } = await loadConfigFile(configPath);

  // Ensure filter.include exists
  if (raw.filter === undefined) {
    raw.filter = {};
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- structure validated
  const filter = raw.filter as Record<string, unknown>;
  if (!Array.isArray(filter.include)) {
    filter.include = [];
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- structure validated
  const include = filter.include as string[];

  if (include.includes(absolutePath)) {
    println(`Already tracked: ${absolutePath}`);
    return;
  }

  include.push(absolutePath);
  await saveConfigFile(configPath, raw);
  println(`Added: ${absolutePath}`);
}

async function runTrackingRemove(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      config: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
  });

  if (values.help === true) {
    println(`\
Usage: cc-voice-reporter tracking remove <path> [options]

Remove a project path from tracking.

Options:
  --config <path>  Path to config file
  --help, -h       Show this help message`);
    return;
  }

  const projectPath = positionals[0];
  if (projectPath === undefined) {
    throw new CliError('Error: project path is required\n\nUsage: cc-voice-reporter tracking remove <path>');
  }

  const absolutePath = resolveAbsolutePath(projectPath);
  const configPath = values.config ?? getDefaultConfigPath();
  const { raw } = await loadConfigFile(configPath);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- structure validated
  const filter = (raw.filter ?? {}) as Record<string, unknown>;
  if (!Array.isArray(filter.include)) {
    throw new CliError(`Not tracked: ${absolutePath}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- structure validated
  const include = filter.include as string[];
  const index = include.indexOf(absolutePath);
  if (index === -1) {
    throw new CliError(`Not tracked: ${absolutePath}`);
  }

  include.splice(index, 1);
  await saveConfigFile(configPath, raw);
  println(`Removed: ${absolutePath}`);
}

async function runTrackingList(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      config: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help === true) {
    println(`\
Usage: cc-voice-reporter tracking list [options]

List tracked projects.

Options:
  --config <path>  Path to config file
  --help, -h       Show this help message`);
    return;
  }

  const configPath = values.config ?? getDefaultConfigPath();
  const { config } = await loadConfigFile(configPath);

  const include = config.filter?.include ?? [];
  const exclude = config.filter?.exclude ?? [];

  if (include.length === 0 && exclude.length === 0) {
    println('No project filters configured. All projects are tracked.');
    return;
  }

  if (include.length > 0) {
    println('Include:');
    for (const p of include) {
      println(`  ${p}`);
    }
  }

  if (exclude.length > 0) {
    println('Exclude:');
    for (const p of exclude) {
      println(`  ${p}`);
    }
  }
}
