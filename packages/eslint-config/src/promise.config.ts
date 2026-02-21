import { defineConfig } from 'eslint/config';
import promisePlugin from 'eslint-plugin-promise';

export function buildPromiseConfig() {
  return defineConfig([
    // @ts-expect-error -- ESLint plugin type incompatibility with defineConfig
    promisePlugin.configs['flat/recommended'],
    {
      rules: {
        'promise/always-return': ['error', { ignoreLastCallback: true }],
        'promise/no-promise-in-callback': 'error',
        // promise plugin の recommended が require-await を有効にするため、TS 版で制御するよう off にする
        '@typescript-eslint/require-await': 'off',
      },
    },
  ]);
}
