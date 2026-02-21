declare module '@eslint-community/eslint-plugin-eslint-comments' {
  import type { ESLint } from 'eslint';
  const plugin: ESLint.Plugin;
  export default plugin;
}

declare module 'eslint-plugin-promise' {
  import type { ESLint } from 'eslint';
  interface PromisePlugin extends ESLint.Plugin {
    configs: { 'flat/recommended': ESLint.ConfigData };
  }
  const plugin: PromisePlugin;
  export default plugin;
}
