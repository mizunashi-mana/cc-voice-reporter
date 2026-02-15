#!/usr/bin/env node

import { execSync, spawn } from "node:child_process";

function getProjectRoot() {
  return execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim();
}

function getGitStatus(cwd) {
  try {
    const output = execSync("git status --porcelain", { encoding: "utf-8", cwd });
    return output.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function getUntrackedFiles(statusLines) {
  return statusLines
    .filter((line) => line.startsWith("??"))
    .map((line) => line.slice(3));
}

function getDeletedFiles(statusLines) {
  return statusLines
    .filter((line) => line.startsWith(" D") || line.startsWith("D "))
    .map((line) => line.slice(3));
}

function gitIntentToAdd(files, cwd) {
  if (files.length === 0) return;

  console.log(`Intent-to-add: ${files.join(", ")}`);
  execSync(`git add --intent-to-add -- ${files.map((f) => `"${f}"`).join(" ")}`, {
    stdio: "inherit",
    cwd,
  });
}

function gitRmCached(files, cwd) {
  if (files.length === 0) return;

  console.log(`Remove from index: ${files.join(", ")}`);
  execSync(`git rm --cached -- ${files.map((f) => `"${f}"`).join(" ")}`, {
    stdio: "inherit",
    cwd,
  });
}

function runPreCommit(cwd) {
  return new Promise((resolve) => {
    const child = spawn("prek", ["run"], {
      stdio: "inherit",
      shell: process.platform === "win32",
      cwd,
      env: {
        ...process.env,
        DISABLE_FIXED_RULES: "true",
      },
    });

    child.on("error", (err) => {
      console.error(`Error: Failed to execute prek: ${err.message}`);
      resolve(1);
    });

    child.on("close", (code) => {
      resolve(code ?? 0);
    });
  });
}

async function main() {
  if (process.env.SKIP_LINT_HOOK === "true") {
    process.exit(0);
  }

  const projectRoot = getProjectRoot();
  const statusLines = getGitStatus(projectRoot);

  const untrackedFiles = getUntrackedFiles(statusLines);
  const deletedFiles = getDeletedFiles(statusLines);

  gitIntentToAdd(untrackedFiles, projectRoot);
  gitRmCached(deletedFiles, projectRoot);

  const exitCode = await runPreCommit(projectRoot);
  process.exit(exitCode);
}

main();
