module.exports = {
    extends: [
        'airbnb-base',
    ],
    parser: '@babel/eslint-parser',
    parserOptions: {
        requireConfigFile: false,
    },
    env: {
        browser: false,
        node: true,
        jest: true,
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
        'import/prefer-default-export': 'off',
        'arrow-body-style': 'off',
        'import/no-extraneous-dependencies': 'off',
    },
};
