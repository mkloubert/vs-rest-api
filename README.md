# vs-rest-api

A [Visual Studio Code](https://code.visualstudio.com/) (VS Code) extension that provides a REST API to control your editor.

[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=9J3ZR95RJE2BA) [![](https://api.flattr.com/button/flattr-badge-large.png)](https://flattr.com/submit/auto?fid=o62pkd&url=https%3A%2F%2Fgithub.com%2Fmkloubert%2Fvs-rest-api)

## Table of contents

1. [Install](#install-)
2. [How to use](#how-to-use-)
   * [Settings](#settings-)
         * [Users](#users-)
         * [HTTPs](#https-)
   * [Build-in endpoints](#build-in-endpoints-)
         * [Commands](#commands-)
         * [Editor](#editor-)
         * [Workspace](#workspace-)
   * [Custom endpoints](#custom-endpoints-)
   * [Commands](#commands--1)

## Install [[&uarr;](#table-of-contents)]

Launch VS Code Quick Open (Ctrl+P), paste the following command, and press enter:

```bash
ext install vs-rest-api
```

Or search for things like `vs-deploy` in your editor.

## How to use [[&uarr;](#table-of-contents)]

### Settings [[&uarr;](#how-to-use-)]

Open (or create) your `settings.json` in your `.vscode` subfolder of your workspace.

Add a `deploy` section:

```json
{
    "rest.api": {
        "autoStart": true,
        "openInBrowser": true,
        "port": 1781
    }
}
```

This example will run the host on port `1781` on startup and opens the URL `https://localhost:1781/` in your default application, like your browser.

#### Users [[&uarr;](#settings-)]

By default anyone can access the API with read-only access.

You can define one or more users, that can access the API via [Basic Authentification](https://en.wikipedia.org/wiki/Basic_access_authentication): 

```json
{
    "rest.api": {
        // ...
        
        "guest": false,
        "users": [
            {
                "name": "mkloubert",
                "password": "P@sswort123!"
            },
            {
                "name": "jlpicard",
                "password": "NCC-1701-D"
            },
            {
                "name": "neo",
                "password": "Follow_the_white_rabbit"
            }
        ]
    }
}
```

By default any user (and guest) have read-only access.

#### HTTPs [[&uarr;](#settings-)]

For secure access, you can define a SSL certificate:

```json
{
    "rest.api": {
        // ...
        
        "ssl": {
            "cert": "./api-host.crt",
            "key": "./api-host.key"
        }
    }
}
```

### Build-in endpoints [[&uarr;](#how-to-use-)]

#### Commands [[&uarr;](#build-in-endpoints-)]

##### [GET] /api/commands

Gets the list of all commands.

Possible result:

```json
{
    "code": 0,
    "data": [
        // ...
        
        {
            "name": "editor.action.selectAll",
            "path": "/api/commands/editor.action.selectAll"
        },
        {
            "name": "editor.action.selectAllMatches",
            "path": "/api/commands/editor.action.selectAllMatches"
        },
        {
            "name": "editor.action.selectHighlights",
            "path": "/api/commands/editor.action.selectHighlights"
        },
        
        // ...
    ]
}
```

[canExecute](https://mkloubert.github.io/vs-rest-api/interfaces/_contracts_.account.html#canexecute) property must be set to `(true)` for an user or guest in the [settings](#settings-), otherwise a `404` response is returned.

##### [POST] /api/commands/{commandId}

Executes a command.

```
POST /api/commands/editor.action.selectAll
```

If the command requires arguments, you can submit them as JSON array in the request body:

```
POST /api/commands/myCommand

[
    'argument1',
    2,
    true,
    4.5
    null,
    undefined,
    false
]
```

[canOpen](https://mkloubert.github.io/vs-rest-api/interfaces/_contracts_.account.html#canopen) property must be set to `(true)` for an user or guest in the [settings](#settings-), otherwise a `404` response is returned.

#### Editor [[&uarr;](#build-in-endpoints-)]

##### [GET] /api/editor

Returns information about the active text editor:

```
GET /api/editor
```

Possible result:

```json
{
    "code": 0,
    "data": {
        "content": "<html>\r\n    \r\nHello, guys!\r\n\r\nThis file is currently edited!\r\n\r\n</html>",
        "file": {
            "mime": "text/html",
            "name": "test.html",
            "path": "/api/workspace/test.html"
        },
        "isDirty": true,
        "isUntitled": false,
        "lang": "html",
        "lines": 7
    }
}
```

If no editor is currently opened, a `404` response will be returned.

##### [POST] /api/editor{/file}

Opens a text editor of the given file inside VS Code:

```
POST /api/editor/test.html
```

![Demo Open file in editor](https://raw.githubusercontent.com/mkloubert/vs-rest-api/master/demos/demo1.gif)

If no file is defined, an untiled tab is opened.

#### Workspace [[&uarr;](#build-in-endpoints-)]

##### [GET] /api/workspace{/path}

Lists a directory inside the workspace or returns the content of a file:

```
GET /api/workspace
```

This will list the root root directory of your workspace. A possible result can be:

```json
{
    "code": 0,
    "data": {
        "dirs": [
            {
                "creationTime": "2017-01-22T14:26:56.482Z",
                "lastChangeTime": "2017-01-22T14:27:26.147Z",
                "lastModifiedTime": "2017-01-22T14:26:56.488Z",
                "name": "css",
                "path": "/api/workspace/css",
                "type": "dir"
            },
            {
                "creationTime": "2017-01-22T14:26:56.888Z",
                "lastChangeTime": "2017-01-22T14:27:26.152Z",
                "lastModifiedTime": "2017-01-22T14:26:56.908Z",
                "name": "js",
                "path": "/api/workspace/js",
                "type": "dir"
            },
            {
                "creationTime": "2017-01-22T14:26:26.631Z",
                "lastChangeTime": "2017-01-22T14:26:27.005Z",
                "lastModifiedTime": "2017-01-22T14:26:26.669Z",
                "name": "_res",
                "path": "/api/workspace/_res",
                "type": "dir"
            }
        ],
        "files": [
            {
                "creationTime": "2017-01-22T14:27:47.902Z",
                "lastChangeTime": "2017-01-23T21:07:37.595Z",
                "lastModifiedTime": "2017-01-23T21:07:37.595Z",
                "mime": "application/octet-stream",
                "name": "index.php",
                "path": "/api/workspace/index.php",
                "type": "file"
            },
            {
                "creationTime": "2017-02-01T23:58:54.173Z",
                "lastChangeTime": "2017-02-04T20:17:12.811Z",
                "lastModifiedTime": "2017-02-04T20:17:12.811Z",
                "mime": "text/html",
                "name": "test.html",
                "path": "/api/workspace/test.html",
                "type": "file"
            }
        ]
    }
}
```

You also can define an additional path argument to the endpoint that can list a sub directory or return the content of a file:

```
GET /api/workspace/test.php
```

You can check if the result is a file or directory, if you read the HTTP response header value `X-Vscode-Restapi-Type`, which can be `directory` or `file`.

### Custom endpoints [[&uarr;](#how-to-use-)]

You can define custom endpoints that are executed via script.

Define one ore more regular expressions in your [settings](#settings-) and the scripts that should be executed, if a patter matches:

```json
{
    "rest.api": {
        // ...
        
        "enpoints": {
            "myendpoint": {
                "script": "./my-endpoint.js",
                "options": "Hello!"
            }
        }
    }
}
```

The `./my-endpoint.js` must contain a public function with the name of the current HTTP request method (lower case).

For example if you want to make a simple `GET` request

```
GET /api/myendpoint
```

your script should look like this:

```javascript
exports.get = function(args) {
    // access VS Code API (s. https://code.visualstudio.com/Docs/extensionAPI/vscode-api)
    var vscode = require('vscode');
    
    // access NodeJS API provided by VS Code
    // s.  (s. https://nodejs.org/api/)
    var fs = require('fs');
    
    // access an own module
    var myModule = require('./my-module.js');
    
    // access a module used by the extension:
    // s. https://mkloubert.github.io/vs-rest-api/modules/_helpers_.html
    var helpers = args.require('./helpers');
    // s. https://mkloubert.github.io/vs-rest-api/modules/_host_helpers_.html
    var hostHelpers = args.require('./host/helpers');
    
    // access a module that is part of the extentsion
    // s. https://github.com/mkloubert/vs-rest-api/blob/master/package.json
    var glob = args.require('glob');
    
    // access the data from the settings
    // from the example above this is: "Hello!"
    var opts = args.options;
    
    // share / store data (while current session)...
    // ... for this script
    var myState = args.state;
    args.state = new Date();
    // ... with other scripts of this type
    args.globalState['myEndpoint'] = new Date();
    // ... with the whole workspace
    args.workspaceState['myEndpoint'] = new Date();
    
    // if you want to return an AJAX response object:
    // s. https://mkloubert.github.io/vs-rest-api/interfaces/_contracts_.apiresponse.html
    {
        args.response.code = 666;  // the response code (not the HTTP response code!)
        args.response.msg = 'Result of the evil!';  // a custom message for more information
        args.response.data = {
            'mk': 23979,
            'TM': '5979'
        };
    }
    
    // if you want to return custom content
    // instead of the object in 'args.response'
    // s. https://mkloubert.github.io/vs-rest-api/interfaces/_contracts_.apimethodarguments.html#setcontent
    {
        var html = fs.readFileSync('/path/to/my/file.html');
    
        args.setContent(html, 'text/html');
    }
    
    // custom HTTP status code
    args.statusCode = 202;

    // ...
}
```

The `args` parameter of the function uses the [ApiMethodArguments](https://mkloubert.github.io/vs-rest-api/interfaces/_contracts_.apimethodarguments.html) interface.

You can return a [Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise) for async executions or nothing for sync executions (as in this example).

You are also able to define functions for other request methods, like `POST` or `DELETE`:

```javascript
// [FOO]  /api/myendpoint
exports.foo = function(args) {
    // for custom request methods
}

// [DELETE]  /api/myendpoint
exports.delete = function(args) {
    return new Promise(function(resolve, reject) {
        // for async executions
        
        try {
            // ...
        
            resolve();  // MUST be called at the end
                        // on SUCCESS
        }
        catch (e) {
            reject(e);  // MUST be called at the end
                        // on ERROR
        }
    });
}

// [POST]  /api/myendpoint
exports.post = function(args) {
    // no (promise) result means: sync execution
}
```

HINT: Custom endpoints will always overwrite build-in ones!

### Commands [[&uarr;](#how-to-use-)]

Press `F1` to open the list of commands and select one of the following commands:

![Demo How to execute](https://raw.githubusercontent.com/mkloubert/vs-rest-api/master/demos/demo2.gif)

| Name | Description | ID |
| ---- | --------- | --------- |
| `REST API: Starts or stops the api server` | Toggles the state of the API's HTTP server. | `extension.restApi.toggleHostState` |
| `REST API: (Re)start the api server` | (Re-)Starts the API's HTTP server. | `extension.restApi.startHost` |
| `REST API: Stop the api server` | Stops the API. | `extension.restApi.stopHost` |
