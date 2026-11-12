// @ts-check
// ESLint flat config. Docs: https://github.com/angular-eslint/angular-eslint
const eslint = require('@eslint/js');
const { defineConfig, globalIgnores } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const noUnsanitized = require('eslint-plugin-no-unsanitized');

module.exports = defineConfig([
  globalIgnores(['dist/', 'coverage/', '.angular/', 'test-results/', 'playwright-report/']),
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
      // Blocks innerHTML/outerHTML/insertAdjacentHTML/document.write with unsanitized data
      // (docs/conventions/security.md). https://github.com/mozilla/eslint-plugin-no-unsanitized
      noUnsanitized.configs.recommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      // No eval-like APIs anywhere (CSP-friendly, security.md).
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  {
    // Mock-up scripts (spec 004): plain browser JS, the same security rules as the app (no innerHTML, no eval).
    files: ['design/**/*.js'],
    extends: [eslint.configs.recommended, noUnsanitized.configs.recommended],
    languageOptions: {
      sourceType: 'script',
      globals: {
        document: 'readonly',
        window: 'readonly',
        location: 'readonly',
        URLSearchParams: 'readonly',
        URL: 'readonly',
      },
    },
    rules: { 'no-eval': 'error', 'no-implied-eval': 'error', 'no-new-func': 'error' },
  },
  {
    files: ['**/*.html'],
    // templateAccessibility: alt text, labels, valid ARIA, no positive tabindex, keyboard
    // handlers for click events, etc. https://angular.dev/best-practices/a11y
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
