import { defineConfig } from 'eslint/config';
import { buildCommentsConfig } from './comments.config.js';
import { buildGlobalsConfig } from './globals.config.js';
import { buildImportsConfig } from './imports.config.js';
import { buildJsConfig } from './js.config.js';
import { buildNodeConfig } from './node.config.js';
import { buildPromiseConfig } from './promise.config.js';
import { buildStylisticConfig } from './stylistic.config.js';
import { buildTsConfig } from './ts.config.js';

export type RuleSet = 'common' | 'node';

export type Env = {
  disableFixedRules?: boolean;
  ruleSets?: RuleSet[];
  entrypointFiles?: string[];
};

export function buildConfig(env: Env) {
  const ruleSets = env.ruleSets ?? ['common', 'node'];
  const disableFixedRules
    = env.disableFixedRules ?? process.env.DISABLE_FIXED_RULES === 'true';
  const entrypointFiles = env.entrypointFiles ?? ['src/index.ts'];

  const rules: Parameters<typeof defineConfig>[0] = [
    buildGlobalsConfig(),
  ];

  for (const ruleSet of ruleSets) {
    switch (ruleSet) {
      case 'common':
        rules.push(
          buildJsConfig({ entrypointFiles }),
          buildTsConfig(),
          buildStylisticConfig(),
          buildImportsConfig({ disableFixedRules }),
          buildPromiseConfig(),
          buildCommentsConfig(),
        );
        break;
      case 'node':
        rules.push(buildNodeConfig({ entrypointFiles }));
        break;
    }
  }

  return defineConfig(rules);
}
