# vs-rest-api

[![Latest Release](https://vsmarketplacebadge.apphb.com/version-short/mkloubert.vs-rest-api.svg)](https://marketplace.visualstudio.com/items?itemName=mkloubert.vs-rest-api)
[![Installs](https://vsmarketplacebadge.apphb.com/installs/mkloubert.vs-rest-api.svg)](https://marketplace.visualstudio.com/items?itemName=mkloubert.vs-rest-api)
[![Rating](https://vsmarketplacebadge.apphb.com/rating-short/mkloubert.vs-rest-api.svg)](https://marketplace.visualstudio.com/items?itemName=mkloubert.vs-rest-api#review-details)

A [Visual Studio Code](https://code.visualstudio.com/) (VS Code) extension that provides a REST API to control your editor.

[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://paypal.me/MarcelKloubert)

## Table of contents

1. [Install](#install-)
2. [How to use](#how-to-use-)
   * [Settings](#settings-)
     * [Users](#users-)
     * [HTTPs](#https-)
   * [Build-in endpoints](#build-in-endpoints-)
   * [Custom endpoints](#custom-endpoints-)
   * [Commands](#commands--1)
3. [Documentation](#documentation-)

## Install [[&uarr;](#table-of-contents)]

Launch VS Code Quick Open (Ctrl+P), paste the following command, and press enter:

```bash
ext install vs-rest-api
```

Or search for things like `vs-rest-api` in your editor:

![Demo Search and install extension](https://raw.githubusercontent.com/mkloubert/vs-rest-api/master/demos/screenshot1.png)

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

Visit the [wiki](https://github.com/mkloubert/vs-rest-api/wiki#build-in-endpoints-) to get more information about build-in endpoints.

| Name | Description |
| ---- | --------- |
| [/api/appglobals](https://github.com/mkloubert/vs-rest-api/wiki#apiappglobals-) | Accesses permanent data for all users outside the current workspace.  |
| [/api/appstate](https://github.com/mkloubert/vs-rest-api/wiki#apiappstate-) | Accesses permanent data for the current user / guest outside the current workspace.  |
| [/api/commands](https://github.com/mkloubert/vs-rest-api/wiki#apicommands-) | Accesses commands.  |
| [/api/cron](https://github.com/mkloubert/vs-rest-api/wiki#apicron-) | Accesses cron jobs.  |
| [/api/deploy](https://github.com/mkloubert/vs-rest-api/wiki#apideploy-) | Accesses features to deploy files.  |
| [/api/editor](https://github.com/mkloubert/vs-rest-api/wiki#apieditor-) | Accesses resources of the active editor (tab).  |
| [/api/editors](https://github.com/mkloubert/vs-rest-api/wiki#apieditors-) | Accesses resources of all opened editors.  |
| [/api/extensions](https://github.com/mkloubert/vs-rest-api/wiki#apiextensions-) | Accesses resources of all known extensions.  |
| [/api/files](https://github.com/mkloubert/vs-rest-api/wiki#apifiles-) | Accesses resources for handling file operations.  |
| [/api/globals](https://github.com/mkloubert/vs-rest-api/wiki#apiglobals-) | Accesses permanent data for all users.  |
| [/api/html](https://github.com/mkloubert/vs-rest-api/wiki#apihtml-) | Accesses resources for handling HTML documents.  |
| [/api/languages](https://github.com/mkloubert/vs-rest-api/wiki#apilanguages-) | Accesses resources of all known languages.  |
| [/api/outputs](https://github.com/mkloubert/vs-rest-api/wiki#apioutputs-) | Accesses resources of output channels handled by the extension.  |
| [/api/popups](https://github.com/mkloubert/vs-rest-api/wiki#apipopups-) | Accesses resources for handling popup messages.  |
| [/api/state](https://github.com/mkloubert/vs-rest-api/wiki#apistate-) | Accesses permanent data for the current user / guest.  |
| [/api/whiteboard](https://github.com/mkloubert/vs-rest-api/wiki#apiwhiteboard-) | Accesses resources for handling a virtual whiteboard.  |
| [/api/workspace](https://github.com/mkloubert/vs-rest-api/wiki#apiworkspace-) | Accesses or manipulates resources, like files or folders, inside the current workspace.  |

### Custom endpoints [[&uarr;](#how-to-use-)]

Detailed information can be found at the [wiki](https://github.com/mkloubert/vs-rest-api/wiki#custom-endpoints-). Otherwise...

You can define custom endpoints that are executed via script.

Define one ore more [regular expressions](https://en.wikipedia.org/wiki/Regular_expression) in your [settings](#settings-) and the scripts that should be executed, if a pattern matches:

```json
{
    "rest.api": {
        // ...
        
        "endpoints": {
            "myendpoint": {
                "script": "./my-endpoint.js",
                "options": "Hello!"
            }
        }
    }
}
```

The `./my-endpoint.js` must contain a public function with the name of the current HTTP request method (upper case).

For example if you want to make a simple `GET` request

```http
GET /api/myendpoint
```

your script should look like this:

```javascript
exports.GET = function(args) {
    // access VS Code API (s. https://code.visualstudio.com/Docs/extensionAPI/vscode-api)
    var vscode = require('vscode');
    
    // access Node.js API provided by VS Code
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

        // open HTML document in new tab (for reports e.g.)
        args.openHtml(html.toString('utf8'), 'My HTML document from "file.html"').then(function() {
            // HTML opened
        }, function(err) {
            // opening HTML document failed
        });
    
        args.setContent(html, 'text/html');
    }

    // deploys 'index.html' to 'My SFTP server'
    // s. https://github.com/mkloubert/vs-deploy
    args.deploy(['./index.html'], ['My SFTP server']).then(function() {
        // file deployed
    }, function(err) {
        // deployment failed
    });
    
    // custom HTTP status code
    args.statusCode = 202;

    // ...
}
```

The `args` parameter of the function uses the [ApiMethodArguments](https://mkloubert.github.io/vs-rest-api/interfaces/_contracts_.apimethodarguments.html) interface.

You can return a [Promise](https://github.com/Microsoft/vscode-extension-vscode/blob/master/thenable.d.ts) for async executions or nothing for sync executions (as in this example).

You are also able to define functions for other request methods, like `POST` or `DELETE`, which are supported by [http](https://nodejs.org/api/http.html) / [https](https://nodejs.org/api/https.html) modules of [Node.js](https://nodejs.org/api/):

```javascript
// [DELETE]  /api/myendpoint
exports.DELETE = function(args) {
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
exports.POST = function(args) {
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

## Documentation [[&uarr;](#table-of-contents)]

The full documentation of the extension's API can be found [here](https://mkloubert.github.io/vs-rest-api/).

Detailed information on how to use the extension, can be found at the [wiki](https://github.com/mkloubert/vs-rest-api/wiki).
