const {execFileSync} = require('child_process');
const {expect} = require('chai');
const _ = require('lodash/fp');

const SCOPE = 'self'; // (for test purpose only, relying the the eslint-plugin-self for tests)
const scoped = rule => `${SCOPE}/${rule}`;

function getLintResults(filename) {
    try {
        const results = execFileSync('eslint', ['--format', 'json', filename], {
            encoding: 'utf8',
            stdio: 'pipe',
            cwd: __dirname
        });
        return JSON.parse(results)[0];
    } catch (err) {
        if (err.status !== 1 && err.status !== 0) {
            throw new Error(`The lint command itself failed: ${err.status}, ${err.message}`);
        }
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
    const allExpectedErrors = expected.map(
        _.pipe(
            _.split(':'),
            _.head,
            scoped
        )
    );
    expect(_.xor(_.keys(actualSituation), allExpectedErrors)).to.have.length(
        0,
        'Extra errors found'
    );
}

function validateFile(filename, expected = {}) {
    const results = getLintResults(`samples/${filename}.json`);
    const resultIndex = groupInfringementsByRules(results);
    validateInfringementExpectation(expected.errors, resultIndex.errors);
    validateInfringementExpectation(expected.warnings, resultIndex.warnings);

    if (expected.errorCount !== undefined)
        expect(results.errorCount).to.equal(expected.errorCount, 'invalid count of errors');
    if (expected.warningCount !== undefined)
        expect(results.warningCount).to.equal(expected.warningCount, 'invalid counr of warnings');
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
});
