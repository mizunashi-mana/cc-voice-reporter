import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineConfig } from 'tsup';

/** Packages bundled into the output (not external). */
const BUNDLED_PACKAGES = ['@cc-voice-reporter/monitor'];

/**
 * Collect runtime dependencies for the published package.json.
 *
 * Takes the CLI package's own dependencies, removes bundled packages,
 * then merges in dependencies from each bundled package (since their
 * external imports become our runtime dependencies).
 */
function collectPublishDependencies(): Record<string, string> {
  const cliPkg = readPackageJson('.');
  const deps: Record<string, string> = { ...cliPkg.dependencies };

  for (const bundled of BUNDLED_PACKAGES) {
    // Remove the bundled package itself from deps
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- removing bundled packages by name
    delete deps[bundled];

    // Find the bundled package's directory and merge its dependencies
    const bundledDir = resolveBundledPackageDir(bundled);
    if (bundledDir !== undefined) {
      const bundledPkg = readPackageJson(bundledDir);
      for (const [name, version] of Object.entries(bundledPkg.dependencies ?? {})) {
        // Don't overwrite if already present (CLI's version takes precedence)
        deps[name] ??= version;
      }
    }
  }

  return deps;
}

function readPackageJson(dir: string): {
  dependencies?: Record<string, string>;
  [key: string]: unknown;
} {
  const content = fs.readFileSync(path.resolve(dir, 'package.json'), 'utf-8');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- package.json structure
  return JSON.parse(content) as { dependencies?: Record<string, string>; [key: string]: unknown };
}

/** Resolve the directory of a bundled workspace package. */
function resolveBundledPackageDir(name: string): string | undefined {
  // Search sibling directories in packages/
  const packagesDir = path.resolve('..'); // packages/cli/../ → packages/
  let entries: string[];
  try {
    entries = fs.readdirSync(packagesDir);
  }
  catch {
    return undefined;
  }
  for (const entry of entries) {
    const dir = path.join(packagesDir, entry);
    const pkgPath = path.join(dir, 'package.json');
    try {
      const content = fs.readFileSync(pkgPath, 'utf-8');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- package.json structure
      const pkg = JSON.parse(content) as { name?: string };
      if (pkg.name === name) return dir;
    }
    catch {
      // skip
    }
  }
  return undefined;
}

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  sourcemap: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  noExternal: BUNDLED_PACKAGES,
  async onSuccess() {
    const cliPkg = readPackageJson('.');
    const deps = collectPublishDependencies();

    const publishPkg = {
      name: cliPkg.name,
      version: cliPkg.version,
      type: 'module',
      bin: {
        'cc-voice-reporter': './cli.js',
      },
      engines: cliPkg.engines,
      license: cliPkg.license,
      dependencies: deps,
    };

    const outPath = path.resolve('dist', 'package.json');
    await fs.promises.writeFile(
      outPath,
      `${JSON.stringify(publishPkg, null, 2)}\n`,
      'utf-8',
    );
  },
});
