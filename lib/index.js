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

const fileLintResults = {};
const fileComments = {};
const fileDocuments = {};

function getDiagnostics(textDocument, jsonDocument) {
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
                    column: error.range.start.character + 1
                },
                end: {
                    line: error.range.end.line + 1,
                    column: error.range.end.character + 1
                }
            }
            // fix!?
        });
    });
};
const reportComment = (errorName, context) => {
    fileComments[context.getFilename()].forEach(comment => {
        context.report({
            ruleId: errorName,
            message: 'Comment not allowed',
            loc: {
                start: {
                    line: comment.start.line + 1,
                    column: comment.start.character + 1
                },
                end: {
                    line: comment.end.line + 1,
                    column: comment.end.character + 1
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
    _.fromPairs
)(ErrorCode);
module.exports.rules['*'] = makeRule('*', [reportError(_.constant(true)), reportComment]);
module.exports.rules['unknown'] = makeRule(
    'unknown',
    reportError(_.negate(AllErrorCodes.includes))
);
module.exports.rules['comment-not-permitted'] = makeRule('comment-not-permitted', reportComment);

const errorSignature = err =>
    ['message', 'line', 'column', 'endLine', 'endColumn'].map(field => err[field]).join('::');

module.exports.processors = {
    '.json': {
        preprocess: function(text, fileName) {
            const textDocument = jsonService.TextDocument.create(fileName, 'json', 1, text);
            fileDocuments[fileName] = textDocument;
            const parsed = jsonServiceHandle.parseJSONDocument(textDocument);
            fileLintResults[fileName] = getDiagnostics(textDocument, parsed);
            fileComments[fileName] = parsed.comments;
            return ['']; // sorry nothing ;)
        },
        postprocess: function(messages, fileName) {
            delete fileLintResults[fileName];
            delete fileComments[fileName];
            return _.pipe(
                _.first,
                _.groupBy(errorSignature),
                _.mapValues(errors => {
                    if (errors.length === 1) return _.first(errors);
                    // Otherwise there is two errors: the generic and specific one
                    // json/* and json/some-code
                    const isFirstGeneric = _.first(errors).ruleId === 'json/*';
                    const genericError = errors[isFirstGeneric ? 0 : 1];
                    const specificError = errors[isFirstGeneric ? 1 : 0];
                    return genericError.severity > specificError.severity
                        ? genericError
                        : specificError;
                }),
                _.values
            )(messages);
        }
    }
};
