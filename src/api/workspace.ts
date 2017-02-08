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
import * as Moment from 'moment';
import * as rapi_contracts from '../contracts';
import * as rapi_helpers from '../helpers';
import * as rapi_host from '../host';
import * as rapi_host_users from '../host/users';
import * as vscode from 'vscode';


/**
 * HTTP header for defining the file type.
 */
export const HEADER_FILE_TYPE = 'X-vscode-restapi-type';

interface DirectoryItem extends FileSystemItem {
}

interface FileItem extends FileSystemItem {
    mime: string;
    size: number;
}

interface FileSystemItem {
    birthtime: Date;
    ctime: Date;
    fullPath: string;
    mtime: Date;
    name: string;
}


function handleDirectory(args: rapi_contracts.ApiMethodArguments, dir: string): Promise<any> {
    let canOpen = args.request.user.get<boolean>(rapi_host_users.VAR_CAN_OPEN);

    return new Promise<any>((resolve, reject) => {
        let dirs: DirectoryItem[] = [];
        let files: FileItem[] = [];
        let completed = (err?: any, sendList?: boolean) => {
            sendList = rapi_helpers.toBooleanSafe(sendList, true);

            if (err) {
                reject(err);
            }
            else {
                if (sendList) {
                    dirs = dirs.sort((x, y) => {
                        return rapi_helpers.compareValues(rapi_helpers.normalizeString(x),
                                                          rapi_helpers.normalizeString(y));
                    });

                    files = files.sort((x, y) => {
                        return rapi_helpers.compareValues(rapi_helpers.normalizeString(x),
                                                          rapi_helpers.normalizeString(y));
                    });

                    let list = {
                        dirs: [],
                        files: [],
                    };

                    let toDateTime = (x: Date) => {
                        if (!x) {
                            return;
                        }

                        return Moment(x).utc().toISOString();
                    };

                    let normalizePath = (p: string): string => {
                        p = rapi_helpers.toStringSafe(p);

                        if (!p) {
                            return p;
                        }

                        p = rapi_helpers.replaceAllStrings(p, "\\", '/');
                        p = rapi_helpers.replaceAllStrings(p, Path.sep, '/');

                        return p;
                    };

                    let relativePath = rapi_helpers.toRelativePath(dir);

                    dirs.forEach((x) => {
                        list.dirs.push({
                            creationTime: toDateTime(x.birthtime),
                            lastChangeTime: toDateTime(x.ctime),
                            lastModifiedTime: toDateTime(x.mtime),
                            name: x.name,
                            path: '/api/workspace' + normalizePath(<any>relativePath).split('/')
                                                                                     .concat([ x.name ])
                                                                                     .map(x => encodeURIComponent(x))
                                                                                     .join('/'),
                            type: 'dir',
                        });
                    });

                    files.forEach((x) => {
                        let filePath = normalizePath(<any>relativePath).split('/')
                                                                       .concat([ x.name ])
                                                                       .map(x => encodeURIComponent(x))
                                                                       .join('/');

                        let newFileItem = {
                            creationTime: toDateTime(x.birthtime),
                            lastChangeTime: toDateTime(x.ctime),
                            lastModifiedTime: toDateTime(x.mtime),
                            mime: x.mime,
                            name: x.name,
                            path: '/api/workspace' + filePath,
                            type: 'file',
                        };

                        if (canOpen) {
                            newFileItem['openPath'] = '/api/editor' + filePath;
                        }

                        list.files.push(newFileItem);
                    });

                    let parentDir = Path.resolve(dir, '..');
                    let relativeParentDir = rapi_helpers.toRelativePath(parentDir);
                    if (false !== relativeParentDir) {
                        if (parentDir != Path.resolve(dir)) {
                            relativeParentDir = rapi_helpers.replaceAllStrings(relativeParentDir, "\\", '/');
                            relativeParentDir = rapi_helpers.replaceAllStrings(relativeParentDir, Path.sep, '/');

                            list['parent'] = '/api/workspace' + normalizePath(relativeParentDir).split('/')
                                                                                                .map(x => encodeURIComponent(x))
                                                                                                .join('/');
                        }
                    }

                    args.response.data = list;

                    resolve();
                }
            }
        };

        args.headers[HEADER_FILE_TYPE] = 'directory';

        FS.readdir(dir, (err, items) => {
            if (err) {
                completed(err);
                return;
            }
            
            let nextItem: () => void;
            nextItem = () => {
                if (items.length < 1) {
                    completed();
                    return;
                }

                let i = items.shift();
                let fullPath = Path.join(dir, i);
                
                FS.lstat(fullPath, (err, stats) => {
                    if (err) {
                        completed(err);
                    }
                    else {
                        if (stats.isDirectory()) {
                            args.request.user.isDirVisible(fullPath, args.request.config.withDot).then((isVisible) => {
                                if (isVisible) {
                                    dirs.push({
                                        birthtime: stats.birthtime,
                                        ctime: stats.ctime,
                                        fullPath: fullPath,
                                        mtime: stats.mtime,
                                        name: i,
                                    });
                                }

                                nextItem();
                            }).catch((err) => {
                                completed(err);
                            });
                        }
                        else if (stats.isFile()) {
                            args.request.user.isFileVisible(fullPath, args.request.user.get<boolean>(rapi_host_users.VAR_WITH_DOT)).then((isVisible) => {
                                if (isVisible) {
                                    files.push({
                                        birthtime: stats.birthtime,
                                        ctime: stats.ctime,
                                        fullPath: fullPath,
                                        mime: rapi_helpers.detectMimeByFilename(i),
                                        mtime: stats.mtime,
                                        name: i,
                                        size: stats.size,
                                    });
                                }

                                nextItem();
                            }).catch((err) => {
                                completed(err);
                            });
                        }
                        else {
                            nextItem();
                        }
                    }
                });
            };

            nextItem();
        });
    });
}

