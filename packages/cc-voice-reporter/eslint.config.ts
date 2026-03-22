import { buildConfig } from '@mizunashi_mana/eslint-config-refined';

export default [
  {
    ignores: ['dist/**'],
  },
  ...buildConfig({
    entrypointFiles: [
      'src/cli/cli.ts',
    ],
  }),
  {
    files: ['scripts/**'],
    rules: {
      'n/hashbang': 'off',
    },
  },
];
