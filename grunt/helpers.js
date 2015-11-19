var _ = require('underscore');
var chalk = require('chalk');
var fs = require('fs');
var path = require('path');

module.exports = function(grunt) {

    // grunt tasks

    grunt.registerTask('_log-server', 'Logs out user-defined build variables', function() {
        grunt.log.ok('Starting server in "' + grunt.config('outputdir') + '" using port ' + grunt.config('connect.server.options.port'));
    });
    grunt.registerTask('_log-vars', 'Logs out user-defined build variables', function() {
        var includes = grunt.config('includes');
        var excludes = grunt.config('excludes');

        if (includes && excludes) {
            grunt.fail.fatal('Cannot specify includes and excludes. Please check your config.json configuration.');
        }

        if (includes) {
            grunt.log.writeln('The following plugins will be included in the build:');
            for(var i = 0, count = includes.length; i < count; i++)
                grunt.log.writeln('- ' + includes[i]);
            grunt.log.writeln('');
        }
        if (excludes) {
            grunt.log.writeln('The following plugins will be excluded from the build:');
            for(var i = 0, count = excludes.length; i < count; i++)
                grunt.log.writeln('- ' + excludes[i]);
            grunt.log.writeln('');
        }

        grunt.log.ok('Using source at "' + grunt.config('sourcedir') + '"');
        grunt.log.ok('Building to "' + grunt.config('outputdir') + '"');
        if (grunt.config('theme') !== '**') grunt.log.ok('Using theme "' + grunt.config('theme') + '"');
        if (grunt.config('menu') !== '**') grunt.log.ok('Using menu "' + grunt.config('menu') + '"');
    });

    // privates

    var generateIncludedRegExp = function() {
        var includes = grunt.config('includes') || [];
        var re = '';
        for(var i = 0, count = includes.length; i < count; i++) {
            re += includes[i];
            if(i < includes.length-1) re += '|';
        }
        return new RegExp(re);
    };

    var generateExcludedRegExp = function() {
        var excludes = grunt.config('excludes') || [];
        var re = '';
        for(var i = 0, count = excludes.length; i < count; i++) {
            re += excludes[i];
            if(i < excludes.length-1) re += '|';
        }
        return new RegExp(re);
    };

    // exported

    var exports = {};

    exports.defaults = {
        sourcedir: process.cwd() + '/src/',
        outputdir: process.cwd() + '/build/',
        theme: '**',
        menu: '**',
        includes: [
            "src/core/",
            "templates/templates.js",
            "components/components.js",
            "extensions/extensions.js",
            "menu/menu.js",
            "theme/theme.js"
        ],
        pluginTypes: [
            'components',
            'extensions',
            'menu',
            'theme'
        ]
    };

    exports.appendSlash = function(dir) {
        if (dir) {
            var lastChar = dir.substring(dir.length - 1, dir.length);
            // TODO: check the use of / on windows
            if (lastChar !== '/') return dir + '/';
        }
    };

    exports.getIncludes = function(buildIncludes, configData) {
        var dependencies = [];

        for(var i = 0, count = exports.defaults.pluginTypes.length; i < count; i++) {
            var dir = path.join(configData.sourcedir, exports.defaults.pluginTypes[i]);
            var children = fs.readdirSync(dir);
            for(var j = 0, count = children.length; j < count; j++) {
                try {
                    var folderPath = path.join(dir, children[j]);

                    // not a directory, excape!
                    if(!fs.statSync(folderPath).isDirectory()) continue;

                    var bowerJson = require(path.join(folderPath, 'bower.json'));
                    for (var key in bowerJson.dependencies) {
                        if(!_.contains(buildIncludes, key)) dependencies.push(key)
                    }
                } catch(error) {
                    console.log(error);
                }
            }
        }
        return [].concat(exports.defaults.includes, buildIncludes, dependencies);
    };

    exports.generateConfigData = function() {
        var data = {
            sourcedir: exports.appendSlash(grunt.option('sourcedir')) || exports.defaults.sourcedir,
            outputdir: exports.appendSlash(grunt.option('outputdir')) || exports.defaults.outputdir,
            theme: grunt.option('theme') || exports.defaults.theme,
            menu: grunt.option('menu') || exports.defaults.menu,
        };

        // Selectively load the course.json ('outputdir' passed by server-build)
        var prefix = grunt.option('outputdir') ? grunt.option('outputdir') : data.sourcedir;
        var buildConfigPath = prefix + 'course/config.json';

        try {
            var buildConfig = require(buildConfigPath).build;
        }
        catch(error) {
            return console.log(error);
        }

        if(buildConfig.includes) data.includes = exports.getIncludes(buildConfig.includes, data);
        if(buildConfig.excludes) data.excludes = buildConfig.excludes;

        return data;
    };

    /*
    * Uses the parent folder name (menu, theme, components, extensions).
    * Also caches a list of the installed plugins
    * assumption: all folders are plugins
    */
    exports.getInstalledPluginsByType = function(type) {
        var pluginDir = grunt.config('sourcedir') + type + '/';
        if(!grunt.file.isDir(pluginDir)) return []; // fail silently
        // return all sub-folders, and save for later
        return grunt.option(type, grunt.file.expand({ filter:'isDirectory', cwd:pluginDir }, '*'));
    };

    exports.isPluginInstalled = function(pluginName) {
        var types = ['components','extensions','theme','menu'];
        for(var i = 0, len = types.length; i < len; i++) {
            var plugins = grunt.option(types[i]) || this.getInstalledPluginsByType(types[i]);
            if(plugins.indexOf(pluginName) !== -1) return true;
        }
        return false;
    };

    exports.isPluginIncluded = function(pluginPath) {
        var includes = grunt.config('includes');
        var excludes = grunt.config('excludes');

        // carry on as normal if no includes/excludes
        if (!includes && !excludes) return true;

        var isIncluded = includes && pluginPath.search(exports.includedRegExp) !== -1;
        var isExcluded = excludes && pluginPath.search(exports.excludedRegExp) !== -1;

        if (isExcluded || !isIncluded) {
            // grunt.log.writeln('Excluded ' + chalk.magenta(pluginPath));
            return false;
        }
        else {
            // grunt.log.writeln('Included ' + chalk.green(pluginPath));
            return true;
        }
    };

    exports.includedFilter = function(filepath) {
        return exports.isPluginIncluded(filepath);
    };

    exports.includedProcess = function(content, filepath) {
        if(!exports.isPluginIncluded(filepath)) return "";
        else return content;
    };

    exports.includedRegExp = generateIncludedRegExp();
    exports.excludedRegExp = generateExcludedRegExp();

    return exports;
};
