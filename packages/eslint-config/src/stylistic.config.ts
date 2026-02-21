import stylistic from '@stylistic/eslint-plugin';
import { defineConfig } from 'eslint/config';

export function buildStylisticConfig() {
  return defineConfig([
    stylistic.configs.customize({
      indent: 2,
      semi: true,
    }),
  ]);
}
