/*global module:false*/
module.exports = function(grunt) {
    grunt.file.defaultEncoding = 'utf8';
    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        jshint: {
            src : [ 'src/wmi-query.js']
        }, 
        nodeunit: {
            all: ['src/test/*.js']
        }, 
        markdown: {
            all: {
                files: [{
                    expand: false,
                    src: 'src/readme.md',
                    dest: './docs/notes.html'
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
                    paths : "src/",
                    exclude : "src/test/",
                    outdir: "docs/" 
                }
            }
        },
        clean: {
            dist: ["dist/**"],
            docs: ["docs/**"]
        },
        copy: {
            src : {
                cwd: 'src', 
                src : '**/*.js',
                dest : 'dist/wmi-query',
                expand:true
            },
            'package.json' : {
                src: 'src/package.json',
                dest: 'dist/wmi-query/package.json',
                options: {
                    process: function(content, path) {
                        return grunt.template.process(content);
                    }
                }
            }
            
        },
        publish : {
            main : {
                src : [ 'dist/wmi-query']
            }
        }

    });

    // Default task.
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-markdown');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-nodeunit');
    grunt.loadNpmTasks('grunt-contrib-yuidoc');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-publish');

    /** TASKS **/
    grunt.registerTask('check', 'jshint');
    grunt.registerTask('test', 'nodeunit');
    grunt.registerTask('docs', ['clean:docs', 'yuidoc']);
    grunt.registerTask('copy-src', ['clean:dist', 'copy:src', 'copy:package.json']);
    grunt.registerTask('build', [ 'check',  'test', 'docs', 'copy-src']);
    grunt.registerTask('npm-publish', [ 'build', 'publish:main']);
    grunt.registerTask('default', ['build']);

};
