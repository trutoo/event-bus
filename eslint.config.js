import { builtinModules } from 'module';

import jsPlugin from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import importsPlugin from 'eslint-plugin-import';
import sortImportsPlugin from 'eslint-plugin-simple-import-sort';
import unusedImportsPlugin from 'eslint-plugin-unused-imports';
import globals from 'globals';

export default [
  {
    // Blacklisted Folders, including **/node_modules/ and .git/
    ignores: ['dist/'],
  },
  {
    // All files
    files: ['**/*.js', '**/*.cjs', '**/*.mjs', '**/*.jsx', '**/*.ts', '**/*.tsx'],
    plugins: {
      import: importsPlugin,
      'unused-imports': unusedImportsPlugin,
      'simple-import-sort': sortImportsPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
      parserOptions: {
        // Eslint doesn't supply ecmaVersion in `parser.js` `context.parserOptions`
        // This is required to avoid ecmaVersion < 2015 error or 'import' / 'export' error
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    settings: {
      'import/parsers': {
        // Workaround until import supports flat config
        // https://github.com/import-js/eslint-plugin-import/issues/2556
        espree: ['.js', '.cjs', '.mjs', '.jsx'],
      },
    },
    rules: {
      ...jsPlugin.configs.recommended.rules,
      ...importsPlugin.configs.recommended.rules,

      // Imports
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
      'unused-imports/no-unused-imports': ['warn'],
      'import/first': ['warn'],
      'import/newline-after-import': ['warn'],
      'import/no-named-as-default': ['off'],
      'simple-import-sort/exports': ['warn'],
      'lines-between-class-members': ['warn', 'always', { exceptAfterSingleLine: true }],
      'simple-import-sort/imports': [
        'warn',
        {
          groups: [
            // Side effect imports.
            ['^\\u0000'],
            // Node.js builtins, react, and third-party packages.
            [`^(${builtinModules.join('|')})(/|$)`],
            // Path aliased root, parent imports, and just `..`.
            ['^@/', '^\\.\\.(?!/?$)', '^\\.\\./?$'],
            // Relative imports, same-folder imports, and just `.`.
            ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
            // Style imports.
            ['^.+\\.s?css$'],
          ],
        },
      ],
    },
  },
  {
    // TypeScript files
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.lint.json',
      },
    },
    settings: {
      ...importsPlugin.configs.typescript.settings,
      'import/resolver': {
        ...importsPlugin.configs.typescript.settings['import/resolver'],
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
    },
    rules: {
      ...importsPlugin.configs.typescript.rules,
      ...tsPlugin.configs['eslint-recommended'].overrides[0].rules,
      ...tsPlugin.configs.recommended.rules,

      // Typescript Specific
      '@typescript-eslint/no-unused-vars': 'off', // handled by unused-imports
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
    },
  },
  {
    // Prettier Overrides
    files: ['**/*.js', '**/*.cjs', '**/*.mjs', '**/*.jsx', '**/*.ts', '**/*.tsx'],
    rules: {
      ...prettierConfig.rules,
    },
  },
];
