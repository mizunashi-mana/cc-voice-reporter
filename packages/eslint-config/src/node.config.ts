import { defineConfig } from 'eslint/config';
import nodePlugin from 'eslint-plugin-n';

export function buildNodeConfig(props: { entrypointFiles: string[] }) {
  return defineConfig([
    nodePlugin.configs['flat/recommended-module'],
    {
      rules: {
        'n/handle-callback-err': ['error', '^(err|error)$'],
        'n/no-callback-literal': 'error',
        'n/no-deprecated-api': 'error',
        'n/no-exports-assign': 'error',
        'n/no-new-require': 'error',
        'n/no-path-concat': 'error',
        'n/process-exit-as-throw': 'error',
        'n/no-missing-import': 'off',
        'n/no-unpublished-import': 'off',
      },
    },
    {
      files: props.entrypointFiles,
      rules: {
        'n/no-process-exit': 'off',
      },
    },
    {
      files: ['*.config.{js,mjs,ts}'],
      rules: {
        'n/no-extraneous-import': 'off',
      },
    },
  ]);
}
