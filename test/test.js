
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
        it('should return the same text', function() {
            var fileName = 'reallyLongFileName';
            var text = 'long long text';

            var newText = preprocess(text, fileName);
            assert.isArray(newText, 'preprocess should return array');
            assert.strictEqual(newText[0], text);
        });
    });
    describe('postprocess', function() {
        var preprocess = plugin.processors['.json'].preprocess;
        var postprocess = plugin.processors['.json'].postprocess;
        var singleQuotes = {
            fileName: 'singleQuotes.json',
            text: "{'x': 0}"
        };
        var trailingCommas = {
            fileName: 'trailing.json',
            text: '{ "x": 0, }'
        };
        var multipleErrors = {
            fileName: 'multipleErrors.json',
            text: '{ x: 200, \'what\': 0 }'
        };
        var trailingText = {
            fileName: 'trailingtext.json',
            text: '{ "my_string": "hello world" }' + ' \n' +  'bad_text'
        };

        var good = {
            fileName: 'good.json',
            text: JSON.stringify({ a: [1, 2, 3], b: 'cat', c: {x: 1} })
        };
        preprocess(singleQuotes.text, singleQuotes.fileName);
        preprocess(trailingCommas.text, trailingCommas.fileName);
        preprocess(multipleErrors.text, multipleErrors.fileName);
        preprocess(trailingText.text, trailingText.fileName);
        preprocess(good.text, good.fileName);

        it('should return an error for the single quotes', function() {
            var errors = postprocess([], singleQuotes.fileName);
            assert.isArray(errors, 'should return an array');
            assert.lengthOf(errors, 1, 'should return one error');

            var error = errors[0];
            assert.strictEqual(error.line, 1, 'should point to first line');
            assert.strictEqual(error.column, 2, 'should point to second character');
        });

        it('should return an error for trailing commas', function() {
            var errors = postprocess([], trailingCommas.fileName);
            assert.isArray(errors, 'should return an array');
            assert.lengthOf(errors, 1, 'should return one error');

            var error = errors[0];
            assert.strictEqual(error.line, 1, 'should point to the first line');
            assert.strictEqual(error.column, 9, 'should point to the 9th character');
        });

        it('should report unrecoverable syntax error', function() {
            var errors = postprocess([], trailingText.fileName);
            assert.isArray(errors, 'should return an array');
            assert.lengthOf(errors, 1, 'should return one error');
            assert.isString(errors[0].message, 'should have a valid message');

            // we don't validate the line/column numbers since they don't actually
            // mean anything for this error. JSHint just bails on the file.
        });

        it('should return multiple errors for multiple errors', function() {
            var errors = postprocess([], multipleErrors.fileName);
            assert.isArray(errors, 'should return an array');
            assert.lengthOf(errors, 2, 'should return one error');
        });

        it('should return no errors for good json', function() {
            var errors = postprocess([], good.fileName);
            assert.isArray(errors, 'should return an array');
            assert.lengthOf(errors, 0, 'good json shouldnt have any errors');
        });
    });
});
