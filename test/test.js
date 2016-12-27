
var plugin = require('../lib/index.js');
var assert = require('chai').assert;

describe('plugin', function() {
    describe('structure', function() {
        it('should contain processors object', function() {
            assert.property(plugin, 'processors', '.processors property is not defined');
        });
        it('should contain .json property', function() {
            assert.property(plugin.processors, '.json', '.json property is not defined');
        });
        it('should contain .json.preprocess property', function() {
            assert.property(plugin.processors['.json'], 'preprocess',
                '.json.preprocess is not defined');
        });
        it('should contain .json.postprocess property', function() {
            assert.property(plugin.processors['.json'], 'postprocess',
                '.json.postprocess is not defined');
        });
    });
    describe('preprocess', function() {
        var preprocess = plugin.processors['.json'].preprocess;
        it('should return the json rewritten to js', function() {
            var fileName = 'reallyLongFileName';
            var text = '{"content": "long long text"}';
            var expected = '/* global: fakeObject */\n' +
                           'fakeObject = ' +
                           text;

            var newText = preprocess(text, fileName);
            assert.isArray(newText, 'preprocess should return array');
            assert.strictEqual(newText[0], expected);
        });
    });
    describe('postprocess', function() {
        var postprocess = plugin.processors['.json'].postprocess;
        it('should flatten messages', function() {
            var messages = [
                [{ error: 1 }, { error: 2 }],
                [{ error: 3 }, { error: 4 }]
            ]
            var errors = postprocess(messages, 'some-filename.json');
            assert.isArray(errors, 'should return an array');
            assert.lengthOf(errors, 4, 'should flatten messages');
            assert.deepEqual(errors, [
                { error: 1 },
                { error: 2 },
                { error: 3 },
                { error: 4 },
            ]);
        });
    });
});
