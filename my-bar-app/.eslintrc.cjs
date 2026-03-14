/**
 * ESLint Configuration
 * Enforces code quality and consistency standards
 */

module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['react', 'react-hooks'],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // React Rules
    'react/prop-types': 'warn',
    'react/jsx-no-target-blank': 'error',
    'react/jsx-key': 'error',
    'react/no-unescaped-entities': 'warn',
    'react/display-name': 'off',

    // React Hooks Rules
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // General JavaScript Rules
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    'brace-style': ['error', '1tbs'],
    'indent': ['error', 2, { SwitchCase: 1 }],
    'quotes': ['error', 'single', { avoidEscape: true }],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'always-multiline'],
    'no-trailing-spaces': 'error',
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'arrow-spacing': 'error',
    'keyword-spacing': 'error',
    'space-before-blocks': 'error',
    'space-infix-ops': 'error',

    // Performance
    'no-await-in-loop': 'warn',
    'prefer-template': 'warn',

    // Security
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
  },
  overrides: [
    {
      files: ['*.test.js', '*.test.jsx', 'tests/**/*.js'],
      env: {
        jest: true,
      },
      rules: {
        'no-unused-vars': 'off',
        'no-console': 'off',
      },
    },
    {
      files: ['src/utils/healthCheck.js'],
      rules: {
        'no-console': 'off',
        'no-await-in-loop': 'off',
      },
    },
    {
      files: ['tests/load-test-*.js'],
      globals: {
        __ENV: 'readonly',
        check: 'readonly',
        sleep: 'readonly',
        group: 'readonly',
      },
      rules: {
        'no-console': 'off',
        'no-unused-vars': 'off',
      },
    },
  ],
};
