'use strict';
var util = require('util');
var assert = require('assert');
var wmi = require('../src/lib/wmi.js');

var SHOWRESULT = false;
var tested_service = null;

//if (SHOWRESULT);
exports["Basics"] = function (test) {
    /** 
     * checking manual query and raw output 
     **/
    var q = new wmi({cmd:'wmic computersystem get', format:'RAW'});
    q.exec(function(r) {
        test.equal(r.err, undefined, 'unexpected error :'+r.err );
        test.ok(typeof r.data=='string' && r.data.length > 0, 'unexpected error, no row data was returned');
    });
    /** 
     * checking manual query and JSON output 
     **/
    q = new wmi({cmd:'wmic computersystem get /format:list', format:'JSON'});
    q.exec(function(r) {
        test.equal(r.err, undefined, 'unexpected error :'+r.err);
        test.ok(typeof r.data=='object' && r.data.length > 0, 'unexpected error, no row data was returned, cmd was;\n'+r.cmd);
        test.done();
    });
};
exports["Manual command"] = function(test) {
    /** 
     * checking manual query, format over-riding and html table  
     **/
    var q = new wmi({cmd:'wmic computersystem get /format:list', format:'HFORM'});
    q.exec(function(r) {
        test.equal(r.err, undefined, 'unexpected error :'+r.err);
        test.ok(typeof r.data=='string' && r.data.indexOf('<H3>') > 0, 'unexpected error, no html data was returned');
        test.done();
    });
};
exports["Simple error"] = function(test) {
    /**
     * checking simple error on unexisting alias
     **/
    var q = new wmi({cmd:'wmic computersystem2 get', format:'JSON'});
    q.exec(function(r) {
        test.notEqual(r.err, undefined, 'Error was expected');
        test.equal(r.err.code, '44135', r.cmd + 'should have returned a 44135 error code!');
    });

    /**
     * checking error on misplaced switch
     **/
    q = new wmi({cmd:'wmic /format:list computersystem get', format:'JSON'});
    q.exec(function(r) {
        test.notEqual(r.err, undefined, 'Error was expected');
        test.equal(r.err.code, '44125', r.cmd + 'should have returned a 44125 error code!');
        test.done();
    });
};
exports["Get Method"] = function(test) {
    /**
     * checking get method and server requirement at the same time
     **/
    wmi.get({node : 'localhost', format:'JSON' , alias:'os', field:'Name'}, function(r) {
        test.equal(r.err, undefined, 'unexpected error :'+r.err);
        test.ok(r.data[0].Name.indexOf('Microsoft') === 0, 'Nodejs host must have microsoft as OS');
    });
    wmi.get({node : 'localhost', format:'JSON' , alias:'os', field:'Version'}, function(r) {
        test.equal(r.err, undefined, 'unexpected error :'+r.err);
        test.ok(parseFloat(r.data[0].Version) >= 6.1 , 'Nodejs host must have microsoft as OS');
        test.done();
    });
};
exports["Alias list"] = function(test) {
    /**
     * check alias list
     **/
    wmi.listAlias({node : 'localhost', format:'JSON' }, function(r) {
        test.equal(r.err, undefined, 'unexpected error :'+r.err);
        //check if SERVER alias is present
        var foundAlias = false;
        for(var i=0; i<r.data.length; i++) {
            if (r.data[i].alias == 'ALIAS') {
                foundAlias = true;
                break;
            }
        }
        test.ok(foundAlias, 'listAlias method has not returned expected alias');
        test.done();
    });
};
exports["Malicious command"] = function(test) {
    /**
     * checking malicious command just in case
     **/
    var q = new wmi();
    q.cmd = 'format c:';
    test.equal(q.cmd, 'wmic format c:', 'Malicious command have been disabled!');
    q.cmd = 'wmic || format c:';
    test.equal(q.cmd, 'wmic  format c:', 'Malicious command have been disabled!');
    test.done();
};
exports["call method"] = function (test) {
    /**
     * call check, 
     * in order to work everywhere we'll get first service not started and try
     * to start it, then stop it.
     * except if tested_service has been set;
     **/
    wmi.get({node:"CLIMBO1", alias:'service', where: 'Started=FALSE', format:'JSON'}, function(r) {
        test.ok(r.data.length >=1, 'No service found');
        var found = false;
        if (!tested_service) {
            found = true;
            tested_service = r.data[0].Name;
        } else {
            //checking if service exists
            for(var i=0; i<r.data.length; i++) {
                if (r.data[i].Name == tested_service) {
                    found = true;
                    break;
                }
            }

        }
        if (!found) {
            console.log("Can not check call method on "+tested_service+", service doesn't exist.");
        } else {
            wmi.call({node:"CLIMBO1", alias:'service', where: 'Name="'+tested_service+'"', action:'startservice', format:'JSON'}, function(r) {
                test.equal(r.err, undefined, 'Unexpected error during call method execution');
                test.ok(r.data.returnValue, ' call execution didnt return valid data...');
                //stopping service
                wmi.call({node:"CLIMBO1", alias:'service', where: 'Name="'+tested_service+'"', action:'startservice', format:'JSON'});
                test.done();
            });
        }
    });
};
