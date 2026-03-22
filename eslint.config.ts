import { buildConfig } from '@mizunashi_mana/eslint-config-refined';

export default [
  ...buildConfig({
    entrypointFiles: ['scripts/*.mjs'],
  }),
];
