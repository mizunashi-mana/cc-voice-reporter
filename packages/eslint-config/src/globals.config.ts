import { defineConfig } from 'eslint/config';
import globals from 'globals';

export function buildGlobalsConfig() {
  return defineConfig([
    {
      linterOptions: {
        reportUnusedDisableDirectives: 'error',
      },
      languageOptions: {
        globals: {
          ...globals.node,
        },
        parserOptions: {
          sourceType: 'module',
          projectService: false,
        },
      },
    },
    {
      files: ['**/*.{ts,tsx}'],
      languageOptions: {
        parserOptions: {
          projectService: true,
        },
      },
    },
  ]);
}
