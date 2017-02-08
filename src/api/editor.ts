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

import * as Path from 'path';
import * as rapi_contracts from '../contracts';
import * as rapi_helpers from '../helpers';
import * as rapi_host from '../host';
import * as rapi_host_users from '../host/users';
import * as vscode from 'vscode';


function docToObject(doc: vscode.TextDocument, user: rapi_contracts.User): Promise<Object | false> {
    return new Promise<Object>((resolve, reject) => {
        let obj: Object | false;
        let completed = (err?: any) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(obj);
            }
        };

        try {
            if (doc) {
                let fileName = doc.fileName;
                let filePath: string;
                let fullPath = fileName;
                let mime: string;
                let createObjectAndReturn = () => {
                    obj = {
                        content: doc.getText(),
                        file: {
                            mime: mime,
                            name: fileName,
                            path: filePath,
                        },
                        isDirty: doc.isDirty,
                        isUntitled: doc.isUntitled,
                        lang: doc.languageId,
                        lines: doc.lineCount,
                    };

                    completed();
                };

                if (doc.isUntitled) {
                    createObjectAndReturn();
                }
                else {
                    let relativePath = rapi_helpers.toRelativePath(fileName);
                    fileName = Path.basename(fileName);
                    mime = rapi_helpers.detectMimeByFilename(fullPath);

                    if (false !== relativePath) {
                        user.isFileVisible(fullPath).then((isVisible) => {
                            if (isVisible) {
                                filePath = rapi_helpers.toStringSafe(relativePath);
                                filePath = rapi_helpers.replaceAllStrings(filePath, "\\", '/');
                                filePath = rapi_helpers.replaceAllStrings(filePath, Path.sep, '/');

                                filePath = '/api/workspace' + filePath.split('/')
                                                                      .map(x => encodeURIComponent(x))
                                                                      .join('/');

                                createObjectAndReturn();
                            }
                            else {
                                // not visible

                                obj = false;

                                completed();
                            }
                        }).catch((err) => {
                            completed(err);
                        });
                    }
                    else {
                        // do not submit path data of opened file
                        // because it is not part of the workspace
                        createObjectAndReturn();
                    }
                }
            }
            else {
                completed();
            }
        }
        catch (e) {
            completed(e);
        }
    });
}

// [GET] /editor
export function get(args: rapi_contracts.ApiMethodArguments): Promise<any> {
    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        try {
            let doc: vscode.TextDocument;
    
            let editor = vscode.window.activeTextEditor;
            if (editor) {
                doc = editor.document;
            }

            docToObject(doc, args.request.user).then((obj) => {
                try {
                    if (obj) {
                        args.response.data = obj;
                    }
                    else {
                        args.sendNotFound();
                    }

                    completed();
                }
                catch (e) {
                    completed(e);
                }
            }).catch((err) => {
                completed(err);
            });
        }
        catch (e) {
            completed(e);
        }
    });
}

// [POST] /editor[/{file}]
export function post(args: rapi_contracts.ApiMethodArguments): Promise<any> {
    let canOpen = args.request.user.get<boolean>(rapi_host_users.VAR_CAN_OPEN);

    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        let notFound = () => {
            args.sendNotFound();

            completed();
        };

        if (!canOpen) {
            notFound();
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
                        docToObject(doc, args.request.user).then((obj) => {
                            args.response.data = obj;

                            returnDoc();
                        }).catch((err) => {
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
                    args.request.user.isFileVisible(fullPath).then((isVisible) => {
                        if (isVisible) {
                            fileToOpen = fullPath;

                            openFile();
                        }
                        else {
                            notFound();  // not visible
                        }
                    }).catch((err) => {
                        completed(err);
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
