import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';

export function buildJsConfig(props: { entrypointFiles: string[] }) {
  return defineConfig([
    eslint.configs.recommended,
    {
      rules: {
        'accessor-pairs': [
          'error',
          {
            setWithoutGet: true,
            getWithoutSet: false,
            enforceForClassMembers: true,
          },
        ],
        'array-callback-return': [
          'error',
          { allowImplicit: false, allowVoid: false, checkForEach: false },
        ],
        'complexity': ['error', { variant: 'modified', max: 20 }],
        'consistent-this': ['error', 'that'],
        'constructor-super': 'error',
        'curly': ['error', 'multi-line'],
        'default-case-last': 'error',
        'eqeqeq': ['error', 'always'],
        'grouped-accessor-pairs': ['error', 'getBeforeSet'],
        'guard-for-in': 'error',
        'max-depth': ['error', { max: 5 }],
        'max-lines': [
          'error',
          { max: 450, skipBlankLines: true, skipComments: true },
        ],
        'max-nested-callbacks': ['error', { max: 3 }],
        'new-cap': [
          'error',
          { newIsCap: true, capIsNew: false, properties: true },
        ],
        'no-alert': 'error',
        'no-caller': 'error',
        'no-cond-assign': ['error', 'always'],
        'no-console': ['error'],
        'no-constant-condition': ['error', { checkLoops: false }],
        'no-constructor-return': ['error'],
        'no-empty': ['error', { allowEmptyCatch: true }],
        'no-eval': 'error',
        'no-extend-native': 'error',
        'no-extra-bind': 'error',
        'no-implicit-globals': ['error'],
        'no-inner-declarations': [
          'error',
          'both',
          { blockScopedFunctions: 'disallow' },
        ],
        'no-iterator': 'error',
        'no-labels': ['error', { allowLoop: false, allowSwitch: false }],
        'no-lone-blocks': 'error',
        'no-multi-str': 'error',
        'no-new': 'error',
        'no-new-func': 'error',
        'no-new-wrappers': 'error',
        'no-object-constructor': 'error',
        'no-octal-escape': 'error',
        'no-param-reassign': 'error',
        'no-proto': 'error',
        'no-restricted-globals': [
          'error',
          { name: 'event', message: 'Use local parameter instead.' },
          { name: 'fdescribe', message: 'Do not commit fdescribe.' },
        ],
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['../'],
                message: 'Use absolute paths starting with @',
              },
            ],
          },
        ],
        'no-return-assign': ['error', 'always'],
        'no-self-assign': ['error', { props: true }],
        'no-self-compare': 'error',
        'no-sequences': ['error', { allowInParentheses: false }],
        'no-template-curly-in-string': 'error',
        'no-unmodified-loop-condition': 'error',
        'no-unneeded-ternary': ['error', { defaultAssignment: false }],
        'no-unreachable-loop': ['error'],
        'no-useless-call': 'error',
        'no-useless-computed-key': 'error',
        'no-useless-rename': 'error',
        'no-var': 'error',
        'no-void': ['error', { allowAsStatement: true }],
        'object-shorthand': [
          'error',
          'properties',
          { avoidQuotes: true },
        ],
        'one-var': ['error', { initialized: 'never' }],
        'prefer-const': [
          'error',
          { destructuring: 'all', ignoreReadBeforeAssign: false },
        ],
        'prefer-regex-literals': [
          'error',
          { disallowRedundantWrapping: true },
        ],
        'symbol-description': 'error',
        'unicode-bom': ['error', 'never'],
        'use-isnan': [
          'error',
          { enforceForSwitchCase: true, enforceForIndexOf: true },
        ],
        'valid-typeof': ['error', { requireStringLiterals: true }],
        'yoda': ['error', 'never'],
      },
    },
    {
      files: ['**/*.{test,spec}.{ts,tsx,js,jsx}'],
      rules: {
        'no-console': 'off',
        'max-nested-callbacks': ['error', { max: 4 }],
        'max-lines': [
          'error',
          { max: 900, skipBlankLines: true, skipComments: true },
        ],
      },
    },
    {
      files: props.entrypointFiles,
      rules: {
        'no-console': 'off',
      },
    },
    {
      files: ['**/*.config.{js,mjs,ts}'],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
  ]);
}
