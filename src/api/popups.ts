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

import * as rapi_contracts from '../contracts';
import * as rapi_helpers from '../helpers';
import * as rapi_host_users from '../host/users';
import * as vscode from 'vscode';


interface ActionMessageItem extends vscode.MessageItem {
    action: () => void;
}

/**
 * A message item.
 */
export interface ShowMessageItem {
    /**
     * The arguments for the command.
     */
    args?: any[];
    /**
     * The command to execute.
     */
    command?: string;
    /**
     * The caption / title for the item.
     */
    title: string;
}

/**
 * Options for showing a message.
 */
export interface ShowMessageOptions {
    /**
     * The message.
     */
    message: string;
    /**
     * The items / buttons.
     */
    items?: ShowMessageItem | ShowMessageItem[];
    /**
     * The type.
     */
    type?: "e" | "err" | "error" |
           "i" | "info" | "information" |
           "w" | "warn" | "warning";
}

// [POST] /popups
export function POST(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    let canExecute = args.request.user.can('execute');
    
    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        if (!canExecute) {
            args.sendForbidden();
            completed();
            return;
        }

        args.getJSON<any>().then((obj) => {
            try {
                let opts: ShowMessageOptions = obj;
                if (opts) {
                    if ("object" !== typeof obj) {
                        opts = {
                            message: rapi_helpers.toStringSafe(opts),
                            type: "i",
                        };
                    }
                }

                opts = opts || {
                    message: undefined,
                    type: "i",
                };

                let items: ActionMessageItem[] = rapi_helpers.asArray(opts.items).map(x => {
                    let msgItem: ActionMessageItem = {
                        action: undefined,
                        title: rapi_helpers.toStringSafe(x.title),
                    };

                    let cmd = rapi_helpers.toStringSafe(x.command).trim();
                    if (cmd) {
                        let cmdArgs = [ cmd ].concat(x.args || []);

                        msgItem.action = () => { 
                            vscode.commands.executeCommand.apply(null, cmdArgs).then(() => {
                                //TODO
                            }, (err) => {
                                rapi_helpers.log(`[ERROR] api.popups.POST.${cmd}: ${rapi_helpers.toStringSafe(err)}`);
                            });
                        };
                    }
                    else {
                        msgItem.action = () => { };
                    }

                    return msgItem;
                }).filter(x => x);

                let func: Function;
                switch (rapi_helpers.normalizeString(opts.type)) {
                    case 'e':
                    case 'error':
                    case 'err':
                        func = vscode.window.showErrorMessage;
                        break;

                    case 'w':
                    case 'warning':
                    case 'warn':
                        func = vscode.window.showWarningMessage;
                        break;

                    default:
                        func = vscode.window.showInformationMessage;
                        break;
                }

                let funcArgs: any[] = [ rapi_helpers.toStringSafe(opts.message) ];
                funcArgs = funcArgs.concat(items);

                func.apply(null, funcArgs).then((i: ActionMessageItem) => {
                    if (i) {
                        try {
                            i.action();
                        }
                        catch (e) {
                            rapi_helpers.log(`[ERROR] api.popups.POST: ${rapi_helpers.toStringSafe(e)}`);
                        }
                    }
                    else {
                        completed();
                    }
                }, (err) => {
                    completed(err);
                });

                completed();
            }
            catch (e) {
                completed(e);
            }
        }, (err) => {
            completed(err);
        });
    });
}
