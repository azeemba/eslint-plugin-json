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

var jshint = require("jshint");

//------------------------------------------------------------------------------
// Plugin Definition
//------------------------------------------------------------------------------


var fileContents = {};

// import processors
module.exports.processors = {
    // add your processors here
    ".json": {
        preprocess: function(text, fileName) {
            fileContents[fileName] = text;
            var jsText = 'var json = ' + text;
            return [jsText];
        },
        postprocess: function(messages, fileName) {
            var eslintMessages = messages.length ? messages[0].filter(function(message) {
                switch (message.ruleId) {
                    case 'no-var': return message.source !== 'var json = {';
                    case 'no-unused-vars': return message.source !== 'var json = {';
                    case 'quotes': return message.message !== 'Strings must use singlequote.';
                    case 'semi': return false;
                    case 'comma-dangle': return false;
                    default: return true;
                }
            }) : [];

            jshint.JSHINT(fileContents[fileName]);
            delete fileContents[fileName];
            var data = jshint.JSHINT.data();
            var errors = (data && data.errors) || [];
            var jshintMessages = errors.filter(function(e){ return !!e; }).map(function(error) {
                return {
                    ruleId: "bad-json",
                    severity: 2,
                    message: error.reason,
                    source: error.evidence,
                    line: error.line,
                    column: error.character
                };
            });

            return eslintMessages.concat(jshintMessages);
        }
    }
};

