// eslint.config.js
const LitertEslintRules = require('@litert/eslint-plugin-rules');

module.exports = [
    ...LitertEslintRules.configs.typescript,
    {
        files: [
            'src/lib/**/*.ts',
        ],
        languageOptions: {
            parserOptions: {
                project: 'tsconfig.json',
                tsconfigRootDir: __dirname,
            },
        }
    },
];
