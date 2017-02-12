/// <reference types="node" />

// The MIT License (MIT)
// 
// vs-rest-api (https://github.com/mkloubert/vs-rest-api)
// Copyright (c) Marcel Joachim Kloubert <marcel.kloubert@gmx.net>
// 
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE.

import * as HTTP from 'http';
import * as HTTPs from 'https';
import * as i18 from './i18';
import * as Moment from 'moment';
import * as Path from 'path';
import * as rapi_contracts from './contracts';
import * as rapi_helpers from './helpers';
import * as URL from 'url';
import * as vscode from 'vscode';


export function emitHooks(apiArgs: rapi_contracts.ApiMethodArguments,
                          hookToEmit: string, hookArgs: any[]): boolean {
    hookToEmit = rapi_helpers.normalizeString(hookToEmit);
    hookArgs = hookArgs || [];
    
    let emitted = false;

    if (hookToEmit) {
        try {
            let listOfHooks = apiArgs.request.config.hooks;
            if (listOfHooks) {
                for (let hp in listOfHooks) {
                    try {
                        let hookPattern = new RegExp(rapi_helpers.toStringSafe(hp), 'i');

                        if (!hookPattern.test(hookToEmit)) {
                            continue;
                        }

                        emitted = true;

                        let allHooks = rapi_helpers.asArray(listOfHooks[hp])
                                                   .filter(x => x)
                                                   .map(x => {
                                                            let hookObj: rapi_contracts.ApiHook = <any>x;
                                                            if ('object' !== typeof x) {
                                                                hookObj = {
                                                                    script: rapi_helpers.toStringSafe(x),
                                                                };
                                                            }

                                                            return hookObj;
                                                        })
                                                    .filter(x => !rapi_helpers.isEmptyString(x.script));

                        allHooks.forEach((h) => {
                            try {
                                let hookScript = h.script;
                                if (!Path.isAbsolute(hookScript)) {
                                    hookScript = Path.join(vscode.workspace.rootPath, hookScript);
                                }
                                hookScript = Path.resolve(hookScript);

                                let hookModule: rapi_contracts.ApiHookModule = require(hookScript);
                                if (hookModule) {
                                    let executor = hookModule.onHook;
                                    if (executor) {
                                        let executorArgs: rapi_contracts.ApiHookExecutorArguments = {
                                            api: apiArgs,
                                            globals: apiArgs.globals,
                                            globalState: undefined,
                                            hook: hookToEmit,
                                            log: function(msg) {
                                                apiArgs.log(msg);
                                                return this;
                                            },
                                            openHtml: (html, title, docId) => {
                                                return rapi_helpers.openHtmlDocument(apiArgs.workspaceState[rapi_contracts.VAR_HTML_DOCS],
                                                                                     html, title, docId);
                                            },
                                            options: h.options,
                                            require: (id) => {
                                                return rapi_helpers.requireModule(id);
                                            },
                                            state: undefined,
                                            workspaceState: undefined,
                                        };

                                        // executorArgs.globalState
                                        Object.defineProperty(executorArgs, 'globalState', {
                                            enumerable: true,
                                            get: function() {
                                                return this.workspaceState['globalHookStates'];
                                            }
                                        });

                                        // executorArgs.state
                                        Object.defineProperty(executorArgs, 'state', {
                                            enumerable: true,
                                            get: function() {
                                                return this.workspaceState['globalHookScriptStates'][hookScript];
                                            },
                                            set: function(newValue) {
                                                this.workspaceState['globalHookScriptStates'][hookScript] = newValue;
                                            }   
                                        });

                                        // executorArgs.workspaceState
                                        Object.defineProperty(executorArgs, 'workspaceState', {
                                            enumerable: true,
                                            get: function() {
                                                return apiArgs.workspaceState;
                                            }
                                        });

                                        let executorResult = executor(executorArgs);
                                        if (executorResult) {
                                            executorResult.then(() => {
                                                //TODO
                                            }, (err) => {
                                                rapi_helpers.log(i18.t('errors.withCategory', 'hooks.emitHooks(4)', err));
                                            });
                                        }
                                    }
                                }
                            }
                            catch (e) {
                                rapi_helpers.log(i18.t('errors.withCategory', 'hooks.emitHooks(3)', e));
                            }
                        });
                    }
                    catch (e) {
                        rapi_helpers.log(i18.t('errors.withCategory', 'hooks.emitHooks(2)', e));
                    }
                }
            }
        }
        catch (e) {
            emitted = null;

            rapi_helpers.log(i18.t('errors.withCategory', 'hooks.emitHooks(1)', e));
        }
    }

    return emitted;
}
