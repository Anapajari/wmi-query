var cp_execSync = require('child_process').execSync;
var cp_exec = require('child_process').exec;
var util = require('util');

/** USEFULL LINKS 
* 1/ for query example : 
    http://blogs.technet.com/b/askperf/archive/2012/02/17/useful-wmic-queries.aspx
* 2/ for commons problems :  
    https://social.technet.microsoft.com/Forums/windowsserver/en-US/30273791-1952-4315-a5c3-7d809f9724c1/can-you-connect-to-wmi-remotely-using-a-local-user-account?forum=winserverManagement
* 3/ in case of csv or xml, explanation on the weird usage of /format :
    http://stackoverflow.com/questions/9673057/wmic-error-invalid-xsl-format-in-windows7
* 4/ for switch to implement 
    https://technet.microsoft.com/en-us/library/cc787035%28v=ws.10%29.aspx
** TODO
 * TODO1: refactor 'call' support, see if create/delete can also be added
 *           this also include new result parser to json.
 *           MUSIC was : https://www.youtube.com/watch?v=Vh8vrg_Wq4k&list=RDmKsRPr0O6co&index=27
 * TODO2 : handle missing switch, output for example to build file (@see link4)
 *         wmic /output:a.csv computersystem get /format:"%WINDIR%\\System32\\wbem\\en-u s\\csv"
 * TODO2 : merging WMIResult and WMIError as they behave almost the same way.
 *         findParserForQuery might need more info from query.
 *         this may also need a better way to store parser, maybe some key/function object instead
 *         of storing them in the prototype.
 * TODO3 : implement parser function adding into WMIResult and WMIError
 * TODO3 : add support of specific xsl
**/

var LINESEP = "###SEP###";
var TIMEOUT = 10000;
var FIRST_ALIAS = 'ALIAS';
var LAST_ALIAS = 'WMISET';
//NO_VERB is needed for basic help command
var SUPPORTED_VERBS = ['get', 'call', 'NO_VERB'];
var SUPPORTED_FORMATS = ['XML', 'CSV', 'HFORM', 'HTABLE', 'RAW'];