function handleFile(args: rapi_contracts.ApiMethodArguments, file: string): Promise<any> {
    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        args.headers[HEADER_FILE_TYPE] = 'file';

        switch (args.request.method) {
            case 'get':
                // get file content
                FS.readFile(file, (err, data) => {
                    if (!err) {
                        args.setContent(data, rapi_helpers.detectMimeByFilename(file));
                    }

                    completed(err);
                });
                break;

            default:
                args.sendMethodNotAllowed();
                completed();
                break;
        }
    });
}


//    /api/workspace
function request(args: rapi_contracts.ApiMethodArguments): Promise<any> {
    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        let notFound = () => {
            args.sendNotFound();

            completed();
        };

        let methodNotAllowed = () => {
            args.sendMethodNotAllowed();

            completed();
        };

        try {
            let normalizedPath = rapi_helpers.toStringSafe(args.request.url.pathname);
            normalizedPath = rapi_helpers.replaceAllStrings(normalizedPath, "\\", '/');
            normalizedPath = rapi_helpers.replaceAllStrings(normalizedPath, Path.sep, '/');

            let parts = normalizedPath.split('/')
                                      .filter((x, i) => i > 2)
                                      .map(x => decodeURIComponent(x))
                                      .filter(x => x);

            let fullPath = Path.join(vscode.workspace.rootPath, parts.join('/'));

            let relativePath = rapi_helpers.toRelativePath(fullPath);
            if (false === relativePath) {
                notFound();
                return;
            }

            FS.exists(fullPath, (exists) => {
                if (exists) {
                    FS.lstat(fullPath, (err, stats) => {
                        if (err) {
                            completed(err);
                        }
                        else {
                            let nextAction = () => {
                                methodNotAllowed();
                            };

                            if (stats.isDirectory()) {
                                switch (args.request.method) {
                                    case 'get':
                                        nextAction = null;

                                        args.request.user.isDirVisible(fullPath, args.request.config.withDot).then((isVisible) => {
                                            if (isVisible) {
                                                handleDirectory(args, fullPath).then(() => {
                                                    completed();
                                                }).catch((err) => {
                                                    completed(err);
                                                });
                                            }
                                            else {
                                                notFound();
                                            }
                                        }).catch((err) => {
                                            completed(err);
                                        });
                                        break;
                                }
                            }
                            else if (stats.isFile()) {
                                nextAction = null;

                                args.request.user.isFileVisible(fullPath, args.request.user.get<boolean>(rapi_host_users.VAR_WITH_DOT)).then(() => {
                                    handleFile(args, fullPath).then(() => {
                                        completed();
                                    }).catch((err) => {
                                        completed(err);
                                    });
                                }).catch((err) => {
                                    completed(err);
                                });
                            }
                            else {
                                nextAction = () => {
                                    notFound();
                                };
                            }

                            if (nextAction) {
                                nextAction();
                            }
                        }
                    });
                }
                else {
                    notFound();
                }
            });
        }
        catch (e) {
            completed(e);
        }
    });
}

export const get = request;
