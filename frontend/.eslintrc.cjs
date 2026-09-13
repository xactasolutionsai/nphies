module.exports = {
  root: true,
  env: { browser: true, node: true, es2022: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['react-hooks'],
  ignorePatterns: ['dist/', 'node_modules/'],
  rules: { 'no-undef': 'error', 'no-unreachable': 'error', 'no-dupe-class-members': 'error' }
};
