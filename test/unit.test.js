const plugin = require('../src');
const {expect} = require('chai');
const _ = require('lodash/fp');

const {execFileSync} = require('child_process');

describe('plugin', function () {
    describe('structure', function () {
        it('should contain processors object', function () {
            expect(plugin, '.processors property is not defined').to.have.property('processors');
        });
        it('should contain .json property', function () {
            expect(plugin.processors, '.json property is not defined').to.have.property('.json');
        });
        it('should contain .json.preprocess property', function () {
            expect(plugin.processors['.json'], '.json.preprocess is not defined').to.have.property(
                'preprocess'
            );
        });
        it('should contain .json.postprocess property', function () {
            expect(plugin.processors['.json'], '.json.postprocess is not defined').to.have.property(
                'postprocess'
            );
        });
    });
    describe('preprocess', function () {
        const preprocess = plugin.processors['.json'].preprocess;
        it('should return the same text', function () {
            const fileName = 'whatever-the-name.js';
            const newText = preprocess('whatever', fileName);
            expect(newText, 'preprocess should return array').to.be.an('array');
            expect(newText[0]).equal('');
        });
    });
    describe('postprocess', function () {
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
            endColumn: _.get('loc.end.column'),
        };
        const convertContextErrorToMessageError = (err) =>
            _.mapValues((extractor) => extractor(err), messageErrorFieldFromContextError);
        const fakeApplyRule = (rules) => (file) => {
            const errors = [];
            rules.forEach((rule) => {
                const xxx = rule.create({
                    getFilename() {
                        return file;
                    },
                    report(err) {
                        errors.push(err);
                    },
                });
                xxx.Program();
            });
            return [errors.map(convertContextErrorToMessageError)];
        };

        const singleQuotes = {
            fileName: 'singleQuotes.json',
            text: "{'x': 0}",
        };
        const trailingCommas = {
            fileName: 'trailing.json',
            text: '{ "x": 0, }',
        };
        const multipleErrors = {
            fileName: 'multipleErrors.json',
            text: "{ x: 200, 'what': 0 }",
        };
        const trailingText = {
            fileName: 'trailingtext.json',
            text: '{ "my_string": "hello world" }' + ' \n' + 'bad_text',
        };

        const good = {
            fileName: 'good.json',
            text: JSON.stringify({a: [1, 2, 3], b: 'cat', c: {x: 1}}),
        };

        const rules = ['undefined', 'trailing-comma'];
        const lintFile = fakeApplyRule(rules.map((rule) => plugin.rules[rule]));
        const samples = [singleQuotes, trailingCommas, multipleErrors, trailingText, good];
        samples.forEach((sample) => preprocess(sample.text, sample.fileName));

        const errorsByFile = _.fromPairs(
            samples.map((sample) => [sample.fileName, lintFile(sample.fileName)])
        );

        it('should return an error for the single quotes', function () {
            const errors = postprocess(errorsByFile[singleQuotes.fileName], singleQuotes.fileName);
            expect(errors, 'should return an array').to.be.an('array');
            expect(errors.length).to.equal(1, 'should return one error');

            const error = errors[0];
            expect(error.ruleId).to.equal('json/undefined', 'should have a string ID');
            expect(error.severity).to.equal(1, 'should have a numeric severity');
            expect(error.message).to.equal(
                'Property keys must be doublequoted',
                'should have a message'
            );
            expect(error.line).to.equal(1, 'should point to first line');
            expect(error.column).to.equal(2, 'should point to second character');
        });

        it('should return an error for trailing commas', function () {
            const errors = postprocess(
                errorsByFile[trailingCommas.fileName],
                trailingCommas.fileName
            );
            expect(errors, 'should return an array').to.be.an('array');
            expect(errors.length).to.equal(1, 'should return one error');

            const error = errors[0];
            expect(error.ruleId).to.equal('json/trailing-comma', 'should have a string ID');
            expect(error.line).to.equal(1, 'should point to the first line');
            expect(error.column).to.equal(9, 'should point to the 9th character');
        });

        it('should report unrecoverable syntax error', function () {
            const errors = postprocess(errorsByFile[trailingText.fileName], trailingText.fileName);
            expect(errors, 'should return an array').to.be.an('array');
            expect(errors.length).to.equal(1, 'should return one error');
            expect(errors[0].message, 'should have a valid message').to.be.a('string');

            // we don't validate the line/column numbers since they don't actually
            // mean anything for this error. JSHint just bails on the file.
        });

        it('should return multiple errors for multiple errors', function () {
            const errors = postprocess(
                errorsByFile[multipleErrors.fileName],
                multipleErrors.fileName
            );
            expect(errors, 'should return an array').to.be.an('array');
            expect(errors.length).to.equal(2, 'should return two error');
        });

        it('should return no errors for good json', function () {
            const errors = postprocess(errorsByFile[good.fileName], good.fileName);
            expect(errors, 'should return an array').to.be.an('array');
            expect(errors.length).to.equal(0, "good json shouldn't have any errors");
        });
    });
});

