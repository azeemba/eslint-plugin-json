/**
 * @fileoverview Lint JSON files
 * @author Azeem Bande-Ali
 * @copyright 2015 Azeem Bande-Ali. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict";

//------------------------------------------------------------------------------
// Plugin Definition
//------------------------------------------------------------------------------


// import processors
module.exports.processors = {
    // add your processors here
    ".json": {
        /*
         * Rewrite JSON to valid javascript by assigning it to a fake global
         * variable. The "javascript" will be validated with whatever rules are
         * set up in .eslintrc
         */
        preprocess: function(text) {
            var js = '/* global: fakeObject */\n' +
                     'fakeObject = ' + text;
            return [js];
        },
        postprocess: function(messages) {
            return messages.reduce(function (out, message) {
                return out.concat(message);
            }, []);
        }
    }
};
