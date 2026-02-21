import { defineConfig } from 'eslint/config';
import * as importX from 'eslint-plugin-import-x';
import eslintPluginUnusedImports from 'eslint-plugin-unused-imports';

export function buildImportsConfig(props: { disableFixedRules: boolean }) {
  return defineConfig([
    importX.flatConfigs.recommended,
    importX.flatConfigs.typescript,
    {
      plugins: { 'unused-imports': eslintPluginUnusedImports },
    },
    {
      rules: {
        'import-x/export': 'error',
        'import-x/first': 'error',
        'import-x/no-absolute-path': [
          'error',
          { esmodule: true, commonjs: true, amd: false },
        ],
        'import-x/no-duplicates': 'error',
        'import-x/no-named-as-default': 'off',
        'import-x/no-named-as-default-member': 'off',
        'import-x/no-named-default': 'error',
        'import-x/no-webpack-loader-syntax': 'error',
        'import-x/no-extraneous-dependencies': 'error',
        'import-x/order': [
          'error',
          {
            'groups': [
              'builtin',
              'external',
              'internal',
              ['parent', 'sibling', 'index'],
              'type',
            ],
            'alphabetize': { order: 'asc', caseInsensitive: true },
            'newlines-between': 'never',
          },
        ],
        'unused-imports/no-unused-imports': props.disableFixedRules
          ? 'off'
          : 'error',
      },
    },
  ]);
}
