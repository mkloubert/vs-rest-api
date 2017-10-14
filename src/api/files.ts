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
import * as Moment from 'moment';
import * as Path from 'path';
import * as rapi_contracts from '../contracts';
import * as rapi_helpers from '../helpers';
import * as rapi_host_users from '../host/users';
import * as rapi_workspace from '../workspace';
import * as vscode from 'vscode';


/**
 * Options for a file search.
 */
export interface FindFilesOptions {
    /**
     * The glob pattern of files to exclude.
     */
    exclude?: string;
    /**
     * The glob pattern of files to include.
     */
    include?: string;
    /**
     * Maximum number of items to return.
     */
    maxResults?: number;
}


function normalizePath(p: string) {
    p = rapi_helpers.toStringSafe(p);
    if (!p) {
        return p;
    }

    p = rapi_helpers.replaceAllStrings(p, "\\", '/');
    p = rapi_helpers.replaceAllStrings(p, Path.sep, '/');

    return p;
}

// [POST] /files
export function POST(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    let canOpen = args.request.user.can('open');
    
    return new Promise<any>((resolve, reject) => {
        let files: rapi_contracts.File[] = [];
        let completed = (err?: any) => {
            if (err) {
                reject(err);
            }
            else {
                files.sort((x, y) => {
                    return rapi_helpers.compareValues(rapi_helpers.normalizeString(x.path),
                                                      rapi_helpers.normalizeString(y.path));
                });

                args.response.data = files;

                resolve();
            }
        };

        args.getJSON<FindFilesOptions>().then((opts) => {
            opts = opts || {
                include: undefined,
            };

            let include = rapi_helpers.toStringSafe(opts.include);
            if (rapi_helpers.isEmptyString(include)) {
                include = '**';
            }

            let exclude = rapi_helpers.toStringSafe(opts.exclude);
            if (rapi_helpers.isEmptyString(exclude)) {
                exclude = undefined;
            }

            let maxResult = parseInt(rapi_helpers.toStringSafe(opts.maxResults).trim());
            if (isNaN(maxResult)) {
                maxResult = undefined;
            }

            vscode.workspace.findFiles(include, exclude, maxResult).then((uris) => {
                let nextFile: () => void;
                nextFile = () => {
                    if (uris.length < 1) {
                        completed();
                        return;
                    }

                    let u = uris.shift();

                    let fullPath = u.fsPath;
                    if (!Path.isAbsolute(fullPath)) {
                        fullPath = Path.join(rapi_workspace.getRootPath(), fullPath);
                    }
                    fullPath = Path.resolve(fullPath);

                    args.request.user.isFileVisible(u.fsPath, args.request.user.account.withDot).then((isVisible) => {
                        if (isVisible) {
                            FS.stat(fullPath, (err, stats) => {
                                if (err) {
                                    completed(err);
                                }

                                let relativePath = rapi_helpers.toRelativePath(fullPath);
                                if (false !== relativePath) {
                                    if (stats.isFile()) {
                                        let filePath = normalizePath(relativePath).split('/')
                                                                                  .map(x => encodeURIComponent(x))
                                                                                  .join('/');

                                        let newFileItem: rapi_contracts.File = {
                                            creationTime: toISODateString(stats.birthtime),
                                            lastChangeTime: toISODateString(stats.ctime),
                                            lastModifiedTime: toISODateString(stats.mtime),
                                            mime: rapi_helpers.detectMimeByFilename(fullPath),
                                            name: Path.basename(filePath),
                                            path: '/api/workspace' + filePath,
                                            size: stats.size,
                                            type: 'file',
                                        };

                                        if (canOpen) {
                                            newFileItem.openPath = '/api/editor' + filePath;
                                        }

                                        files.push(newFileItem);
                                    }
                                }
                                    
                                nextFile();
                            });
                        }
                        else {
                            nextFile();
                        }
                    });
                };

                nextFile();
            }, (err) => {
                completed(err);
            });
        }, (err) => {
            completed(err);
        });
    });
}

function toISODateString(dt: Date): string {
    if (!dt) {
        return;
    }

    return Moment(dt).utc().toISOString();
}
