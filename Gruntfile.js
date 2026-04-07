/* eslint-env node, es6 */

module.exports = function ( grunt ) {
    grunt.loadNpmTasks( 'grunt-banana-checker' );
    grunt.loadNpmTasks( 'grunt-eslint' );
    grunt.loadNpmTasks( 'grunt-stylelint' );

    grunt.initConfig( {
        eslint: {
            options: {
                cache: true
            },
            all: [
                '**/*.{js,json}',
                '!{vendor,node_modules}/**'
            ]
        },
        stylelint: {
            all: [
                '**/*.{css,less}',
                '!{vendor,node_modules}/**'
            ]
        },
        banana: {
            core: 'i18n/core'
            // createmap: 'i18n/createmap',
            // ve: 'i18n/ve'
        }
    } );

    grunt.registerTask( 'test', [ 'eslint', 'stylelint', 'banana' ] );
    grunt.registerTask( 'default', 'test' );
};
