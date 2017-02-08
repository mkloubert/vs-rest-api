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
import * as vscode from 'vscode';


export function get(args: rapi_contracts.ApiMethodArguments): Promise<any> {
    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);
        
        vscode.commands.getCommands(false).then((commands) => {
            args.response.data = commands.map(x => {
                let cmdItem = {
                    name: x,
                    path: '/api/commands/' + encodeURIComponent(x),
                };

                return cmdItem;
            });

            args.response.data.sort((x, y) => {
                return rapi_helpers.compareValues(rapi_helpers.normalizeString(x.name),
                                                  rapi_helpers.normalizeString(y.name));
            });

            completed();
        }, (err) => {
            completed(err);
        });
    });
}

export function post(args: rapi_contracts.ApiMethodArguments): Promise<any> {
    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        let notFound = () => {
            args.sendNotFound();

            completed();
        };

        vscode.commands.getCommands(false).then((commands) => {
            let parts = args.path.split('/');

            let commandToExecute: string;
            if (parts.length > 1) {
                commandToExecute = rapi_helpers.normalizeString(parts[1]);
            }

            if (commandToExecute) {
                let knownCommand: string;
                for (let i = 0; i < commands.length; i++) {
                    let kc = commands[i];

                    if (rapi_helpers.normalizeString(kc) == commandToExecute) {
                        knownCommand = kc;
                        break;
                    }
                }

                if (knownCommand) {
                    args.getJSON<any>().then((body) => {
                        let cmdArgs: any[];
                        if (body) {
                            cmdArgs = rapi_helpers.asArray<Object | Object[]>(body);
                        }

                        try {
                            vscode.commands
                                  .executeCommand
                                  .apply(null, [ knownCommand ].concat(cmdArgs))
                                  .then(() => {
                                            completed();
                                        }, (err) => {
                                            completed(err);
                                        });
                        }
                        catch (e) {
                            completed(e);
                        }
                    }).catch((err) => {
                        completed(err);
                    });
                }
                else {
                    notFound();
                }
            }
            else {
                notFound();
            }
        }, (err) => {
            completed(err);
        });
    });
}
