const {execFileSync} = require('child_process');
const {expect} = require('chai');
const _ = require('lodash/fp');

const SCOPE = 'self'; // (for test purpose only, relying the the eslint-plugin-self for tests)
const scoped = rule => `${SCOPE}/${rule}`;

function getLintResults(filename, eslintConfig) {
    try {
        const results = execFileSync(
            'eslint',
            ['--config', eslintConfig || 'custom.eslintrc.json', '--format', 'json', filename],
            {
                encoding: 'utf8',
                stdio: 'pipe',
                cwd: __dirname
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

function validateFile(filename, config = {}) {
    const results = getLintResults(`samples/${filename}.json`, config.eslintrc);
    const resultIndex = groupInfringementsByRules(results);
    validateInfringementExpectation(config.errors, resultIndex.errors);
    validateInfringementExpectation(config.warnings, resultIndex.warnings);

    if (config.errorCount !== undefined)
        expect(results.errorCount).to.equal(config.errorCount, 'invalid count of errors');
    if (config.warningCount !== undefined)
        expect(results.warningCount).to.equal(config.warningCount, 'invalid counr of warnings');
}

describe('Integrations tests', function() {
    it('validate correct json', function() {
        validateFile('good-json', {errorCount: 0, warningCount: 0});
    });
    it('detect duplicate keys', function() {
        validateFile('duplicate-keys', {
            errors: ['duplicate-key:2']
        }); // FIXME: give error count!
    });
    it('handle comments in json', function() {
        validateFile('json-with-comments', {errorCount: 0, warningCount: 0});
    });
    it('detect wrong syntax', function() {
        validateFile('wrong-syntax', {errorCount: 1, warningCount: 0});
    });
    it('detect many infrigement in messy json', function() {
        validateFile('whole-mess', {
            errors: ['duplicate-key:2', 'trailing-comma'],
            warnings: ['*']
        });
    });
    it('indentation', function() {
        validateFile('indent', {errorCount: 11, warningCount: 0});
    });
});

describe('Integrations tests with config', function() {
    describe('recommended', function() {
        it('detect many infrigement in messy json', function() {
            validateFile('whole-mess', {
                eslintrc: '.eslintrc.with-recommended-config.json',
                errors: ['*:4']
            });
        });

        it('handle comments in json', function() {
            validateFile('json-with-comments', {
                eslintrc: '.eslintrc.with-recommended-config.json',
                errorCount: 1 // comment-not-permitted under the '*' glob
            });
        });
    });
    describe('recommended-with-comments', function() {
        it('detect many infrigement in messy json', function() {
            validateFile('whole-mess', {
                eslintrc: '.eslintrc.with-recommended-comments-config.json',
                errors: ['*:3']
            });
        });

        it('handle comments in json', function() {
            validateFile('json-with-comments', {
                eslintrc: '.eslintrc.with-recommended-comments-config.json',
                errorCount: 0,
                warningCount: 0
            });
        });
    });
});
