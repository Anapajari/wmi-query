/**
@module wmi-query
 
 (C) 2014 Matthieu Bourgeois
 MIT LICENCE
 

#######  TODO
  TODO1 : finish yuidoc tags
  TODO2 : switch to ES6 class
  TODO2 : build npm package (https://quickleft.com/blog/creating-and-publishing-a-node-js-module/)
  TODO3 : merging WMIResult and WMIError as they behave almost the same way.
          findParserForQuery might need more info from query.
          this may also need a better way to store parser, maybe some key/function object instead
          of storing them in the prototype.of WMIResult and WMIError
  TODO3 : add support of specific xsl 
  TODO3 : add missing switch especially output to file
          see https://technet.microsoft.com/en-us/library/cc787035%28v=ws.10%29.aspx
**/

var util = require('util'),
    cp_execSync = require('child_process').execSync,
    cp_exec = require('child_process').exec;

/**
Query class.
<br>Usefull links :
    <a href="http://blogs.technet.com/b/askperf/archive/2012/02/17/useful-wmic-queries.aspx">usefull query examples</a> and 
    <a href="https://social.technet.microsoft.com/Forums/windowsserver/en-US/30273791-1952-4315-a5c3-7d809f9724c1/can-you-connect-to-wmi-remotely-using-a-local-user-account?forum=winserverManagement">commons problems with wmi</a>

@class Query
@constructor
@param options {Object} The object whose properties will be used to init the query
@param [options.timeout=5000] {Number} time out for query execution
@param [options.node] {String} node(s) to query, can contains multiples server name separated by comma: "pc1,pc2"
@param [options.verb] {String} verb of the query, must be in Query.SUPPORTED_VERBS
@param [options.alias] {String} alias being queried
@param [options.where] {String} where clause, query will add parenthesis around it
@param [options.field] {String} field being queried, used mainly by "get" verb
@param [options.action] {String} action being executed, use mainly by "call" verb
@param [options.format] {String} query output format, must be in Query.SUPPORTED_FORMATS
@param [options.cmd] {String} manual command, will override mosts others options
@param [options.parser] {String|Function} Function that will be used to parse cmd output
@param [options.help=false] {Boolean} flag used when the cmd executed needs the "/?" option
*/
var Query = function(options) {
    this.timeout = 5000;
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
            this.timeout = options.timeout;
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
    /**
    @property node
    @type String
    */
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
    /**
    @property where
    @type String
    */
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
    /**
    @property field
    @type String
    */
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
    /**
    @property format
    @type String
    */
    format: {
        set : function(f) {
            if (Query.SUPPORTED_FORMATS.indexOf(f) != -1) {
                this._format = f;
            } else {
                this._format = 'JSON';
            }
        },
        get : function() {
            return this._format;
        }
    },
    /**
    @property cmd
    @type String
    */
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
    /**
    @property verb
    @type String
    */
    verb : {
        set : function(v) {
            if (Query.SUPPORTED_VERBS.indexOf(v) != -1) {
                this._verb = v;
            }
        },
        get : function() {
            return this._verb;
        }

    },
    /**
    @property parser
    @type String|Function
    */
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

/**
use object properties to build command
@method buildCmd
@chainable
*/
Query.prototype.buildCmd = function() {
    if (!this.cmd) {
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
    }
    this.cmd = cmd;
    this.appendFormat();
    return this;
};

/**
check command format according to format property
@method checkCmd
*/
Query.prototype.checkCmd = function() {
    if (this.format) {
        if (this.cmd.indexOf('/format')!=-1) {
            this.cmd = this.cmd.replace(/\/format.*$/, '');
        }
        this.appendFormat();
    }
};

/**
append format instruction to cmd.
Weird usage of WINDIR path is explained <a href="http://stackoverflow.com/questions/9673057/wmic-error-invalid-xsl-format-in-windows7">here</a>

@method checkCmd
*/
Query.prototype.appendFormat = function() {
    if (this._help) {
        this._cmd += ' /?';
    } else if (this.verb == 'call') {
        //removing format if found
        this._cmd = this._cmd.replace(/\/format(.*?)( |$)/, "");
    } else if (this.verb == 'get') {
        //special format are supported only by get method
        if(this._format == 'JSON') {
            /* some might think it would have been easier to parse csv than format:list
             * and I tried it at first... But after some tests on a few servers
             * I've found out that some services description/caption contain comma.
             * And thus the split(",") on the output was shifting columns result
             */
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

/**
exec command and fire callback.
Params of the callback is an object with a cmd key containing de wmic command and either
a data key containing WMIResult data or 
an err key containing WMIError data
@method exec
@param [callback] callback to be executed once the command result has been parsed
@async
*/
Query.prototype.exec = function(callback) {
    //callback's optionnal so if not set giving it an empty function
    if (!callback) callback = function() {return;};
    if (!this.cmd) {
        this.buildCmd();
    } else {
        this.checkCmd();
    }
    if (Query.SUPPORTED_VERBS.indexOf(this._verb) == -1) {
        callback({err: "Unsupported "+this.verb, stderr:""});
        return;
    }
    var q = this; //stored to be available in callback
    cp_exec(this.cmd,{"encoding":"utf8", "timeout": this.timeout}, function(err, stdout, stderr) {
        var error,
            result;
        if (err) {
            error = new WMIError(err, q);
            callback({cmd:q.cmd, err:error.data()});
        } else {
            result = new WMIResult(stdout, q);
            //adding executed cmd
            callback({cmd:q.cmd, data:result.data()});
        }
    });
};
/**
List of the implemented verbs
@property
@static
@final
*/
Query.SUPPORTED_VERBS = ['get', 'call', 'NO_VERB'];
/**
List of the supported output format
@property
@static
@final
*/
Query.SUPPORTED_FORMATS = ['XML', 'CSV', 'HFORM', 'HTABLE', 'RAW'];

/**
list all available alias.
Note : options param accept the same keys than Query constructor but some of them will be over-ride 
to produce expected result.
@method listAlias
@static
@param options query options, see Query constructor
@param [callback] callback to be executed once the command result has been parsed
@async
@example
    //get alias list and log their name
    wmi.listAlias({node : 'localhost'}, function(r) {
        for(var i=0; i<r.data.length; i++) {
            console.log(r.data[i].alias, '-', r.data[i].caption);
        }
    });
**/
Query.listAlias  = function (options, callback) {
    //setting expected and cleaning unexpected options 
    options.verb = "NO_VERB";
    options.help = true;
    options.parser = "getHelpToJSON";
    delete options.alias;
    delete options.where;
    new Query(options).exec(callback);
};

/**
build and exec get query 
@method get
@static
@param options query options, see Query constructor
@param [callback] callback to be executed once the command result has been parsed
@async
@example
    //get os name of localhost, log the result
    wmi.get({node : 'localhost', format:'JSON' , alias:'os', field:'Name'}, function(r) {
        console.log("OS is :", r.data[0].Name);
    });
    //get all stopped service on host
    wmi.get({node:'host', alias:'service', where: 'Started=FALSE', format:'JSON'}, function(r) {
        //...
    });
**/
Query.get = function(options, callback) {
    options.verb = 'get';
    new Query(options).buildCmd().exec(callback);
};

/**
build and exec call query 
@method call
@static
@param options query options, see {{#crossLink "Query"}}
@param [callback] callback to be executed once the command result has been parsed
@async
@example
    //start tomcat7 service and log the command's returned value
    wmi.call({node:'host', alias:'service', where: 'Name="Tomcat7"', action:'startservice', format:'JSON'}, function(r) {
        console.log("Command "+r.cmd+" has returned "+r.data.returnValue);
    });
**/ 
Query.call = function(options, callback) {
    options.verb = 'call';
    new Query(options).exec(callback);
};


/**
WMI result class.
@class WMIResult
@constructor
@param output {String} wmic command line output
@param query {Query} query object that has produced output
*/
var WMIResult = function(output, query) {
    var format = query.format || 'JSON',
        verb = query.verb || 'get';
    this.parser = null;
    this.output = output;
    //finding parser
    this.findParserFor(query);
};

/**
Returns parsed data
@method data
@return {Object|String} result of the parsing
*/
WMIResult.prototype.data = function() {
    return this.parser(this.output);
};

/**
Find best parser for query
@method findParserForReturns 
@param {Query} query
@return {Function} parser method
*/
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
 
/**
get command output to JSON parser
@method getToJSON
@param {String} output
@return {Object} result of parsing
*/
WMIResult.prototype.getToJSON = function (output) {
    var temp = cmdResultToArray(output),
        separator, 
        i, 
        found,
        result = [],
        r={},
        emptyR = true;
    for(i=0;i<temp.length; i++) {
        if (temp[i]== WMIResult.LINESEP) {
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

/**
call command output to JSON parser
@method callToJSON
@param {String} output
@return {Object} result of parsing
*/
WMIResult.prototype.callToJSON = function(output) {
    var temp = cmdResultToArray(output),
        returnValue = null,
        i, 
        m;
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

/**
get help command output to JSON parser
@method getHelpToJSON
@param {String} output
@return {Object} result of parsing
*/
WMIResult.prototype.getHelpToJSON  = function (output) {
    //warning FIRST_ALIAS and LAST_ALIAS might change depending on system
    var FIRST_ALIAS = 'ALIAS',
        LAST_ALIAS = 'WMISET',
        temp = cmdResultToArray(output),
        i, 
        content,
        foundStart= false,
        list = [];
    for(i=0;i<temp.length; i++) {
        if (temp[i]== WMIResult.LINESEP) {
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

/**
get raw result
@method raw
@param {String} output
@return {String} cmd result, can have multiple content format. See Query.SUPPORTED_FORMATS
*/
WMIResult.prototype.raw = function(output) {
    return output;
};

/**
use to join/split outputline
@property LINESEP
@type String
@static
@private
@final
*/
WMIResult.LINESEP = "###SEP###";

/**
WMI error class.
@class WMIError
@constructor
@param err {String} wmic failed command line output 
@param query {Query} query object that has produced output
*/
var WMIError = function(err, query) {
    var format = query.format || 'JSON';
    this.err = err;
    this.parser = null;
    //finding parser
    this.findParserFor(query);
};

/**
Returns parsed data
@method data
@return {Object|String} result of the parsing
*/
WMIError.prototype.data = function() {
    return this.parser(this.err);
};

/**
Find best parser for query
@method findParserForReturns 
@param {Query} query
@return {Function} parser method
*/
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

/**
command err to JSON parser
@method toJSON
@param {String} output
@return {Object} result of parsing
*/
WMIError.prototype.toJSON = function (err) {
    var temp = cmdResultToArray(err.message),
        cleaned = [],
        i;
    //cleaning a few things
    for (i=0;i<temp.length; i++) {
        if (temp[i] && temp[i].indexOf('Command failed')!==-1) {
            cleaned.push(temp[i]);
        }
    }
    return {
        message : cleaned.join("\r\n"),
        code : err.code
    };
};


/**
get raw result
@method raw
@param {String} output
@return {String} cmd result, can have multiple content format. See Query.SUPPORTED_FORMATS
*/
WMIError.prototype.raw = function(err) {
    return err.message;
};


/** helpers **/
function cmdResultToArray(output) {
    //splitting output, 4 empty lines means new items
    return output.replace(/(\r?\n|\r){4,}/g, "£"+WMIResult.LINESEP+"£").replace(/(\r?\n|\r)+/g, "£").split("£");
}



module.exports = Query;


