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

import * as rapi_contracts from '../contracts';
import * as rapi_helpers from '../helpers';
import * as rapi_host_users from '../host/users';
import * as vscode from 'vscode';

function extensionToObject(extension: vscode.Extension<any>): Object {
    let obj: Object;

    if (extension) {
        obj = {
            id: rapi_helpers.toStringSafe(extension.id),
            isActive: rapi_helpers.toBooleanSafe(extension.isActive),
            localPath: rapi_helpers.toStringSafe(extension.extensionPath),
        };

        obj['path'] = '/api/extensions/' + encodeURIComponent(obj['id']);
    }

    return obj;
}

// [GET] /extensions
export function GET(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    return new Promise<any>((resolve, reject) => {
        let completed = (err?: any, extensions?: Object[]) => {
            if (err) {
                reject(err);
            }
            else {
                args.response.data = extensions;

                resolve();
            }
        };

        try {
            let extensions = vscode.extensions.all.filter(x => x)
                                                  .map(x => extensionToObject(x));

            extensions.sort((x, y) => {
                return rapi_helpers.compareValues(rapi_helpers.normalizeString(x['id']),
                                                  rapi_helpers.normalizeString(y['id']));
            });

            completed(null,
                      extensions);
        }
        catch (e) {
            completed(e);
        }
    });
};

// [POST] /extensions/{id}
export function POST(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    let canActivate = args.request.user.get<boolean>(rapi_host_users.VAR_CAN_ACTIVATE);

    return new Promise<any>((resolve, reject) => {
        let completed = (err?: any) => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        };

        if (!canActivate) {
            args.sendForbidden();
            completed();
            
            return;
        }

        try {
            let parts = args.path.split('/');

            let id: string;
            if (parts.length > 1) {
                id = rapi_helpers.normalizeString(parts[1]);
            }

            let extensions = vscode.extensions.all.filter(x => x);

            let result = [];

            let nextExtension: () => void;
            nextExtension = () => {
                if (extensions.length < 1) {
                    if (result.length < 1) {
                        args.sendNotFound();
                    }
                    else {
                        args.response.data = result;
                    }

                    completed();
                    return;
                }

                let ext = extensions.shift();

                if (rapi_helpers.normalizeString(ext.id) == id) {
                    ext.activate().then(() => {
                        result.push(extensionToObject(ext));

                        nextExtension();
                    }, (err) => {
                        completed(err);
                    });
                }
                else {
                    nextExtension();
                }
            };

            nextExtension();
        }
        catch (e) {
            completed(e);
        }
    });
};
