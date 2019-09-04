/**
 * @fileoverview Lint JSON files
 * @author Azeem Bande-Ali
 * @copyright 2015 Azeem Bande-Ali. All rights reserved.
 * See LICENSE file in root directory for full license.
 */

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const jsonService = require('vscode-json-languageservice');
const _ = require('lodash/fp');

const jsonServiceHandle = jsonService.getLanguageService({});

//------------------------------------------------------------------------------
// Plugin Definition
//------------------------------------------------------------------------------

const ErrorCode = {
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

const AllErrorCodes = _.values(ErrorCode);
const AllowComments = 'allowComments';

const fileLintResults = {};
const fileComments = {};
const fileDocuments = {};

function getDiagnostics(jsonDocument) {
    const diagnostics = [];
    const added = {};

    jsonDocument.syntaxErrors.forEach(function(problem) {
        const signature = `${problem.range.start.line} ${problem.range.start.character} ${problem.message}`;
        if (!added[signature]) {
            added[signature] = true;
            diagnostics.push(problem);
        }
    });
    return diagnostics;
}
const reportError = filter => (errorName, context) => {
    const errors = fileLintResults[context.getFilename()];
    errors.filter(filter).forEach(error => {
        context.report({
            ruleId: `json/${errorName}`,
            message: error.message,
            loc: {
                start: {
                    line: error.range.start.line + 1,
                    column: error.range.start.character
                },
                end: {
                    line: error.range.end.line + 1,
                    column: error.range.end.character
                }
            }
            // fix!?
        });
    });
};
const reportComment = (errorName, context) => {
    const ruleOption = _.head(context.options);
    if (ruleOption === AllowComments || _.get(AllowComments, ruleOption)) return;
    fileComments[context.getFilename()].forEach(comment => {
        context.report({
            ruleId: errorName,
            message: 'Comment not allowed',
            loc: {
                start: {
                    line: comment.start.line + 1,
                    column: comment.start.character
                },
                end: {
                    line: comment.end.line + 1,
                    column: comment.end.character
                }
            }
        });
    });
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

module.exports.rules = _.pipe(
    _.mapKeys(_.kebabCase),
    _.toPairs,
    _.map(([errorName, errorCode]) => [
        errorName,
        makeRule(errorName, reportError(err => err.code === errorCode))
    ]),
    _.fromPairs,
    _.assign({
        '*': makeRule('*', [reportError(_.constant(true)), reportComment]),
        json: makeRule('json', [reportError(_.constant(true)), reportComment]),
        unknown: makeRule('unknown', reportError(_.negate(AllErrorCodes.includes))),
        'comment-not-permitted': makeRule('comment-not-permitted', reportComment)
    })
)(ErrorCode);

const errorSignature = err =>
    ['message', 'line', 'column', 'endLine', 'endColumn'].map(field => err[field]).join('::');

module.exports.processors = {
    '.json': {
        preprocess: function(text, fileName) {
            const textDocument = jsonService.TextDocument.create(fileName, 'json', 1, text);
            fileDocuments[fileName] = textDocument;
            const parsed = jsonServiceHandle.parseJSONDocument(textDocument);
            fileLintResults[fileName] = getDiagnostics(parsed);
            fileComments[fileName] = parsed.comments;
            return ['']; // sorry nothing ;)
        },
        postprocess: function(messages, fileName) {
            const textDocument = fileDocuments[fileName];
            delete fileLintResults[fileName];
            delete fileComments[fileName];
            return _.pipe(
                _.first,
                _.groupBy(errorSignature),
                _.mapValues(errors => {
                    if (errors.length === 1) return _.first(errors);
                    // Otherwise there is two errors: the generic and specific one
                    // json/* or json/json and json/some-code
                    const firstErrorCode = _.pipe(
                        _.head,
                        _.get('ruleId'),
                        _.split('/'),
                        _.last
                    )(errors);
                    const isFirstGeneric = ['*', 'json'].includes(firstErrorCode);
                    const genericError = errors[isFirstGeneric ? 0 : 1];
                    const specificError = errors[isFirstGeneric ? 1 : 0];
                    return genericError.severity > specificError.severity
                        ? genericError
                        : specificError;
                }),
                _.mapValues(error => {
                    const source = textDocument.getText({
                        start: {
                            line: error.line - 1,
                            character: error.column
                        },
                        end: {
                            line: error.endLine - 1,
                            character: error.endColumn
                        }
                    });
                    const column = error.column + 1;
                    const endColumn = error.endColumn + 1;
                    return _.assign(error, {source, column, endColumn});
                }),
                _.values
            )(messages);
        }
    }
};
