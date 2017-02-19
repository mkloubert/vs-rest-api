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


/**
 * Name of the HTTP response header for a revision number.
 */
export const HTTP_HEADER_REVISION = 'X-Vscode-Restapi-Revision';
/**
 * Name of the HTTP response header for whiteboard title.
 */
export const HTTP_HEADER_TITLE = 'X-Vscode-Restapi-Title';

/**
 * A new whiteboard (revision),
 */
export interface NewWhiteboardRevision {
    /**
     * The Base64 content.
     */
    content: string;
    /**
     * The encoding.
     */
    encoding?: string;
    /**
     * The mime type.
     */
    mime?: string;
    /**
     * The title.
     */
    title?: string;
}

// [DELETE] /api/whiteboard
export function DELETE(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    let canDelete = args.request.user.can('delete');
    let whiteboard = args.whiteboard;

    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        if (!whiteboard) {
            args.sendNotFound();
            completed();

            return;
        }

        if (!canDelete) {
            args.sendForbidden();
            completed();

            return;
        }

        whiteboard.setBoard(null).then(() => {
            completed();
        }, (err) => {
            completed(err);
        });
    });
}

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
                    let title: string;
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

                        if (!rapi_helpers.isEmptyString(revision.board.title)) {
                            title = rapi_helpers.toStringSafe(revision.board.title);
                        }
                    }

                    if (!buffer) {
                        buffer = Buffer.alloc(0);
                    }

                    args.headers[HTTP_HEADER_REVISION] = revision.nr;

                    if (title) {
                        args.headers[HTTP_HEADER_TITLE] = title;
                    }

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

function handleSubmittedRevision(args: rapi_contracts.ApiMethodArguments,
                                 repo: rapi_contracts.WhiteboardRepository,
                                 func: (board: rapi_contracts.Whiteboard) => PromiseLike<rapi_contracts.WhiteboardRevision>): PromiseLike<rapi_contracts.WhiteboardRevision> {
    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        args.getJSON<NewWhiteboardRevision | string>().then((submittedRevision) => {
            try {
                if (submittedRevision) {
                    if ('object' !== typeof submittedRevision) {
                        submittedRevision = {
                            content: (new Buffer(rapi_helpers.toStringSafe(submittedRevision))).toString('base64'),
                            encoding: 'utf-8',
                        };

                        for (let h in args.request.request.headers) {
                            if ('content-type' === rapi_helpers.normalizeString(h)) {
                                submittedRevision.mime = rapi_helpers.normalizeString(args.request.request.headers[h]);
                            }
                        }

                        if (!submittedRevision.mime) {
                            submittedRevision.mime = 'text/plain';
                        }
                    }
                }
                else {
                    submittedRevision = {
                        content: undefined,
                    };
                }

                let newBoard: rapi_contracts.Whiteboard = {
                    body: undefined,
                };

                // content
                if (!rapi_helpers.isEmptyString(submittedRevision.content)) {
                    newBoard.body = new Buffer(submittedRevision.content, 'base64');
                }

                // title
                if (!rapi_helpers.isEmptyString(submittedRevision.title)) {
                    newBoard.title = rapi_helpers.toStringSafe(submittedRevision.title);
                }

                // mime
                if (!rapi_helpers.isEmptyString(submittedRevision.mime)) {
                    newBoard.mime = rapi_helpers.normalizeString(submittedRevision.mime);
                }
                if (!newBoard.mime) {
                    newBoard.mime = undefined;
                }

                // encoding
                if (!rapi_helpers.isEmptyString(submittedRevision.encoding)) {
                    newBoard.encoding = rapi_helpers.normalizeString(submittedRevision.encoding);
                }
                if (!newBoard.encoding) {
                    newBoard.encoding = undefined;
                }

                func.apply(repo, [ newBoard ]).then((newRevision: rapi_contracts.WhiteboardRevision) => {
                    args.headers[HTTP_HEADER_REVISION] = newRevision.nr;

                    if (newRevision.board) {
                        if (!rapi_helpers.isEmptyString(newRevision.board.title)) {
                            args.headers[HTTP_HEADER_TITLE] = rapi_helpers.toStringSafe(newRevision.board.title);
                        }
                    }

                    args.response.data = revisionToObject(newRevision);

                    completed(null, newRevision);
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

// [POST] /api/whiteboard
export function POST(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    let canDelete = args.request.user.can('delete');
    let canWrite = args.request.user.can('write');
    let whiteboard = args.whiteboard;

    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        if (!whiteboard) {
            args.sendNotFound();
            completed();

            return;
        }

        if (!canDelete || !canWrite) {
            args.sendForbidden();
            completed();

            return;
        }

        handleSubmittedRevision(args, whiteboard, whiteboard.setBoard).then(() => {
            completed();
        }, (err) => {
            completed(err);
        });
    });
}

// [PUT] /api/whiteboard
export function PUT(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    let canWrite = args.request.user.can('write');
    let whiteboard = args.whiteboard;

    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        if (!whiteboard) {
            args.sendNotFound();
            completed();

            return;
        }

        if (!canWrite) {
            args.sendForbidden();
            completed();

            return;
        }

        handleSubmittedRevision(args, whiteboard, whiteboard.addRevision).then(() => {
            completed();
        }, (err) => {
            completed(err);
        });
    });
}

function revisionToObject(revision: rapi_contracts.WhiteboardRevision): Object {
    let obj: Object;

    if (revision) {
        obj = {};

        if (isNaN(revision.nr)) {
            obj['path'] = '/api/whiteboard';
        }
        else {
            obj['path'] = '/api/whiteboard/' + revision.nr;
            obj['revision'] = revision.nr;
        }

        if (revision.board) {
            if (!rapi_helpers.isNullOrUndefined(revision.board.title)) {
                obj['title'] = rapi_helpers.toStringSafe(revision.board.title);
            }

            if (!rapi_helpers.isEmptyString(revision.board.mime)) {
                obj['mime'] = rapi_helpers.normalizeString(revision.board.mime);
            }

            if (!rapi_helpers.isEmptyString(revision.board.encoding)) {
                obj['encoding'] = rapi_helpers.normalizeString(revision.board.encoding);
            }

            let length: number;
            if (revision.board.body) {
                length = revision.board.body.length;
            }
            obj['length'] = length;
        }
    }

    return obj;
}