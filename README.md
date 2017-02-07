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
         * [Workspace](#workspace-)
         * [Editor](#editor-)
   * [Custom endpoints](#custom-endpoints-)

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

If the result is a file or a directory can be checked by the HTTP response header value `X-Vscode-Restapi-Type`, which can be `directory` or `file`.

##### [POST] /api/workspace{/file}

Opens a text editor of the given file inside VS Code:

```
POST /api/workspace/test.php
```

![Demo Open file in editor](https://raw.githubusercontent.com/mkloubert/vs-rest-api/master/demos/demo1.gif)

#### Editor [[&uarr;](#build-in-endpoints-)]

### Custom endpoints [[&uarr;](#how-to-use-)]
