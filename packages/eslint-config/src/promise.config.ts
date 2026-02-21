import { defineConfig } from 'eslint/config';
import promisePlugin from 'eslint-plugin-promise';

export function buildPromiseConfig() {
  return defineConfig([
    promisePlugin.configs['flat/recommended'],
    {
      rules: {
        'promise/always-return': ['error', { ignoreLastCallback: true }],
        'promise/no-promise-in-callback': 'error',
        '@typescript-eslint/require-await': 'off',
      },
    },
  ]);
}
