import eslintComments from '@eslint-community/eslint-plugin-eslint-comments';
import { defineConfig } from 'eslint/config';

export function buildCommentsConfig() {
  return defineConfig([
    {
      plugins: { '@eslint-community/eslint-comments': eslintComments },
      rules: {
        '@eslint-community/eslint-comments/disable-enable-pair': [
          'error',
          { allowWholeFile: true },
        ],
        '@eslint-community/eslint-comments/no-aggregating-enable': 'error',
        '@eslint-community/eslint-comments/no-duplicate-disable': 'error',
        '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
        '@eslint-community/eslint-comments/no-unused-enable': 'error',
        '@eslint-community/eslint-comments/require-description': [
          'error',
          { ignore: ['eslint-enable', 'eslint-env'] },
        ],
      },
    },
  ]);
}
