module.exports = {
    extends: [
        'airbnb-base',
        'plugin:@typescript-eslint/recommended',
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json',
    },
    plugins: ['@typescript-eslint'],
    env: {
        browser: false,
        node: true,
        jest: true,
    },
    settings: {
        'import/resolver': {
            node: {
                extensions: ['.js', '.ts'],
            },
        },
    },
    rules: {
        'max-len': [
            'error',
            {
                code: 120,
                ignoreUrls: true,
            },
        ],
        indent: ['error', 4, { SwitchCase: 1 }],
        '@typescript-eslint/indent': ['error', 4],
        'import/prefer-default-export': 'off',
        'arrow-body-style': 'off',
        'import/no-extraneous-dependencies': 'off',
        'import/extensions': [
            'error',
            'ignorePackages',
            {
                js: 'never',
                ts: 'never',
            },
        ],
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        'no-useless-constructor': 'off',
        '@typescript-eslint/no-useless-constructor': ['error'],
        'no-empty-function': 'off',
        '@typescript-eslint/no-empty-function': ['error'],
        'lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }],
        'class-methods-use-this': 'off',
        'no-continue': 'off',
        'no-restricted-syntax': 'off',
    },
};
