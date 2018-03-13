# Change Log (vs-rest-api)

## 3.0.1 (March 13th, 2018; npm updates)

* updated the following [npm](https://www.npmjs.com/) modules:
  * [mime](https://www.npmjs.com/package/mime) `1.6.0`
  * [moment](https://www.npmjs.com/package/moment) `2.21.0`
* extension requires at least [Visual Studio Code 1.20](https://code.visualstudio.com/updates/v1_20) now

## 2.0.0 (October 14th, 2017; multi root support)

* started to refactor to new, upcoming [Multi Root Workspace API](https://github.com/Microsoft/vscode/wiki/Extension-Authoring:-Adopting-Multi-Root-Workspace-APIs)

## 1.18.0 (February 20th, 2017; deploy files from API scripts)

* added [deploy()](https://mkloubert.github.io/vs-rest-api/interfaces/_contracts_.apimethodarguments.html#deploy) method to [ApiMethodArguments](https://mkloubert.github.io/vs-rest-api/interfaces/_contracts_.apimethodarguments.html) which make use of `extension.deploy.filesTo` command, provided by [vs-deploy](https://github.com/mkloubert/vs-deploy) extension

## 1.17.0 (February 20th, 2017; custom endpoints only)

* added `customOnly` properties for [global](https://github.com/mkloubert/vs-rest-api/wiki#settings-) and [guest/users](https://github.com/mkloubert/vs-rest-api/wiki#users-and-guests-) settings

## 1.16.0 (February 19th, 2017; whiteboards)

* added feature for handling a virtual [whitebard](https://github.com/mkloubert/vs-rest-api/wiki/whiteboard)

## 1.15.0 (February 17th, 2017; cron jobs)

* added endpoint to handle [cron jobs](https://github.com/mkloubert/vs-rest-api/wiki#apicron-)

## 1.14.1 (February 16th, 2017; bugfixes)

* fixed search for API methods in [modules](https://mkloubert.github.io/vs-rest-api/interfaces/_contracts_.apimodule.html) as described in the [wiki](https://github.com/mkloubert/vs-rest-api/wiki#custom-endpoints-)

## 1.14.0 (February 14th, 2017; deploy files)

* can receive a list of available [deploy targets](https://github.com/mkloubert/vs-rest-api/wiki/buildin_endpoints_get_deploy) now

## 1.13.0 (February 14th, 2017; deploy files)

* added endpoint to [deploy files](https://github.com/mkloubert/vs-rest-api/wiki#apideploy-)

## 1.11.0 (February 13th, 2017; machine specific TCP ports)

* can define more than one TCP port in the [settings](https://github.com/mkloubert/vs-rest-api/wiki#settings-) now

## 1.10.0 (February 12th, 2017; ApiMethodArguments interface)

* added `endpoint`, `parameters` and `url` properties to [ApiMethodArguments](https://mkloubert.github.io/vs-rest-api/interfaces/_contracts_.apimethodarguments.html) interface

## 1.9.0 (February 12th, 2017; ApiMethodArguments interface)

* added `getString()` method to [ApiMethodArguments](https://mkloubert.github.io/vs-rest-api/interfaces/_contracts_.apimethodarguments.html) interface

## 1.8.0 (February 12th, 2017; open HTML documents in tabs from scripts)

* added `openHtml()` method to [ScriptArguments](https://mkloubert.github.io/vs-rest-api/interfaces/_contracts_.scriptarguments.html) interface

## 1.7.0 (February 12th, 2017; user specific endpoints)

* can define [whitelists for users and guests](https://github.com/mkloubert/vs-rest-api/wiki#user--guest-endpoints-) now, that define the endpoints which are available for the underlying account(s)

## 1.6.0 (February 12th, 2017; hooks)

* added support for [hooks](https://github.com/mkloubert/vs-rest-api/wiki/settings_hooks)

## 1.4.0 (February 11th, 2017; HTML documents)

* can open custom [HTML documents](https://github.com/mkloubert/vs-rest-api/wiki/buildin_endpoints_post_html) now

## 1.3.0 (February 11th, 2017; cleanups and improvements)

* added `executeBuildIn()` method to [ApiMethodArguments](https://mkloubert.github.io/vs-rest-api/interfaces/_contracts_.apimethodarguments.html)
* code cleanups and improvements
* bugfixes

## 1.2.0 (February 11th, 2017; translation)

* bugfixes
* continued translation
* improved logging

## 1.1.0 (February 11th, 2017; popups)

* can display [popups](https://github.com/mkloubert/vs-rest-api/wiki/buildin_endpoints_post_popups) now

## 1.0.0 (February 11th, 2017; initial release)

* read the [wiki](https://github.com/mkloubert/vs-rest-api/wiki) or the [README](https://github.com/mkloubert/vs-rest-api/blob/master/README.md) to learn more
