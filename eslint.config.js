import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import prettier from 'eslint-config-prettier/flat'
import boundaries from 'eslint-plugin-boundaries'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores([
    'dist',
    'coverage',
    'playwright-report',
    'test-results',
    'artifacts',
  ]),
  {
    files: ['**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      'no-console': 'error',
      'no-debugger': 'error',
    },
  },
  {
    files: ['src/**/*.tsx'],
    extends: [
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
  },
  {
    files: ['src/shared/ui/button.tsx'],
    rules: {
      'react-refresh/only-export-components': [
        'error',
        { allowExportNames: ['buttonVariants'] },
      ],
    },
  },
  {
    files: ['src/{app,pages,entities,shared}/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: { project: './tsconfig.app.json' } },
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app' },
        { type: 'page', pattern: 'src/pages/*' },
        { type: 'entity', pattern: 'src/entities/*' },
        { type: 'shared', pattern: 'src/shared' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              from: { element: { type: 'app' } },
              allow: {
                to: { element: { types: ['page', 'entity', 'shared'] } },
              },
            },
            {
              from: { element: { type: 'page' } },
              allow: { to: { element: { types: ['entity', 'shared'] } } },
            },
            {
              from: { element: { type: 'entity' } },
              allow: { to: { element: { type: 'shared' } } },
            },
          ],
        },
      ],
      'boundaries/no-unknown-files': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/pages/*/*', '@/entities/*/*'],
              message:
                'Import a slice through its public index, or use a relative import inside the slice.',
            },
          ],
        },
      ],
    },
  },
  prettier,
])
