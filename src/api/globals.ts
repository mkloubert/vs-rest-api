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


// [DELETE] /globals/{name}
export function DELETE(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    let canDelete = args.request.user.get<boolean>(rapi_host_users.VAR_CAN_DELETE);

    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        if (!canDelete) {
            args.sendForbidden();
            completed();
            return;
        }

        try {
            let name = getVarName(args);

            let item = getRepoItem(args);

            let exists = (<Object>item.item).hasOwnProperty(name);

            let oldValue = item.item[name];
            delete item.item[name];

            args.extension.workspaceState.update(rapi_contracts.VAR_STATE, item.repository);

            args.response.data = {};
            if (exists) {
                args.response.data['old'] = oldValue;
            }

            completed();
        }
        catch (e) {
            completed(e);
        }
    });
}

// [GET] /globals
export function GET(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        try {
            let item = getRepoItem(args);

            args.response.data = item.item;

            completed();
        }
        catch (e) {
            completed(e);
        }
    });
}

function getRepoItem(args: rapi_contracts.ApiMethodArguments): rapi_contracts.StateRepositoryWithItem {
    let item: rapi_contracts.StateRepositoryWithItem = {
        item: undefined,
        repository: rapi_helpers.getStateRepository(args.extension.workspaceState, rapi_contracts.VAR_STATE),
    };

    item.item = item.repository.globals;

    return item;
}

function getVarName(args: rapi_contracts.ApiMethodArguments): string {
    let name: string;

    let parts = args.path.split('/');
    if (parts.length > 1) {
        name = parts[1];
    }

    return rapi_helpers.normalizeString(name);
}

// [PUT] /globals/{name}
export function PUT(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    let canWrite = args.request.user.get<boolean>(rapi_host_users.VAR_CAN_WRITE);

    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        if (!canWrite) {
            args.sendForbidden();
            completed();
            return;
        }

        try {
            let name = getVarName(args);

            let item = getRepoItem(args);

            rapi_helpers.readHttpBodyAsJSON<any>(args.request.request).then((newValue) => {
                try {
                    let isNew = !(<Object>item.item).hasOwnProperty(name);

                    let oldValue = item.item[name];
                    item.item[name] = newValue;

                    args.extension.workspaceState.update(rapi_contracts.VAR_STATE, item.repository);

                    args.response.data = {
                        isNew: isNew,
                        new: newValue,
                        old: oldValue,
                    };

                    completed();
                }
                catch (e) {
                    completed(e);
                }
            }, (err) => {
                completed(err);
            });
        }
        catch (e) {
            completed(e);
        }
    });
}