const SCOPE = 'self'; // (for test purpose only, relying the the eslint-plugin-self for tests)
const scoped = (rule) => `${SCOPE}/${rule}`;

function getLintResults(filename, eslintConfig) {
    try {
        const results = execFileSync(
            'eslint',
            [
                '--config',
                eslintConfig || 'custom.eslintrc-legacy.json',
                '--format',
                'json',
                filename,
            ],
            {
                encoding: 'utf8',
                stdio: 'pipe',
                cwd: __dirname,
            }
        );
        return JSON.parse(results)[0];
    } catch (err) {
        if (err.status !== 1 && err.status !== 0)
            throw new Error(`The lint command itself failed: ${err.status}, ${err.message}`);
        return JSON.parse(err.stdout)[0];
    }
}

function groupInfringementsByRules(fileResults) {
    const errors = {};
    const warnings = {};
    for (const infringement of fileResults.messages) {
        const counter = infringement.severity === 1 ? warnings : errors;
        counter[infringement.ruleId] = (counter[infringement.ruleId] || 0) + 1;
    }
    return {errors, warnings};
}
function validateInfringementExpectation(expected, actualSituation) {
    if (_.isEmpty(expected)) return;
    for (const someExpected of expected || []) {
        const [rule, expectedCount] = someExpected.split(':');
        if (expectedCount)
            expect(actualSituation[scoped(rule)]).to.equal(
                Number(expectedCount),
                `unexpected count of rule ${rule}`
            );
        else expect(actualSituation).to.have.property(scoped(rule));
    }
    const allExpectedErrors = expected.map(_.pipe(_.split(':'), _.head, scoped));
    expect(_.xor(_.keys(actualSituation), allExpectedErrors)).to.have.length(
        0,
        'Extra errors found'
    );
}

function validateFile(filename, expectations = {}) {
    const results = getLintResults(`samples/${filename}.json`, expectations.eslintrc);
    const resultIndex = groupInfringementsByRules(results);
    validateInfringementExpectation(expectations.errors, resultIndex.errors, 'errors');
    validateInfringementExpectation(expectations.warnings, resultIndex.warnings, 'warnings');

    if (expectations.errorCount !== undefined)
        expect(results.errorCount).to.equal(expectations.errorCount, 'invalid count of errors');
    if (expectations.warningCount !== undefined)
        expect(results.warningCount).to.equal(
            expectations.warningCount,
            'invalid count of warnings'
        );
}

describe('Rules', function () {
    this.slow(3000);
    this.timeout(5000);
    it('validate correct json', function () {
        validateFile('good-json', {errorCount: 0, warningCount: 0});
    });
    it('detect duplicate keys', function () {
        validateFile('duplicate-keys', {
            errors: ['duplicate-key:2'],
        }); // FIXME: give error count!
    });
    it('handle comments in json', function () {
        validateFile('json-with-comments', {errorCount: 0, warningCount: 0});
    });
    it('detect wrong syntax', function () {
        validateFile('wrong-syntax', {errorCount: 1, warningCount: 0});
    });
    it('detect many infringements in messy json', function () {
        validateFile('whole-mess', {
            errors: ['duplicate-key:2', 'trailing-comma'],
            warnings: ['*'],
        });
    });
});

describe('Rules with config', function () {
    this.slow(3000);
    this.timeout(5000);
    describe('recommended', function () {
        it('detect many infringements in messy json', function () {
            validateFile('whole-mess', {
                eslintrc: '.eslintrc.with-recommended-legacy-config.json',
                errors: ['*:4'],
            });
        });

        it('handle comments in json', function () {
            validateFile('json-with-comments', {
                eslintrc: '.eslintrc.with-recommended-legacy-config.json',
                errorCount: 1, // comment-not-permitted under the '*' glob
            });
        });
    });
    describe('recommended-with-comments', function () {
        it('detect many infringements in messy json', function () {
            validateFile('whole-mess', {
                eslintrc: '.eslintrc.with-recommended-comments-legacy-config.json',
                errors: ['*:3'],
            });
        });

        it('handle comments in json', function () {
            validateFile('json-with-comments', {
                eslintrc: '.eslintrc.with-recommended-comments-legacy-config.json',
                errorCount: 0,
                warningCount: 0,
            });
        });
    });
});
