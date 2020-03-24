const _ = require('lodash/fp');
const jsonService = require('vscode-json-languageservice');

const jsonServiceHandle = jsonService.getLanguageService({});

const ErrorCodes = {
    Undefined: 0,
    EnumValueMismatch: 1,
    UnexpectedEndOfComment: 0x101,
    UnexpectedEndOfString: 0x102,
    UnexpectedEndOfNumber: 0x103,
    InvalidUnicode: 0x104,
    InvalidEscapeCharacter: 0x105,
    InvalidCharacter: 0x106,
    PropertyExpected: 0x201,
    CommaExpected: 0x202,
    ColonExpected: 0x203,
    ValueExpected: 0x204,
    CommaOrCloseBacketExpected: 0x205,
    CommaOrCloseBraceExpected: 0x206,
    TrailingComma: 0x207,
    DuplicateKey: 0x208,
    CommentNotPermitted: 0x209,
    SchemaResolveError: 0x300
};

const AllErrorCodes = _.values(ErrorCodes);
const AllowComments = 'allowComments';

const fileLintResults = {};
const fileComments = {};
const fileDocuments = {};
const fileLengths = {};

const getSignature = problem =>
    `${problem.range.start.line} ${problem.range.start.character} ${problem.message}`;

function getDiagnostics(jsonDocument) {
    return _.pipe(
        _.map(problem => [getSignature(problem), problem]),
        _.reverse, // reverse ensure fromPairs keep first signature occurence of problem
        _.fromPairs
    )(jsonDocument.syntaxErrors);
}
const reportError = filter => (errorName, context) => {
    _.filter(filter, fileLintResults[context.getFilename()]).forEach(error => {
        context.report({
            ruleId: `json/${errorName}`,
            message: error.message,
            loc: {
                start: {line: error.range.start.line + 1, column: error.range.start.character},
                end: {line: error.range.end.line + 1, column: error.range.end.character}
            }
            // later: see how to add fix
        });
    });
};
const reportComment = (errorName, context) => {
    const ruleOption = _.head(context.options);
    if (ruleOption === AllowComments || _.get(AllowComments, ruleOption)) return;

    _.forEach(comment => {
        context.report({
            ruleId: errorName,
            message: 'Comment not allowed',
            loc: {
                start: {line: comment.start.line + 1, column: comment.start.character},
                end: {line: comment.end.line + 1, column: comment.end.character}
            }
        });
    }, fileComments[context.getFilename()]);
};

const makeRule = (errorName, reporters) => ({
    create(context) {
        return {
            Program() {
                _.flatten([reporters]).map(reporter => reporter(errorName, context));
            }
        };
    }
});

const rules = _.pipe(
    _.mapKeys(_.kebabCase),
    _.toPairs,
    _.map(([errorName, errorCode]) => [
        errorName,
        makeRule(
            errorName,
            reportError(err => err.code === errorCode)
        )
    ]),
    _.fromPairs,
    _.assign({
        '*': makeRule('*', [reportError(_.constant(true)), reportComment]),
        json: makeRule('json', [reportError(_.constant(true)), reportComment]),
        unknown: makeRule('unknown', reportError(_.negate(AllErrorCodes.includes))),
        'comment-not-permitted': makeRule('comment-not-permitted', reportComment)
    })
)(ErrorCodes);

const errorSignature = err =>
    ['message', 'line', 'column', 'endLine', 'endColumn'].map(field => err[field]).join('::');

const getErrorCode = _.pipe(_.get('ruleId'), _.split('/'), _.last);

const preprocessorPlaceholder = '___';
const preprocessorTemplate = `JSON.stringify(${preprocessorPlaceholder})`;

function mapFix(fix, fileLength, prefixLength, suffix) {
    let text = fix.text;
    // We have to map the fix in such a way, that we account for the removed prefix and suffix.
    let range = fix.range.map(location => location - prefixLength);
    // For the suffix we have three cases:
    // 1) The fix ends before the suffix => nothing left to do
    if (range[0] >= fileLength + suffix.length) {
        // 2) The fix starts after the suffix (for example concerning the last line break)
        range = range.map(location => location - suffix.length);
    } else if (range[1] >= fileLength) {
        // 3) The fix intersects the suffix
        range[1] = Math.max(range[1] - suffix.length, fileLength);
        // in that case we have to delete the suffix also from the fix text.
        const suffixPosition = text.lastIndexOf(suffix);
        if (suffixPosition >= 0) {
            text = text.slice(0, suffixPosition) + text.slice(suffixPosition + suffix.length);
        }
    }
    return {range, text};
}

const processors = {
    '.json': {
        preprocess: function(text, fileName) {
            const textDocument = jsonService.TextDocument.create(fileName, 'json', 1, text);
            fileDocuments[fileName] = textDocument;
            const parsed = jsonServiceHandle.parseJSONDocument(textDocument);
            fileLintResults[fileName] = getDiagnostics(parsed);
            fileComments[fileName] = parsed.comments;

            const [, eol = ''] = text.match(/([\n\r]*)$/);
            fileLengths[fileName] = text.length - eol.length;
            return [
                preprocessorTemplate.replace(
                    preprocessorPlaceholder,
                    text.slice(0, fileLengths[fileName])
                ) + eol
            ];
        },
        postprocess: function(messages, fileName) {
            const textDocument = fileDocuments[fileName];
            const fileLength = fileLengths[fileName];
            delete fileLintResults[fileName];
            delete fileComments[fileName];

            const prefixLength = preprocessorTemplate.indexOf(preprocessorPlaceholder);
            const suffix = preprocessorTemplate.slice(
                prefixLength + preprocessorPlaceholder.length
            );

            return _.pipe(
                _.first,
                _.groupBy(errorSignature),
                _.mapValues(errors => {
                    if (errors.length === 1) return _.first(errors);
                    // Otherwise there is two errors: the generic and specific one
                    // json/* or json/json and json/some-code
                    const firstErrorCode = getErrorCode(errors[0]);
                    const isFirstGeneric = ['*', 'json'].includes(firstErrorCode);
                    const genericError = errors[isFirstGeneric ? 0 : 1];
                    const specificError = errors[isFirstGeneric ? 1 : 0];
                    return genericError.severity > specificError.severity
                        ? genericError
                        : specificError;
                }),
                _.mapValues(error => {
                    const source = textDocument.getText({
                        start: {line: error.line - 1, character: error.column},
                        end: {line: error.endLine - 1, character: error.endColumn}
                    });
                    return _.assign(error, {
                        source,
                        column: error.column + 1,
                        endColumn: error.endColumn + 1
                    });
                }),
                _.mapValues(error => {
                    if (_.startsWith('json/', error.ruleId)) return error;

                    const newError = _.assign(error, {
                        column: error.column - (error.line === 1 ? prefixLength : 0),
                        endColumn: error.endColumn - (error.endLine === 1 ? prefixLength : 0)
                    });
                    if (error.fix) {
                        newError.fix = mapFix(error.fix, fileLength, prefixLength, suffix);
                    }

                    return newError;
                }),
                _.values
            )(messages);
        },
        supportsAutofix: true
    }
};

const configs = {
    recommended: {
        plugins: ['json'],
        rules: {
            'json/*': 'error'
        }
    },
    'recommended-with-comments': {
        plugins: ['json'],
        rules: {
            'json/*': ['error', {allowComments: true}]
        }
    }
};

module.exports = {rules, configs, processors};
