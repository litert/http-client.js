export default {
    'extends': ['@commitlint/config-conventional'],
    'defaultIgnores': false,
    'rules': {
        'type-enum': [2, 'always', [
            'fix',
            'feat',
            'test',
            'deprecate',
            'build',
            'chore',
            'doc',
            'lint',
            'refactor',
        ]],
        'scope-enum': [2, 'always', [
            'client',
            'filters',
        ]],
        'scope-case': [2, 'always', {
            'cases': ['lower-case'],
            'delimiters': [':'],
        }],
        'scope-empty': [0, 'never'],
        'subject-min-length': [2, 'always', 5],
        'subject-max-length': [2, 'always', 50],
    }
};
