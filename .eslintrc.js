module.exports = {
  env: {
    browser: true,
    es2021: true,
    webextensions: true,
    node: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    // General rules
    'no-console': 'warn',
    'no-unused-vars': 'warn',
    'no-undef': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    
    // Code style
    'indent': ['error', 2],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    
    // Best practices
    'eqeqeq': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-self-compare': 'error',
    'no-sequences': 'error',
    'no-throw-literal': 'error',
    'no-unmodified-loop-condition': 'error',
    'no-unused-expressions': 'error',
    'no-useless-call': 'error',
    'no-useless-concat': 'error',
    'no-useless-return': 'error',
    'radix': 'error',
    'wrap-iife': 'error',
    'yoda': 'error',
    
    // Chrome Extension specific
    'no-restricted-globals': [
      'error',
      {
        'name': 'chrome',
        'message': 'Use chrome.* APIs properly'
      }
    ]
  },
  globals: {
    // Chrome Extension APIs
    'chrome': 'readonly',
    'browser': 'readonly',
    
    // Test globals
    'describe': 'readonly',
    'it': 'readonly',
    'expect': 'readonly',
    'beforeEach': 'readonly',
    'afterEach': 'readonly'
  },
  overrides: [
    {
      // Node.js scripts
      files: ['scripts/**/*.js'],
      env: {
        node: true,
        browser: false
      }
    },
    {
      // Test files
      files: ['tests/**/*.js'],
      env: {
        jest: true
      }
    }
  ]
};
