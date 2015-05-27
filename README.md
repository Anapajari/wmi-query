## Synopsis

WMI-Query class/module is a nodejs package enabling "Web-Based Enterprise Management" on microsoft OS using "Windows Management Instrumentation" and more precisely **wmic** command line tools. Thus **it needs to be run on a microsoft OS**.

## Code Example

```
    //requiring module
    var wmi = require("wmi-query");
    //log os of localhost
    wmi.get({format:'JSON' , alias:'os', field:'Name'}, function(r) {
        console.log('OS is', r.data[0].Name);
    });
    //list of available alias on remote server
    wmi.listAlias({node : 'remote_computer', format:'JSON' }, function(r) {
        for(var i=0; i<r.data.length; i++) {
            console.log(r.data[i].alias);
        }
    });
    //start a service named example on remote_computer
    wmi.call({node:"remote_computer", alias:'service', where: 'Name="example"', action:'startservice', format:'JSON'}, function(r) {
        if (r.err) {
            console.log("Start service failed with message:", r.err);
        } else {
            console.log("Command has returned
        }
    });
```

## Motivation

I needed a way to check state, start/stop services on a couple of remote computer from a web interface.
Then Microsoft announced there nano server edition which is heavily relying on wmi so I though it was a good time to start learning more about it.

## Installation
Since I haven't publish this to npm yet and there is no dependency, just download wmi-query file and require it.

I'm really planning on publishing this to npm, so when it will be done just do:
```
npm install wmi-query
```

## API Reference
[Documentation](docs/index.html) can be found [here](docs/index.html).


## Contributors

Feel like you can improve this, go for it!
I did mt best to write clean code but if you have any question just ask.

## License
MIT.

## Author
Matthieu