var Query = function(options) {
    this._node = null;
    this._verb = null;
    this._alias = null;
    this._where = null;
    this._field = null;
    this._action = null;
    this._format = null;
    this._cmd = null;
    this._parser = null;
    this._help = false;
    if (options && typeof options == 'object') {
        if (options.verb) 
            this.verb = options.verb;
        if (options.help) 
            this._help = options.help;
        if (options.node) 
            this.node = options.node;
        if (options.alias) 
            this._alias = options.alias;
        if (options.where) 
            this.where = options.where;
        if (options.field) 
            this.field = options.field;
        if (options.action) 
            this._action = options.action;
        if (options.format) 
            this.format = options.format;
        if (options.cmd) 
            this.cmd = options.cmd;
        if (options.parser) 
            this.parser = options.parser;
    }
};
//warning when using multiples node
//we can't tell which line belong to which one
Object.defineProperties(Query.prototype, {
    node : {
        set : function (n) {
            if (util.isArray(n)) {
                this._node = n.join(',');
            } else if (typeof n == 'string') {
                this._node = n;
            }
        },
        get : function (){
            return this._node;
        }
    },
    where : {
        set : function (w) {
            //todo handle and/or, for the moment only supporting and
            if (util.isArray(w)) {
                this._where = w.join(' and ');
            } else if (typeof w == 'string') {
                this._where = w;
            } else {
                this._where = null;
            }
        },
        get : function() {
            return this._where;
        }
    },
    field :{ 
        set : function (f) {
            if (util.isArray(f)) {
                this._field = f.join(',');
            } else if (typeof f == 'string') {
                this._field = f;
            } else {
                this._field = null;
            }
        },
        get : function () {
            return this._field;
        }
    },
    format: {
        set : function(f) {
            if (SUPPORTED_FORMATS.indexOf(f) != -1) {
                this._format = f;
            } else {
                this._format = 'JSON';
            }
        },
        get : function() {
            return this._format;
        }
    },
    cmd : {
        set : function(c) {
            if (c.indexOf('wmic')===-1) {
                //forcing cmd to start with wmic
                c = 'wmic '+c;
            }
            //we'll also replace & and | operator to prevent multiple dos command
            c = c.replace(/[\&\|]/g, '');

            this._cmd = c;
            //finding verb
            if (!this.verb) {
                if (c.indexOf('get') >= 0 && this.verb != 'get') this.verb = 'get';
                if (c.indexOf('call') >=0 && this.verb != 'call') this.verb = 'call';
                if (c.indexOf('create')>=0 && this.verb != 'create') this.verb = 'create';
                if (c.indexOf('delete')>=0 && this.verb != 'delete') this.verb = 'delete';
                if (c.indexOf('set')>=0 && this.verb != 'set') this.verb = 'set';
                if (c.indexOf('\/?')>=0 && !this._help) this._help = true;
            }
        },
        get : function() {
            return this._cmd;
        }
    },
    verb : {
        set : function(v) {
            if (SUPPORTED_VERBS.indexOf(v) != -1) {
                this._verb = v;
            }
        },
        get : function() {
            return this._verb;
        }

    },
    parser : {
        set: function(p){
            if (typeof p=='string' || typeof p=='function') {
                this._parser = p;
            }
        },
        get: function () {
            return this._parser;
        }
    }
});
Query.prototype.checkCmd = function() {
    if (this.format) {
        if (this.cmd.indexOf('/format')!=-1) {
            this.cmd = this.cmd.replace(/\/format.*$/, '');
        }
        this.appendFormat();
    }
};
Query.prototype.buildCmd = function() {
    if (this.cmd) return this.cmd;
    var cmd = 'wmic ';
    if (this._node) {
        cmd += ' /node:'+this._node;
    }
    if (this._alias) {
        cmd += ' '+this._alias;
    }
    if (this._where) {
        cmd += ' where ('+this._where+')';
    }
    if (this.verb == 'NO_VERB') {
        //do nothing
    } else if (this.verb == 'get') {
        cmd += ' get ';
        if (this._field) {
            cmd += ' '+this._field;
        }
    } else if (this.verb == 'call') {
        cmd += ' call ';
        if (this._action) {
            cmd += this._action+" ";
        }
    }

    this.cmd = cmd;
    this.appendFormat();
};
Query.prototype.appendFormat = function() {
/** 
 * check http://stackoverflow.com/questions/9673057/wmic-error-invalid-xsl-format-in-windows7
 * for usage of WINDIR path on non english system
 **/
    if (this._help) {
        this._cmd += ' /?';
    } else if (this.verb == 'call') {
        //removing format if found
        this._cmd = this._cmd.replace(/\/format(.*?)( |$)/, "");
    } else if (this.verb == 'get') {
        //special format are supported only by get method
        if(this._format == 'JSON') {
            /** some might think it would have been easier to parse csv than format:list
             * at first it was like that ... But after some tests on a few servers
             * I've found out that some services description/caption contain comma.
             * And thus the split(",") on the output was shifting columns result
             **/
            this._cmd += ' /format:list';
        } else if (this._format == 'HFORM'){
            this._cmd += ' /format:"%WINDIR%\\System32\\wbem\\en-us\\hform"';
        } else if (this._format == 'HTABLE'){
            this._cmd += ' /format:"%WINDIR%\\System32\\wbem\\en-us\\htable"';
        } else if (this._format == 'XML'){
            this._cmd += ' /format:"%WINDIR%\\System32\\wbem\\en-us\\xml"';
        } else if (this._format == 'CSV'){
            this._cmd += ' /format:"%WINDIR%\\System32\\wbem\\en-us\\csv"';
        } else if (this.specificXSL) {
            //TODO3 : shoud do a 'fs.lstatSync(this.specificXSL).isFile() though
            this._cmd += '/format:"'+this.specificXSL+'"';
        }
    }
};
Query.prototype.exec = function(callback) {
    //callback's optionnal so if not set giving it an empty function
    if (!callback) callback = function() {return;};
    if (!this.cmd) {
        this.buildCmd();
    } else {
        this.checkCmd();
    }
    if (SUPPORTED_VERBS.indexOf(this._verb) == -1) {
        callback({err: "Unsupported "+this.verb, stderr:""});
        return;
    }
    var q = this; //stored to be available in callback
    cp_exec(this.cmd,{"encoding":"utf8", "timeout": TIMEOUT}, function(err, stdout, stderr) {
        if (err) {
            var error = new WMIError(err, q);
            callback({cmd:q.cmd, err:error.data()});
        } else {
            var result = new WMIResult(stdout, q);
            //adding executed cmd
            callback({cmd:q.cmd, data:result.data()});
        }
    });
};
//Statics methods
Query.listAlias  = function (options, callback) {
    //setting expected and cleaning unexpected options 
    options.verb = "NO_VERB";
    options.help = true;
    options.parser = "getHelpToJSON";
    delete options.alias;
    delete options.where;
    var q = new Query(options);
    q.exec(callback);
};
Query.get = function(options, callback) {
    options.verb = 'get';
    var q = new Query(options); 
    q.buildCmd();
    q.exec(callback);
};
Query.call = function(options, callback) {
    options.verb = 'call';
    var q = new Query(options); 
    q.exec(callback);
};

   

