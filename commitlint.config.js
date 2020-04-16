module.exports = {
    'extends': ['@commitlint/config-conventional'],
    'defaultIgnores': false,
    'rules': {
        'type-enum': [2, 'always', [
            'feat',
            'fix',
            'add',
            'test',
            'refactor',
            'perf',
            'style',
            'config',
            'merge'
        ]],
        'scope-enum': [2, 'always', [
            'client',
            'api',
            'hook',
            'docs',
            'lint',
            'branch',
            'global'
        ]],
        'scope-empty': [2, 'never'],
        'subject-min-length': [2, 'always', 5],
        'subject-max-length': [2, 'always', 50],
    }
};
