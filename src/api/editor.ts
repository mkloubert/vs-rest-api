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
import * as rapi_helpers from '../helpers';
import * as rapi_host from '../host';
import * as vscode from 'vscode';


//    /api/editor
export function get(apiCtx: rapi_host.ApiContext): Promise<any> {
    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        try {
            let nextAction = () => {
                apiCtx.sendNotFound();

                completed();
            };
    
            let editor = vscode.window.activeTextEditor;
            if (editor) {
                let doc = editor.document;
                if (doc) {
                    let fileName = doc.fileName;
                    let fullPath = fileName;
                    let filePath: string;
                    let mime: string;
                    let sendResponse = () => {
                        apiCtx.response.data = {
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

                    nextAction = () => {
                        sendResponse();
                    };

                    if (!doc.isUntitled) {
                        let relativePath = rapi_helpers.toRelativePath(fileName);
                        fileName = Path.basename(fileName);
                        mime = rapi_helpers.detectMimeByFilename(fullPath);

                        if (false !== relativePath) {
                            nextAction = null;
                            
                            apiCtx.request.user.isFileVisible(fullPath).then((isVisible) => {
                                if (isVisible) {
                                    filePath = rapi_helpers.toStringSafe(relativePath);
                                    filePath = rapi_helpers.replaceAllStrings(filePath, "\\", '/');
                                    filePath = rapi_helpers.replaceAllStrings(filePath, Path.sep, '/');

                                    filePath = '/api/workspace' + filePath.split('/')
                                                                          .map(x => encodeURIComponent(x))
                                                                          .join('/');

                                    sendResponse();
                                }
                                else {
                                    apiCtx.sendNotFound();
                                    
                                    completed();
                                }
                            }).catch((err) => {
                                completed(err);
                            });
                        }
                    }
                }
            }

            if (nextAction) {
                nextAction();
            }
        }
        catch (e) {
            completed(e);
        }
    });
}
