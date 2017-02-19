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


// [GET] /api/whiteboard(/{revisiion})
export function GET(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    let whiteboard = args.whiteboard;

    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        let notFound = () => {
            args.sendNotFound();
            completed();
        };

        if (!whiteboard) {
            notFound();
            return;
        }

        let nr: number;
        if (args.endpoint.arguments.length > 0) {
            nr = parseInt(args.endpoint.arguments[0].trim());
        }

        whiteboard.get(nr).then((revision) => {
            try {
                if (revision) {
                    let buffer: Buffer;
                    let mime: string;
                    if (revision.board) {
                        if (revision.board.body) {
                            buffer = revision.board.body;
                        }

                        if (!rapi_helpers.isEmptyString(revision.board.mime)) {
                            mime = rapi_helpers.toStringSafe(revision.board.mime);

                            if (!rapi_helpers.isEmptyString(revision.board.encoding)) {
                                mime += '; charset=' + rapi_helpers.normalizeString(revision.board.encoding);
                            }
                        }
                    }

                    if (!buffer) {
                        buffer = Buffer.alloc(0);
                    }

                    args.headers['X-Vscode-Restapi-Revision'] = revision.nr;

                    args.setContent(buffer, mime);
                    completed();
                }
                else {
                    notFound();
                }
            }
            catch (e) {
                completed(e);
            }
        }, (err) => {
            completed(err);
        });
    });
}
