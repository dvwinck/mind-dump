import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/', 'coverage/', 'dist/', 'vendor/', '_site/', 'playwright-report/', 'test-results/']
  },
  js.configs.recommended,
  {
    rules: {
      'no-unused-vars': ['error', { caughtErrors: 'none' }]
    }
  },
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      // Bootstrap is vendored and loaded via <script> in index.html
      globals: { ...globals.browser, bootstrap: 'readonly' }
    }
  },
  {
    files: ['service-worker.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'script', globals: globals.serviceworker }
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node, ...globals.vitest }
    }
  },
  {
    files: ['*.config.js', 'e2e/**/*.js', 'e2e/**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node, ...globals.browser } }
  }
];
