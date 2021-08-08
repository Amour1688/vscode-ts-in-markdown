module.exports = {
  root: true,
  files: ['*.ts', '*.tsx'],
  parserOptions: {
    ecmaVersion: 2020,
    project: ['./tsconfig.json'],
  },
  env: {
    browser: true,
    node: true,
    jest: true,
    es6: true,
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'airbnb-typescript/base',
  ],
  rules: {
    'import/prefer-default-export': [0],
    '@typescript-eslint/no-use-before-define': [0],
    'max-len': [0],
    'consistent-return': [0],
    'no-plusplus': [0],
    'no-restricted-syntax': [0],
    'import/no-extraneous-dependencies': [0],
    'default-case': [0]
  }
};
