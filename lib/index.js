/**
 * @fileoverview Lint JSON files
 * @author Azeem Bande-Ali
 * @copyright 2015 Azeem Bande-Ali. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

var jsonService = require("vscode-json-languageservice")

var jsonServiceHandle = jsonService.getLanguageService({});
jsonServiceHandle.configure({
    "validate": true,
    "allowComments": false
})

//------------------------------------------------------------------------------
// Plugin Definition
//------------------------------------------------------------------------------


let fileContents = {};
let fileDocuments = {}

// import processors
module.exports.processors = {
    // add your processors here
    ".json": {
        preprocess: function(text, fileName) {
            let textDocument = jsonService.TextDocument.create(fileName, "json", 1, text)
            let parsed = jsonServiceHandle.parseJSONDocument(textDocument)
            let responsePromise = jsonServiceHandle.doValidation(textDocument, parsed)
            responsePromise.then(response => {
                fileContents[fileName] = response;
                fileDocuments[fileName] = textDocument
            });
            return [text];
        },
        postprocess: function(messages, fileName) {
            let errors = fileContents[fileName]
            if (errors === undefined) {
                return []
            }
            let textDocument = fileDocuments[fileName]
            delete fileContents[fileName];
            delete fileDocuments[fileName]
            return errors.map((error) => {
                return {
                    ruleId: error.code,
                    severity: (error.severity == 1) ? 2 : 1,
                    message: error.message,
                    line: error.range.start.line + 1,
                    column: error.range.start.character + 1,
                    endLine: error.range.end.line + 1,
                    endColumn: error.range.end.character + 1,
                    source: textDocument.getText(error.range)
                }
            })
        }
    }
};

