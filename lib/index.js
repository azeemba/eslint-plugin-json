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
jsonServiceHandle.configure({
    validate: true,
    allowComments: true // setting doesn't seem to matter
});

const ERROR = 1;

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
const fileDocuments = {};

/*
function toDiagnosticSeverity(severityLevel) {
    switch (severityLevel) {
    case "error": return 1;
    case "warning": return 2;
    case "ignore": return 0;
    }
    return 0;
}

function makeDiagnostic(c, message, severity, errorCode) {
    return {
        range: c,
        message: message,
        severity: severity,
        code: errorCode
    };
}
*/

function getDiagnostics(textDocument, jsonDocument) {
    const diagnostics = [];
    const added = {};
    const trailingCommaSeverity = ERROR; // TODO:? make it an option (or kill with real error config)
    // const commentSeverity = ERROR;

    jsonDocument.syntaxErrors.forEach(function(problem) {
        if (problem.code === ErrorCode.TrailingComma) {
            problem.severity = trailingCommaSeverity;
        }
        const signature = `${problem.range.start.line} ${problem.range.start.character} ${problem.message}`;
        if (!added[signature]) {
            added[signature] = true;
            diagnostics.push(problem);
        }
    });

    // TODO: kill me reconfigure!!!
    // if (typeof commentSeverity === "number") {
    //     var message = "InvalidCommentToken: Comments are not permitted in JSON.";
    //     jsonDocument.comments.forEach(function(c) {
    //         addProblem(makeDiagnostic(c, message, commentSeverity, ErrorCode.CommentNotPermitted));
    //     });
    // }
    return diagnostics;
}
const makeRule = (errorName, filter) => ({
    create(context) {
        return {
            Program(node) {
                const {value: filename} = node.comments[0];
                // TODO later, see context.getFilename();
                const errors = fileLintResults[filename.trim()];
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
            }
        };
    }
});
module.exports.rules = _.pipe(
    _.mapKeys(_.kebabCase),
    _.toPairs,
    _.map(([errorName, errorCode]) => [
        errorName,
        makeRule(errorName, err => err.code === errorCode)
    ]),
    _.fromPairs
)(ErrorCode);
module.exports.rules['*'] = makeRule('*', _.constant(true));
module.exports.rules['unknown'] = makeRule('*', _.negate(AllErrorCodes.includes));

const errorSignature = err =>
    ['message', 'line', 'column', 'endLine', 'endColumn'].map(field => err[field]).join('::');
module.exports.processors = {
    '.json': {
        preprocess: function(text, fileName) {
            const textDocument = jsonService.TextDocument.create(fileName, 'json', 1, text);
            fileDocuments[fileName] = textDocument;
            const parsed = jsonServiceHandle.parseJSONDocument(textDocument);
            fileLintResults[fileName] = getDiagnostics(textDocument, parsed);
            return [`/* ${fileName} */\n(module.exports = 42)\n`]; // sorry nothing
        },
        postprocess: function(messages, fileName) {
            delete fileLintResults[fileName];
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
