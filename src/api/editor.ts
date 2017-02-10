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

import * as FS from 'fs';
import * as Path from 'path';
import * as rapi_contracts from '../contracts';
import * as rapi_helpers from '../helpers';
import * as rapi_host from '../host';
import * as rapi_host_users from '../host/users';
import * as vscode from 'vscode';


// [DELETE] /editor
export function DELETE(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    let canClose = args.request.user.get<boolean>(rapi_host_users.VAR_CAN_CLOSE);

    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        if (!canClose) {
            args.sendForbidden();
            completed();
            return;
        }

        try {
            let editor = vscode.window.activeTextEditor;
            if (editor) {
                vscode.commands.executeCommand('workbench.action.closeActiveEditor').then(() => {
                    completed();
                }, (err) => {
                    completed(err);
                });
            }
            else {
                // no (matching) tab found
                args.sendNotFound();

                completed();
            }
        }
        catch (e) {
            completed(e);
        }
    });
}

// [GET] /editor
export function GET(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        try {
            let doc: vscode.TextDocument;
    
            let editor = vscode.window.activeTextEditor;
            if (editor) {
                doc = editor.document;
            }

            rapi_helpers.textDocumentToObject(doc, args.request.user).then((obj) => {
                if (obj) {
                    args.response.data = obj;
                }
                else {
                    args.sendNotFound();
                }

                completed();
            }, (err) => {
                completed(err);
            });
        }
        catch (e) {
            completed(e);
        }
    });
}

// [PATCH] /editor
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
            let editor = vscode.window.activeTextEditor;
            if (editor) {
                rapi_helpers.readHttpBody(args.request.request).then((body) => {
                    try {
                        let str = (body || Buffer.alloc(0)).toString('utf8');

                        rapi_helpers.setContentOfTextEditor(editor, str).then((doc) => {
                            rapi_helpers.textDocumentToObject(editor.document, args.request.user).then((obj) => {
                                args.response.data = obj;

                                completed();
                            }, (err) => {
                                completed(err);
                            });
                        }, (err) => {
                            completed(err);
                        });
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

// [POST] /editor[/{file}]
export function POST(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    let canOpen = args.request.user.get<boolean>(rapi_host_users.VAR_CAN_OPEN);

    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        let notFound = () => {
            args.sendNotFound();
            completed();
        };

        if (!canOpen) {
            args.sendForbidden();
            completed();
            return;
        }

        try {
            let path = args.path;
            let firstSep = path.indexOf('/');

            let fileToOpen: string;
            if (firstSep > -1) {
                fileToOpen = path.substring(firstSep + 1);
            }

            if (rapi_helpers.isEmptyString(fileToOpen)) {
                fileToOpen = null;
            }

            let openFile = () => {
                vscode.workspace.openTextDocument(fileToOpen).then((doc) => {
                    let returnDoc = () => {
                        completed();
                    };

                    vscode.window.showTextDocument(doc).then(() => {
                        rapi_helpers.textDocumentToObject(doc, args.request.user).then((obj) => {
                            args.response.data = obj;

                            returnDoc();
                        }, (err) => {
                            completed(err);
                        });
                    }, (err) => {
                        // opened, but not shown

                        args.response.code = 1;

                        returnDoc();
                    });
                }, (err) => {
                    completed(err);
                });
            };

            if (fileToOpen) {
                let fullPath = Path.join(vscode.workspace.rootPath, fileToOpen);

                let relativePath = rapi_helpers.toRelativePath(fullPath);
                if (false === relativePath) {
                    // cannot open files outside workspace
                    notFound();
                }
                else {
                    FS.stat(fullPath, (err, stats) => {
                        if (err) {
                            completed(err);
                        }
                        else {
                            if (stats.isFile()) {
                                args.request.user.isFileVisible(fullPath, args.request.user.get<boolean>(rapi_host_users.VAR_WITH_DOT)).then((isVisible) => {
                                    if (isVisible) {
                                        fileToOpen = fullPath;

                                        openFile();
                                    }
                                    else {
                                        notFound();  // not visible
                                    }
                                }, (err) => {
                                    completed(err);
                                });
                            }
                            else {
                                notFound();  // we can only open files
                            }
                        }
                    }); 
                }
            }
            else {
                openFile();  // open untiled tab
            }
        }
        catch (e) {
            completed(e);
        }
    });
}

// [PUT] /editor
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
            let editor = vscode.window.activeTextEditor;
            let doc: vscode.TextDocument;

            if (editor) {
                doc = editor.document;
            }

            if (doc) {
                doc.save();

                rapi_helpers.textDocumentToObject(doc, args.request.user).then((obj) => {
                    args.response.data = obj;

                    completed();
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
