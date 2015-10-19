// jscs:disable
module.exports = function(grunt) {

    require('load-grunt-tasks')(grunt);

    var globals = {};
    var globalList = [
        'Servers', 'Config', 'Parser', 'Commands', 'connect', 'disconnect',
        'log', 'toId', 'sqlite3', 'sanitize', 'lastSeen', 'updateSeen', 'sendTell'
    ];
    globalList.forEach(function(identifier) {
        globals[identifier] = false;
    });
    grunt.initConfig({

        jshint: {
            files: ['Gruntfile.js', 'commands.js', 'app.js', 'parser.js', 'plugins/*.js'],
            options: {
                "nonbsp": true,
                "nonew": true,
                "noarg": true,
                "loopfunc": true,
                "latedef": 'nofunc',

                "freeze": true,
                "undef": true,

                "sub": true,
                "evil": true,
                "esnext": true,
                "node": true,
                "eqeqeq": true,

                "globals": globals
            }
        },

    jscs: {
        files: ['Gruntfile.js', 'commands.js', 'app.js', 'parser.js', 'plugins/*.js'],
        options: {
            "preset": "yandex",

            //"validateConditionals": true,
            //"validateCaseIndentation": true,

            "requireCurlyBraces": null,

            "maximumLineLength": null,
            "validateIndentation": '\t',
            "validateQuoteMarks": null,
            "disallowQuotedKeysInObjects": null,
            "requireDotNotation": null,

            "disallowMultipleVarDecl": null,
            "disallowImplicitTypeConversion": null,
            "requireSpaceAfterLineComment": null,

            "disallowMixedSpacesAndTabs": "smart",
            "requireSpaceAfterKeywords": true,
            "requireSpaceAfterBinaryOperators": [
                '=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '>>>=',
                '&=', '|=', '^=',

                '+', '-', '*', '/', '%', '<<', '>>', '>>>', '&',
                '|', '^', '&&', '||', '===', '==', '>=',
                '<=', '<', '>', '!=', '!==',

                ','
            ],

            "disallowSpacesInCallExpression": true,
            "validateParameterSeparator": ", ",

            "requireBlocksOnNewline": 1,
            "disallowPaddingNewlinesInBlocks": true,

            "disallowSpaceBeforeSemicolon": true,
            "requireOperatorBeforeLineBreak": true,
            "disallowTrailingComma": true,

            "requireCapitalizedConstructors": true,

            "validateLineBreaks": null,
            "disallowMultipleLineBreaks": null
        }
    }

    });

    grunt.loadNpmTasks("grunt-jscs");
    grunt.registerTask('default', ['jshint', 'jscs']);

};
