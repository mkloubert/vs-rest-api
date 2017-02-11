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

/**
 * Object that contains the data for a new HTML document tab.
 */
export interface NewHtmlDocument {
    /**
     * The content.
     */
    content?: string;
    /**
     * The title of the new tab.
     */
    title?: string;
}


// [POST] /html
export function POST(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    let canOpen = args.request.user.get<boolean>(rapi_host_users.VAR_CAN_OPEN);

    return new Promise<any>((resolve, reject) => {
        let htmlDocs: rapi_contracts.Document[] = args.workspaceState[rapi_contracts.VAR_HTML_DOCS];
        
        let newHtmlDoc: rapi_contracts.Document;
        let completed = (err?: any) => {
            if (err) {
                rapi_helpers.removeDocuments(newHtmlDoc, htmlDocs);

                reject(err);
            }
            else {
                resolve();
            }
        };

        if (!canOpen) {
            args.sendForbidden();
            completed();

            return;
        }

        let enc = 'utf8';

        rapi_helpers.readHttpBodyAsJSON<NewHtmlDocument | string>(args.request.request, enc).then((obj) => {
            try {
                newHtmlDoc = {
                    body: undefined,
                    encoding: enc,
                    id: ++args.workspaceState[rapi_contracts.VAR_NEXT_HTML_DOC_ID],
                    mime: 'text/html',
                };

                if (obj) {
                    if ('object' !== typeof obj) {
                        // string
                        newHtmlDoc.body = new Buffer(rapi_helpers.toStringSafe(obj), enc);
                    }
                    else {
                        // NewHtmlDocument

                        if (obj.content) {
                            newHtmlDoc.body = new Buffer(rapi_helpers.toStringSafe(obj.content), enc);
                        }

                        if (obj.title) {
                            newHtmlDoc.title = rapi_helpers.toStringSafe(obj.title);
                        }
                    }
                }

                htmlDocs.push(newHtmlDoc);

                vscode.commands.executeCommand('extension.restApi.openHtmlDoc', newHtmlDoc).then(() => {
                    completed();
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
    });
}
