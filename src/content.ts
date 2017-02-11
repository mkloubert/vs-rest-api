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

import * as rapi_contracts from './contracts';
import * as rapi_controller from './controller';
import * as rapi_helpers from './helpers';
import * as vscode from 'vscode';


/**
 * HTML executor.
 * 
 * @param {HtmlViewerExecutorArguments} args The arguments.
 * 
 * @return {HtmlViewerExecutorResult} The result.
 */
export type HtmlViewerExecutor = (args: HtmlViewerExecutorArguments) => HtmlViewerExecutorResult;

/**
 * Arguments for a HTML executor.
 */
export interface HtmlViewerExecutorArguments {
    /**
     * The cancellation token.
     */
    readonly cancelToken: vscode.CancellationToken;
    /**
     * The URI.
     */
    readonly uri: vscode.Uri;
    /**
     * 
     */
    readonly workspaceState: Object;
}

/**
 * The result of a HTML executor.
 */
export type HtmlViewerExecutorResult = string | Thenable<string>;

/**
 * A module that executes logic for a HTML content provider.
 */
export interface HtmlViewerModule {
    /**
     * The HTML executor.
     */
    readonly execute: HtmlViewerExecutor;
}


/**
 * HTML content provider.
 */
export class HtmlTextDocumentContentProvider implements vscode.TextDocumentContentProvider {
    /**
     * Stores the underlying controller.
     */
    protected readonly _CONTROLLER: rapi_controller.Controller;
    
    /**
     * Initializes a new instance of that class.
     * 
     * @param {rapi_controller.Controller} controller The underlying controller instance.
     */
    constructor(controller: rapi_controller.Controller) {
        this._CONTROLLER = controller;
    }

    /**
     * Gets the underlying controller.
     */
    public get controller(): rapi_controller.Controller {
        return this._CONTROLLER;
    }

    /** @inheritdoc */
    public provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): Thenable<string> {
        let me = this;
        
        return new Promise<string>((resolve, reject) => {
            let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                let executor: HtmlViewerExecutor;

                const REGEX_MODULE = new RegExp(/^(\s)*(\/)?([^\/]+)/, 'i');

                let match = REGEX_MODULE.exec(uri.path);
                if (match) {
                    let moduleName = rapi_helpers.normalizeString(match[3]);
                    if (moduleName) {
                        let htmlModule: HtmlViewerModule = require('./html/modules/' + moduleName);
                        if (htmlModule) {
                            executor = htmlModule.execute;
                        }
                    }
                }

                let executed = (err?: any, result?: any) => {
                    if (err) {
                        completed(err);
                    }
                    else {
                        completed(null, result ? rapi_helpers.toStringSafe(result)
                                               : result);
                    }
                };

                if (executor) {
                    let executorArgs: HtmlViewerExecutorArguments = {
                        cancelToken: token,
                        uri: uri,
                        workspaceState: undefined,
                    };

                    // executorArgs.workspaceState
                    Object.defineProperty(executorArgs, 'workspaceState', {
                        enumerable: true,
                        get: () => {
                            return me.controller.workspaceState;
                        }
                    });

                    let executorResult = executor(executorArgs);
                    if ('object' === typeof executorResult) {
                        executorResult.then((result) => {
                            executed(null, result);
                        }, (err) => {
                            executed(err);
                        });
                    }
                    else {
                        executed(null, executorResult);
                    }
                }
                else {
                    executed(new Error('No executor found!'));
                }
            }
            catch (e) {
                completed(e);
            }
        });
    }
}
