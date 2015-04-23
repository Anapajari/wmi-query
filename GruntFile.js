/*global module:false*/
module.exports = function(grunt) {
    grunt.file.defaultEncoding = 'utf8';
    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        meta: {
            banner: '/*! <%= pkg.name %> - <%= pkg.version %> - ' +
                '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
                '* build with grunt (gruntjs.com)\n' 
        },
        jshint: {
            src : [ 'src/lib/wmi.js']
        }, 
        nodeunit: {
            files: ['tests/test.js']
        }, 
        markdown: {
            all: {
                files: [{
                    expand: false,
                    src: 'src/readme.md',
                    dest: './Docs/notes.html'
                }]
            }
        },
        yuidoc: {
            compile: {
                name: '<%= pkg.name %>-<%= pkg.version%>',
                description: '<%= pkg.description %>',
                version: '<%= pkg.version %>',
                url: '<%= pkg.homepage %>',
                options: {
                    exclude : "/tests/",
                    paths : "src/",
                    outdir: "Docs/" 
                }
            }
        },
        copy: {
            src : {
                expand:true,
                dest : 'dist',
                src : 'src/**/*.js'
            },
        }

    });

    // Default task.
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-markdown');
    grunt.loadNpmTasks('grunt-contrib-nodeunit');
    grunt.loadNpmTasks('grunt-contrib-yuidoc');
    grunt.loadNpmTasks('grunt-contrib-copy');

    /** TASKS **/
    grunt.registerTask('check', 'jshint');
    grunt.registerTask('test', 'nodeunit');
    grunt.registerTask('docs', 'yuidoc');
    grunt.registerTask('publish', 'copy:src');
    grunt.registerTask('default', [ 'check',  'test', 'docs', 'publish']);


};
