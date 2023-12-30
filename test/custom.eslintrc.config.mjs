import json from '../src/index.js';

export default [
    {
        files: ['**/*.json'],
        plugins: {json},
        processor: 'json/json',
        rules: {
            'json/*': 'warn',
            'json/duplicate-key': 'error',
            'json/trailing-comma': 'error',
        },
    },
    {
        files: ['samples/json-with-comments.json'],
        plugins: {json},
        rules: {
            'json/*': ['warn', {allowComments: true}],
        },
    },
    {
        files: ['samples/wrong-syntax.json'],
        plugins: {json},
        rules: {
            'json/*': 'error',
        },
    },
];
