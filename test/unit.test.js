const plugin = require('../src');
const {assert} = require('chai');
const _ = require('lodash/fp');

describe('plugin', function() {
    describe('structure', function() {
        it('should contain processors object', function() {
            assert.property(plugin, 'processors', '.processors property is not defined');
        });
        it('should contain .json property', function() {
            assert.property(plugin.processors, '.json', '.json property is not defined');
        });
        it('should contain .json.preprocess property', function() {
            assert.property(
                plugin.processors['.json'],
                'preprocess',
                '.json.preprocess is not defined'
            );
        });
        it('should contain .json.postprocess property', function() {
            assert.property(
                plugin.processors['.json'],
                'postprocess',
                '.json.postprocess is not defined'
            );
        });
    });
    describe('preprocess', function() {
        const preprocess = plugin.processors['.json'].preprocess;
        it('should contain the text', function() {
            const fileName = 'whatever-the-name.js';

            const text = 'whatever';
            const newText = preprocess(text, fileName);
            assert.isArray(newText, 'preprocess should return array');
            assert.include(newText[0], text);
        });
    });
    describe('postprocess', function() {
        const preprocess = plugin.processors['.json'].preprocess;
        const postprocess = plugin.processors['.json'].postprocess;

        const messageErrorFieldFromContextError = {
            ruleId: _.get('ruleId'),
            severity: _.getOr(1, 'severity'),
            message: _.get('message'),
            line: _.get('loc.start.line'),
            column: _.get('loc.start.column'),
            nodeType: _.getOr(null, 'nodeType'),
            endLine: _.get('loc.end.line'),
            endColumn: _.get('loc.end.column')
        };
        const convertContextErrorToMessageError = err =>
            _.mapValues(extractor => extractor(err), messageErrorFieldFromContextError);
        const fakeApplyRule = rules => file => {
            const errors = [];
            rules.forEach(rule => {
                const xxx = rule.create({
                    getFilename() {
                        return file;
                    },
                    report(err) {
                        errors.push(err);
                    }
                });
                xxx.Program();
            });
            return [errors.map(convertContextErrorToMessageError)];
        };

        const singleQuotes = {
            fileName: 'singleQuotes.json',
            text: "{'x': 0}"
        };
        const trailingCommas = {
            fileName: 'trailing.json',
            text: '{ "x": 0, }'
        };
        const multipleErrors = {
            fileName: 'multipleErrors.json',
            text: "{ x: 200, 'what': 0 }"
        };
        const trailingText = {
            fileName: 'trailingtext.json',
            text: '{ "my_string": "hello world" }' + ' \n' + 'bad_text'
        };

        const good = {
            fileName: 'good.json',
            text: JSON.stringify({a: [1, 2, 3], b: 'cat', c: {x: 1}})
        };

        const rules = ['undefined', 'trailing-comma'];
        const lintFile = fakeApplyRule(rules.map(rule => plugin.rules[rule]));
        const samples = [singleQuotes, trailingCommas, multipleErrors, trailingText, good];
        samples.forEach(sample => {
            sample.text = preprocess(sample.text, sample.fileName)[0];
        });

        const errorsByFile = _.fromPairs(
            samples.map(sample => [sample.fileName, lintFile(sample.fileName)])
        );

        it('should return an error for the single quotes', function() {
            const errors = postprocess(errorsByFile[singleQuotes.fileName], singleQuotes.fileName);
            assert.isArray(errors, 'should return an array');
            assert.lengthOf(errors, 1, 'should return one error');

            const error = errors[0];
            assert.strictEqual(error.ruleId, 'json/undefined', 'should have a string ID');
            assert.strictEqual(error.severity, 1, 'should have a numeric severity');
            assert.strictEqual(
                error.message,
                'Property keys must be doublequoted',
                'should have a message'
            );
            assert.strictEqual(error.line, 1, 'should point to first line');
            assert.strictEqual(error.column, 2, 'should point to second character');
        });

        it('should return an error for trailing commas', function() {
            const errors = postprocess(
                errorsByFile[trailingCommas.fileName],
                trailingCommas.fileName
            );
            assert.isArray(errors, 'should return an array');
            assert.lengthOf(errors, 1, 'should return one error');

            const error = errors[0];
            assert.strictEqual(error.ruleId, 'json/trailing-comma', 'should have a string ID');
            assert.strictEqual(error.line, 1, 'should point to the first line');
            assert.strictEqual(error.column, 9, 'should point to the 9th character');
        });

        it('should report unrecoverable syntax error', function() {
            const errors = postprocess(errorsByFile[trailingText.fileName], trailingText.fileName);
            assert.isArray(errors, 'should return an array');
            assert.lengthOf(errors, 1, 'should return one error');
            assert.isString(errors[0].message, 'should have a valid message');

            // we don't validate the line/column numbers since they don't actually
            // mean anything for this error. JSHint just bails on the file.
        });

        it('should return multiple errors for multiple errors', function() {
            const errors = postprocess(
                errorsByFile[multipleErrors.fileName],
                multipleErrors.fileName
            );
            assert.isArray(errors, 'should return an array');
            assert.lengthOf(errors, 2, 'should return one error');
        });

        it('should return no errors for good json', function() {
            const errors = postprocess(errorsByFile[good.fileName], good.fileName);
            assert.isArray(errors, 'should return an array');
            assert.lengthOf(errors, 0, 'good json shouldnt have any errors');
        });
    });
});
