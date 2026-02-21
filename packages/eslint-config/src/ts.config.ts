import { defineConfig } from 'eslint/config';
import * as typescriptEslint from 'typescript-eslint';

export function buildTsConfig() {
  return defineConfig([
    typescriptEslint.configs.recommendedTypeChecked,
    {
      rules: {
        '@typescript-eslint/adjacent-overload-signatures': 'error',
        '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
        '@typescript-eslint/await-thenable': 'error',
        '@typescript-eslint/ban-ts-comment': [
          'error',
          {
            'ts-expect-error': 'allow-with-description',
            'ts-ignore': true,
            'ts-nocheck': true,
            'ts-check': false,
            'minimumDescriptionLength': 3,
          },
        ],
        '@typescript-eslint/ban-tslint-comment': 'error',
        '@typescript-eslint/class-literal-property-style': ['error', 'fields'],
        '@typescript-eslint/consistent-generic-constructors': [
          'error',
          'constructor',
        ],
        '@typescript-eslint/consistent-indexed-object-style': [
          'error',
          'record',
        ],
        '@typescript-eslint/consistent-type-assertions': [
          'error',
          {
            assertionStyle: 'as',
            objectLiteralTypeAssertions: 'never',
          },
        ],
        '@typescript-eslint/consistent-type-definitions': 'off',
        '@typescript-eslint/consistent-type-exports': [
          'error',
          { fixMixedExportsWithInlineTypeSpecifier: true },
        ],
        '@typescript-eslint/consistent-type-imports': [
          'error',
          {
            prefer: 'type-imports',
            disallowTypeAnnotations: true,
            fixStyle: 'inline-type-imports',
          },
        ],
        '@typescript-eslint/dot-notation': [
          'error',
          {
            allowKeywords: true,
            allowPrivateClassPropertyAccess: false,
            allowProtectedClassPropertyAccess: false,
            allowIndexSignaturePropertyAccess: false,
          },
        ],
        '@typescript-eslint/max-params': ['error', { max: 4 }],
        '@typescript-eslint/method-signature-style': ['error', 'property'],
        '@typescript-eslint/naming-convention': [
          'error',
          {
            selector: 'default',
            format: ['camelCase'],
            leadingUnderscore: 'allow',
            trailingUnderscore: 'allow',
          },
          {
            selector: 'import',
            format: ['camelCase', 'PascalCase'],
          },
          {
            selector: 'variable',
            format: ['camelCase', 'UPPER_CASE'],
            leadingUnderscore: 'allow',
            trailingUnderscore: 'allow',
          },
          {
            selector: 'typeLike',
            format: ['PascalCase'],
          },
          {
            selector: 'enumMember',
            format: ['PascalCase'],
          },
          {
            selector: 'objectLiteralProperty',
            format: null,
          },
          {
            selector: 'typeProperty',
            format: null,
          },
        ],
        '@typescript-eslint/no-confusing-non-null-assertion': 'error',
        '@typescript-eslint/no-confusing-void-expression': [
          'error',
          { ignoreArrowShorthand: true, ignoreVoidOperator: true },
        ],
        '@typescript-eslint/no-deprecated': 'error',
        '@typescript-eslint/no-dynamic-delete': 'error',
        '@typescript-eslint/no-empty-function': [
          'error',
          { allow: ['arrowFunctions', 'functions', 'methods'] },
        ],
        '@typescript-eslint/no-extraneous-class': [
          'error',
          { allowWithDecorator: true },
        ],
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-import-type-side-effects': 'error',
        '@typescript-eslint/no-invalid-void-type': 'error',
        '@typescript-eslint/no-loop-func': 'error',
        '@typescript-eslint/no-meaningless-void-operator': [
          'error',
          { checkNever: true },
        ],
        '@typescript-eslint/no-misused-promises': 'error',
        '@typescript-eslint/no-misused-spread': 'error',
        '@typescript-eslint/no-mixed-enums': 'error',
        '@typescript-eslint/no-non-null-asserted-nullish-coalescing': 'error',
        '@typescript-eslint/no-non-null-assertion': 'error',
        '@typescript-eslint/no-require-imports': 'error',
        '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
        '@typescript-eslint/no-unnecessary-condition': [
          'error',
          { allowConstantLoopConditions: true },
        ],
        '@typescript-eslint/no-unnecessary-parameter-property-assignment': 'error',
        '@typescript-eslint/no-unnecessary-qualifier': 'error',
        '@typescript-eslint/no-unnecessary-template-expression': 'error',
        '@typescript-eslint/no-unnecessary-type-arguments': 'error',
        '@typescript-eslint/no-unnecessary-type-assertion': 'error',
        '@typescript-eslint/no-unnecessary-type-conversion': 'error',
        '@typescript-eslint/no-unsafe-type-assertion': 'error',
        '@typescript-eslint/no-unused-expressions': [
          'error',
          { allowTaggedTemplates: true, allowShortCircuit: true },
        ],
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
            destructuredArrayIgnorePattern: '^_',
          },
        ],
        '@typescript-eslint/no-use-before-define': [
          'error',
          {
            functions: false,
            classes: false,
            variables: true,
            allowNamedExports: false,
          },
        ],
        '@typescript-eslint/no-useless-constructor': 'error',
        '@typescript-eslint/no-useless-default-assignment': 'error',
        '@typescript-eslint/no-useless-empty-export': 'error',
        '@typescript-eslint/non-nullable-type-assertion-style': 'error',
        '@typescript-eslint/only-throw-error': 'error',
        '@typescript-eslint/prefer-as-const': 'error',
        '@typescript-eslint/prefer-find': 'error',
        '@typescript-eslint/prefer-for-of': 'error',
        '@typescript-eslint/prefer-function-type': 'error',
        '@typescript-eslint/prefer-includes': 'error',
        '@typescript-eslint/prefer-literal-enum-member': 'error',
        '@typescript-eslint/prefer-nullish-coalescing': 'error',
        '@typescript-eslint/prefer-optional-chain': 'error',
        '@typescript-eslint/prefer-promise-reject-errors': 'error',
        '@typescript-eslint/prefer-readonly': 'error',
        '@typescript-eslint/prefer-reduce-type-parameter': 'error',
        '@typescript-eslint/prefer-regexp-exec': 'error',
        '@typescript-eslint/prefer-return-this-type': 'error',
        '@typescript-eslint/prefer-string-starts-ends-with': 'error',
        '@typescript-eslint/promise-function-async': 'error',
        '@typescript-eslint/related-getter-setter-pairs': 'error',
        '@typescript-eslint/require-array-sort-compare': 'error',
        '@typescript-eslint/require-await': 'off',
        '@typescript-eslint/restrict-plus-operands': 'error',
        '@typescript-eslint/restrict-template-expressions': [
          'error',
          { allowNumber: true },
        ],
        '@typescript-eslint/return-await': ['error', 'in-try-catch'],
        '@typescript-eslint/strict-boolean-expressions': [
          'error',
          {
            allowString: false,
            allowNumber: false,
            allowNullableObject: true,
            allowNullableBoolean: false,
            allowNullableString: false,
            allowNullableNumber: false,
            allowAny: false,
          },
        ],
        '@typescript-eslint/switch-exhaustiveness-check': [
          'error',
          {
            allowDefaultCaseForExhaustiveSwitch: false,
            requireDefaultForNonUnion: false,
            considerDefaultExhaustiveForUnions: true,
          },
        ],
        '@typescript-eslint/triple-slash-reference': [
          'error',
          { lib: 'never', path: 'never', types: 'never' },
        ],
        '@typescript-eslint/unified-signatures': [
          'error',
          { ignoreDifferentlyNamedParameters: false },
        ],
        '@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',
      },
    },
    {
      files: ['**/*.d.ts'],
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
    {
      files: ['**/*.{test,spec,stories}.{ts,tsx}'],
      rules: {
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/unbound-method': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-unsafe-type-assertion': 'off',
      },
    },
    {
      files: ['**/*.{js,jsx,mjs,cjs}'],
      extends: [typescriptEslint.configs.disableTypeChecked],
    },
  ]);
}
