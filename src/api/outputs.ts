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


interface ChannelWithId {
    channel: vscode.OutputChannel;
    id?: number;
}


// [DELETE] /outputs/{id}
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
            let channel = getChannelById(args);
            if (channel) {
                let outputChannels: vscode.OutputChannel[] = args.workspaceState['outputChannels'];
                if (outputChannels) {
                    outputChannels.splice(channel.id, 1);
                }

                channel.channel.dispose();
            }
            else {
                args.sendNotFound();
            }

            completed();
        }
        catch (e) {
            completed(e);
        }
    });
}

// [GET] /outputs
export function GET(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        try {
            let channels: Object[] = [
                outputChannelToObject(args.outputChannel),
            ];

            let outputChannels: vscode.OutputChannel[] = args.workspaceState['outputChannels'];
            if (outputChannels) {
                outputChannels.filter(x => x).forEach((x, i) => {
                    channels.push(outputChannelToObject(x, i));
                });
            }

            args.response.data = channels;

            completed();
        }
        catch (e) {
            completed(e);
        }
    });
}

function getChannelById(args: rapi_contracts.ApiMethodArguments): ChannelWithId {
    let channel: ChannelWithId;

    let parts = args.path.split('/');
    if (parts.length > 1) {
        let id = parts[1].trim();
        if (rapi_helpers.isEmptyString(id)) {
            channel = {
                channel: args.outputChannel,
            };
        }
        else {
            let idValue = parseInt(id);
            if (!isNaN(idValue)) {
                let outputChannels: vscode.OutputChannel[] = args.workspaceState['outputChannels'];
                if (!outputChannels) {
                    outputChannels = [];
                }
                outputChannels = outputChannels.filter(x => x);

                if (idValue >= 0 && idValue < outputChannels.length) {
                    channel = {
                        channel: outputChannels[idValue],
                        id: idValue,
                    };
                }
            }
        }
    }

    return channel;
}

function outputChannelToObject(channel: vscode.OutputChannel, id?: number): Object {
    if (!channel) {
        return;
    }

    let obj: Object = {
        name: rapi_helpers.toStringSafe(channel.name),
    };

    if (!rapi_helpers.isEmptyString(id)) {
        obj['id'] = id;
        obj['path'] = '/api/outputs/' + id;
    }

    return obj;
}

// [PATCH] /outputs/{id}
export function PATCH(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    let canWrite = args.request.user.get<boolean>(rapi_host_users.VAR_CAN_WRITE);

    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        if (!canWrite) {
            args.sendForbidden();
            completed();
            
            return;
        }

        try {
            let channel = getChannelById(args);
            if (channel) {
                rapi_helpers.readHttpBody(args.request.request).then((body) => {
                    try {
                        channel.channel.clear();

                        let str = body.toString('utf8');
                        if (str) {
                            channel.channel.append(str);
                        }

                        args.response.data = outputChannelToObject(channel.channel, channel.id);
                        completed();
                    }
                    catch (e) {
                        completed(e);
                    }
                }, (err) => {
                    completed(err);
                });
            }
            else {
                args.sendNotFound();

                completed();
            }
        }
        catch (e) {
            completed(e);
        }
    });
}

// [POST] /outputs/{name}
export function POST(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    let canCreate = args.request.user.get<boolean>(rapi_host_users.VAR_CAN_CREATE);

    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        if (!canCreate) {
            args.sendForbidden();
            completed();
            
            return;
        }

        try {
            let channelName: string;
            {
                let urlPath = rapi_helpers.toStringSafe(args.request.url.pathname).trim();

                let parts = urlPath.split('/');
                if (parts.length > 3) {
                    channelName = decodeURIComponent(parts[3]);
                }
            }
            channelName = rapi_helpers.toStringSafe(channelName).trim();

            let newChannel = vscode.window.createOutputChannel(channelName);
            
            let outputChannels: vscode.OutputChannel[] = args.workspaceState['outputChannels'];
            if (!outputChannels) {
                args.workspaceState['outputChannels'] = [];
            }

            args.workspaceState['outputChannels'].push(newChannel);
            args.response.data = outputChannelToObject(newChannel,
                                                       args.workspaceState['outputChannels'].length - 1);

            try {
                newChannel.show();
            }
            catch (e) {
                args.response.code = 1;  // create, but not shown
            }

            completed();
        }
        catch (e) {
            completed(e);
        }
    });
}


// [PUT] /outputs/{id}
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
            let channel = getChannelById(args);
            if (channel) {
                rapi_helpers.readHttpBody(args.request.request).then((body) => {
                    try {
                        let str = body.toString('utf8');
                        if (str) {
                            channel.channel.append(str);
                        }

                        args.response.data = outputChannelToObject(channel.channel, channel.id);
                        completed();
                    }
                    catch (e) {
                        completed(e);
                    }
                }, (err) => {
                    completed(err);
                });
            }
            else {
                args.sendNotFound();

                completed();
            }
        }
        catch (e) {
            completed(e);
        }
    });
}
