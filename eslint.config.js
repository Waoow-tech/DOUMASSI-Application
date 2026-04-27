// ESLint flat config (ESLint 9+)
// Base : eslint-config-expo (TS-ESLint + React + React Hooks + import + globals RN)
// Voir CLAUDE.md §Conventions de code

const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = defineConfig([
  ...expoConfig,

  {
    rules: {
      // Pas de console.log en prod — utiliser le wrapper logger (cf CLAUDE.md règle 6)
      // console.warn/error tolérés en attendant le wrapper Sentry
      'no-console': ['error', { allow: ['warn', 'error'] }],

      // Ordre des imports : externes → @/ (internal) → relatifs
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          pathGroups: [{ pattern: '@/**', group: 'internal', position: 'before' }],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
    },
  },

  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'android/**',
      'ios/**',
      'dist/**',
      'web-build/**',
      'babel.config.js',
      'metro.config.js',
    ],
  },

  // Désactive toutes les règles ESLint qui conflictent avec Prettier
  // DOIT être en dernier
  eslintConfigPrettier,
]);
