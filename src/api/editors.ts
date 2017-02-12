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


interface EditorWithId {
    editor: vscode.TextEditor;
    id?: number;
}

// [DELETE] /editors(/{id})
export function DELETE(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    let canClose = args.request.user.can('close');

    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        if (!canClose) {
            args.sendForbidden();
            completed();
            return;
        }

        try {
            let editor: any = getEditorById(args);

            if (editor) {
                // DEPRECATED
                editor.editor.hide();
            }
            else {
                // no (matching) tab found
                args.sendNotFound();
            }

            completed();
        }
        catch (e) {
            completed(e);
        }
    });
}

function editorToObject(editor: EditorWithId, user: rapi_contracts.User): PromiseLike<Object> {
    return new Promise((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        try {
            if (!editor) {
                completed();
                return;
            }

            rapi_helpers.textDocumentToObject(editor.editor.document, user).then((obj) => {
                if (obj) {
                    delete obj['openPath'];

                    if (!rapi_helpers.isNullOrUndefined(editor.id)) {
                        obj['id'] = editor.id;
                        obj['path'] = '/api/editors/' + editor.id;
                    }
                }

                completed(null, obj);
            }, (err) => {
                completed(err);
            });
        }
        catch (e) {
            completed(e);
        }
    });
}

// [GET] /editors
export function GET(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    return new Promise<any>((resolve, reject) => {
        let docs = [];
        let completed = (err?: any) => {
            if (err) {
                reject(err);
            }
            else {
                args.response.data = docs;

                resolve();
            }
        };

        try {
            let visibleEditors = vscode.window.visibleTextEditors.filter(x => x);

            let id = -1;
            let nextEditor: () => void;
            nextEditor = () => {
                if (visibleEditors.length < 1) {
                    completed();
                    return;
                }

                let editor: EditorWithId = {
                    editor: visibleEditors.shift(),
                    id: ++id,
                };

                editorToObject(editor, args.request.user).then((obj) => {
                    if (obj) {
                        obj['id'] = id;
                        obj['path'] = '/api/editors/' + id;

                        docs.push(obj);
                    }

                    nextEditor();
                }, (err) => {
                    completed(err);
                });
            };

            nextEditor();
        }
        catch (e) {
            completed(e);
        }
    });
}

function getEditorById(args: rapi_contracts.ApiMethodArguments): EditorWithId {
    let editor: EditorWithId;

    let parts = args.path.split('/');
    if (parts.length > 1) {
        let id = parts[1];
        if (rapi_helpers.isEmptyString(id)) {
            editor = {
                editor: vscode.window.activeTextEditor,
            };
        }
        else {
            let idValue = parseInt(id.trim());
            if (!isNaN(idValue)) {
                let visibleEditors = vscode.window.visibleTextEditors.filter(x => x);
                if (idValue >= 0 && idValue < visibleEditors.length) {
                    editor = {
                        editor: visibleEditors[idValue],
                        id: idValue,
                    };
                }
            }
        }
    }
    else {
        editor = {
            editor: vscode.window.activeTextEditor,
        };
    }

    return editor;
}

// [PATCH] /editors(/{id})
export function PATCH(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    let canWrite = args.request.user.can('write');

    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        if (!canWrite) {
            args.sendForbidden();
            completed();
            return;
        }

        try {
            let editor = getEditorById(args);

            if (editor) {
                args.getBody().then((body) => {
                    try {
                        let str = (body || Buffer.alloc(0)).toString('utf8');

                        rapi_helpers.setContentOfTextEditor(editor.editor, str).then((doc) => {
                            editorToObject(editor, args.request.user).then((obj) => {
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

// [POST] /editors(/{id})
export function POST(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    let canOpen = args.request.user.can('open');

    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        if (!canOpen) {
            args.sendForbidden();
            completed();
            return;
        }

        try {
            let editor = getEditorById(args);
            if (editor) {
                editor.editor.show();

                editorToObject(editor, args.request.user).then((obj) => {
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

// [PUT] /editors(/{id})
export function PUT(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    let canWrite = args.request.user.can('write');

    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        if (!canWrite) {
            args.sendForbidden();
            completed();
            return;
        }

        try {
            let editor = getEditorById(args);
            let doc: vscode.TextDocument;

            if (editor) {
                doc = editor.editor.document;
            }

            if (doc) {
                doc.save();

                editorToObject(editor, args.request.user).then((obj) => {
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
