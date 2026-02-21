#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { parseArgs } from "node:util";

function printUsage() {
  console.error(`Usage: run-script.mjs -C <directory> <command> [args...] [FILES <files...>]

Options:
  -C, --cwd <directory>          Change to <directory> before executing the command
  --files-delimiter <delimiter>  Set custom delimiter for file paths (default: FILES)

Special markers:
  FILES  Arguments after FILES (or custom delimiter) are treated as file paths
         and converted to paths relative to the target directory

Examples:
  run-script.mjs -C packages/server npm run build
  run-script.mjs --cwd packages/server npm run build
  run-script.mjs echo -C packages/client -- --verbose
  run-script.mjs -C packages/server -- npx eslint FILES src/index.ts
  run-script.mjs -C packages/server --files-delimiter @@ -- cmd @@ file.ts`);
}

function parse(argv) {
  const { values, positionals } = parseArgs({
    args: argv.slice(2),
    options: {
      cwd: { type: "string", short: "C" },
      "files-delimiter": { type: "string" },
    },
    allowPositionals: true,
  });

  const directory = values.cwd;
  const filesDelimiter = values["files-delimiter"] ?? "FILES";

  if (!directory) {
    console.error("Error: -C/--cwd option is required");
    printUsage();
    process.exit(1);
  }

  if (positionals.length === 0) {
    console.error("Error: No command specified");
    printUsage();
    process.exit(1);
  }

  const [command, ...commandArgs] = positionals;

  return { directory, command, commandArgs, filesDelimiter };
}

function convertFilePaths(args, targetDir, delimiter) {
  const filesIndex = args.indexOf(delimiter);
  if (filesIndex === -1) {
    return args;
  }

  const beforeFiles = args.slice(0, filesIndex);
  const filePaths = args.slice(filesIndex + 1);

  const convertedPaths = filePaths.map((filePath) => {
    const absolutePath = resolve(filePath);
    return relative(targetDir, absolutePath);
  });

  return [...beforeFiles, ...convertedPaths];
}

function main() {
  const { directory, command, commandArgs, filesDelimiter } = parse(process.argv);

  const resolvedDir = resolve(directory);

  if (!existsSync(resolvedDir)) {
    console.error(`Error: Directory does not exist: ${resolvedDir}`);
    process.exit(1);
  }

  const finalArgs = convertFilePaths(commandArgs, resolvedDir, filesDelimiter);

  const child = spawn(command, finalArgs, {
    cwd: resolvedDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  child.on("error", (err) => {
    console.error(`Error: Failed to execute command: ${err.message}`);
    process.exit(1);
  });

  child.on("close", (code) => {
    process.exit(code ?? 0);
  });
}

main();