/** RESULTS PARSER **/
var WMIResult = function(output, query) {
    var format = query.format || 'JSON';
    var verb = query.verb || 'get';
    this.parser = null;
    this.output = output;
    //finding parser
    this.findParserFor(query);
};
WMIResult.prototype.data = function() {
    return this.parser(this.output);
};
WMIResult.prototype.findParserFor= function (query) {
    if (typeof query.parser == 'string' && typeof this[query.parser] == 'function') {
        this.parser = this[query.parser];
    } else if (typeof parser == 'function') {
        this.parser = parser;
    } else if (query.verb == 'get' && query.format == 'JSON') {
        this.parser = this.getToJSON;
    } else if (query.verb == 'call' && query.format == 'JSON') {
        this.parser = this.callToJSON;
    } else {
        this.parser = this.raw;
    }
};
WMIResult.prototype.getToJSON = function (output) {
    var temp = cmdResultToArray(output);
    var separator, i, found;
    var result = [];
    var r={};
    var emptyR = true;
    for(i=0;i<temp.length; i++) {
        if (temp[i]== LINESEP) {
            if (!emptyR) {
                result.push(r);
                r = {};
                emptyR = true;
            }
        }
        found = temp[i].match(/^(.*?)=(.*?)$/);
        if (found && found.length == 3) {
            r[found[1]] = found[2];
            emptyR = false;
        }
    }
    //adding last item
    if (!emptyR) result.push(r);
    return result;
};
WMIResult.prototype.callToJSON = function(output) {
    var temp = cmdResultToArray(output);
    //only looking for returnValue
    var returnValue = null;
    var i, m;
    for(i=0; i<temp.length; i++) {
        if (temp[i].indexOf("ReturnValue") >= 0) {
            m = temp[i].match(/= +(\d+)/);
            if (m && m.length == 2) {
                returnValue = m[1];
            }
            break;
        }
    }
    return { returnValue : returnValue};

};
WMIResult.prototype.getHelpToJSON  = function (output) {
    var temp = cmdResultToArray(output);
    var i, content;
    var foundStart= false;
    var list = [];
    for(i=0;i<temp.length; i++) {
        if (temp[i]== LINESEP) {
            continue;
        }
        if (temp[i].indexOf(FIRST_ALIAS) === 0) {
            foundStart = true;
        }
        if (foundStart) {
            //line should look like: "SHARE  - Shared resource management."
            content = temp[i].match(/([A-Z]*)\s*\-\s*(.*)$/);
            if (content && content.length == 3) {
                list.push({alias:content[1], caption:content[2]});
            }
            if (temp[i].indexOf(LAST_ALIAS)=== 0) {
                // found ending line
                break;
            }
        }
    }
    return list;
};
WMIResult.prototype.raw = function(output) {
    return output;
};

/** ERROR PARSER **/
var WMIError = function(err, query) {
    var format = query.format || 'JSON';
    this.err = err;
    this.parser = null;
    //finding parser
    this.findParserFor(query);
};
WMIError.prototype.data = function() {
    return this.parser(this.err);
};
WMIError.prototype.findParserFor = function (query) {
    if (typeof query.parser == 'string' && typeof this[query.parser] == 'function') {
        this.parser = this[query.parser];
    } else if (typeof query.parser == 'function') {
        this.parser = query.parser;
    } else if (query.format == 'JSON') {
        this.parser = this.toJSON;
    } else {
        this.parser = this.raw;
    }
};
WMIError.prototype.toJSON = function (err) {
    var temp = cmdResultToArray(err.message);
    var cleaned = [];
    //cleaning a few things
    for (var i=0;i<temp.length; i++) {
        if (temp[i] && temp[i].indexOf('Command failed')!==-1) {
            cleaned.push(temp[i]);
        }
    }
    return {
        message : cleaned.join("\r\n"),
        code : err.code
    };
};
WMIError.prototype.raw = function(err) {
    return err.message;
};


/** helpers **/
function cmdResultToArray(output) {
    //splitting output, 4 empty lines means new items
    return output.replace(/(\r?\n|\r){4,}/g, "£"+LINESEP+"£").replace(/(\r?\n|\r)+/g, "£").split("£");
}



module.exports = Query;


/** TODO Imp call

function WmiCallResult(output) {
    this.returnValue;
    this.raw = output;
    this.lines = []
    var temp = output.replace(/\r?\n|\r/g, "£").split("£");
    //cleaning empty lines
    for(var i=0;i<temp.length; i++) {
        if (temp[i] != "") this.lines.push(temp[i]);
    }
    /** first line shoud be 
      * "Method execution successful."
     * if not the command failed and has returned error message 
    **
    if (this.lines[0].indexOf('successfull') == -1) {
        this.error = output;
    }
    //browsing other lines to find ReturnValue
    var failed = true;
    for(var i=0; i<= this.lines.length; i++) {
        if (this.lines[i].indexOf("ReturnValue") != -1) {
            this.returnValue = this.lines[i].replace(/[^\d]/g, "");
            break;
        }
    }
}
/** wmi call
 * @param o options
 * @param [o.node] remove computer
 * @param o.alias wmi alias
 * @param o.action call action
 * @param [o.where] wmi where clause
 **
function call(o) {
    //todo, better type check
    o = typeof o == 'object' ? o : {};
    var cmd = 'wmic ',
    reg,
    result = [];
    if (!o.alias) throw new Error('Missing Alias');
    if (!o.action) throw new Error('Missing Action');

    if (o.node) {
        cmd += ' /node:'+o.node;
    }
    cmd += ' '+o.alias;
    if (o.where) {
        cmd += ' where ('+o.where+')';
    }
    cmd += ' call '+o.action;
    var output= exec(cmd);
    return new WmiCallResult(output);
    }
 */
