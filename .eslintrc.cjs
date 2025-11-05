module.exports = {
    root: true,
    env: {
        browser: true,
        es2020: true,
        node: true, // For your backend/electron/build files
    },
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react-hooks/recommended',
        'plugin:prettier/recommended', // This must be LAST. It enables prettier.
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
    },
    plugins: [
        '@typescript-eslint', // Already specified, but good to be explicit
        'react-refresh',
    ],
    rules: {
        'react-refresh/only-export-components': 'warn',
        '@typescript-eslint/no-explicit-any': 'off',
    },
    ignorePatterns: [
        'dist',
        '.dist',
        'dist/package',
        'node_modules',
        'build.mjs', // Ignore our new build script
        '*.tsbuildinfo', // Ignore TypeScript cache files
    ],
};
