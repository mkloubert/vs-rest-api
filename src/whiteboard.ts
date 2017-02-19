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
const FSExtra = require('fs-extra');
import * as i18 from './i18';
import * as Moment from 'moment';
import * as Path from 'path';
import * as rapi_contracts from './contracts';
import * as rapi_controller from './controller';
import * as rapi_helpers from './helpers';
import * as vscode from 'vscode';


/**
 * The initial value for a "next" revision number.
 */
export const INITIAL_REVISION_NEXT_NR = 0;

/**
 * Regular expression of a shiteboard file.
 */
export const REGEX_WHITEBOARD_FILE = /^(rev_)(\d{16})(\.)(whiteboard)(\.)(json)$/;

/**
 * Content of a whiteboard revision file.
 */
export interface WhiteboardRevisionFile {
    /**
     * The content in Base64 format.
     */
    body?: string;
    /**
     * The encoding.
     */
    encoding?: string;
    /**
     * The ID.
     */
    id?: string;
    /**
     * The MIME type.
     */
    mime?: string;
    /**
     * The timestamp.
     */
    time?: string;
    /**
     * The title.
     */
    title?: string;
}

/**
 * A basic whiteboard repository.
 */
export abstract class WhiteboardRepositoryBase implements rapi_contracts.WhiteboardRepository {
    /**
     * Stores the configuration for this repository.
     */
    protected readonly _CONFIG: rapi_contracts.WhiteboardConfiguration;
    /**
     * Stores the underlying controller.
     */
    protected readonly _CONTROLLER: rapi_controller.Controller;
    /**
     * Stores the current revision.
     */
    protected _current: rapi_contracts.WhiteboardRevision;
    /**
     * The next revision ID.
     */
    protected _nextRevisionNr = INITIAL_REVISION_NEXT_NR;

    /**
     * Initializes a new instance of that class.
     * 
     * @param {rapi_controller.Controller} controller The underlying controller.
     * @param {rapi_controller.WhiteboardConfiguration} config The configuration for the repository.
     */
    constructor(controller: rapi_controller.Controller,
                config: rapi_contracts.WhiteboardConfiguration) {
        config = rapi_helpers.cloneObject(config);
        if (!config) {
            config = {
                isActive: true,
            };
        }

        this._CONTROLLER = controller;
        this._CONFIG = config;
    }

    /** @inheritdoc */
    public abstract addRevision(board: rapi_contracts.Whiteboard): PromiseLike<rapi_contracts.WhiteboardRevision>;

    /**
     * Clears the output directory.
     * 
     * @returns {PromiseLike<boolean>} The promise.
     */
    protected clearDirectory(): PromiseLike<boolean>  {
        let me = this;
        
        return new Promise<boolean>((resolve, reject) => {
            let completed = (err: any, result?: boolean) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(result);
                }
            };

            me.forEachFile((data, filePath) => {
                FS.unlinkSync(filePath);
            }).then((hasDirectory) => {
                completed(null, hasDirectory);
            }, (err) => {
                completed(err);
            });
        });
    }

    /**
     * Gets the configuration for this repository.
     */
    public get config(): rapi_contracts.WhiteboardConfiguration {
        return this._CONFIG;
    }

    /**
     * Gets the underlying controller.
     */
    public get controller(): rapi_controller.Controller {
        return this._CONTROLLER;
    }

    /**
     * Creates the output directory if needed.
     * 
     * @returns {PromiseLike<string>} The promise.
     */
    protected createDirectoryIfNeeded(): PromiseLike<string> {
        let me = this;

        return new Promise<string>((resolve, reject) => {
            let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                let dir = rapi_helpers.toStringSafe(me._CONFIG.dir);
                if (rapi_helpers.isEmptyString(dir)) {
                    completed(null);
                }
                else {
                    if (!Path.isAbsolute(dir)) {
                        dir = Path.join(vscode.workspace.rootPath, dir);
                    }
                    dir = Path.resolve(dir);

                    let checkIfDirectory = () => {
                        FS.lstat(dir, (err, stats) => {
                            if (err) {
                                completed(err);
                                return;
                            }

                            if (stats.isDirectory()) {
                                completed(null, dir);
                            }
                            else {
                                // path is NO directory
                                completed(new Error(i18.t('isNo.dir')));
                            }
                        });
                    };

                    FS.exists(dir, (exsists) => {
                        if (exsists) {
                            checkIfDirectory();
                        }
                        else {
                            // directory must be created first

                            FSExtra.ensureDir(dir, (err) => {
                                if (err) {
                                    completed(err);
                                }
                                else {
                                    checkIfDirectory();
                                }
                            });
                        }
                    });
                }
            }
            catch (e) {
                completed(e);
            }
        });
    }

    /** @inheritdoc */
    public get current(): rapi_contracts.WhiteboardRevision {
        return this._current;
    }

    /** @inheritdoc */
    public abstract dispose();

    /**
     * Invokes a callback for each whiteboard file.
     * 
     * @param {Function} cb The callback.
     * 
     * @returns {PromiseLike<boolean>} The promise.
     */
    protected forEachFile(cb: (data: Buffer, filePath: string, stats: FS.Stats) => void): PromiseLike<boolean> {
        let me = this;
        
        return new Promise<boolean>((resolve, reject) => {
            let completed = (err: any, result?: boolean) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(result);
                }
            };
            
            try {
                me.createDirectoryIfNeeded().then((dir) => {
                    if (rapi_helpers.isEmptyString(dir)) {
                        completed(null, false);
                    }
                    else {
                        FS.readdir(dir, (err, files) => {
                            if (err) {
                                completed(err);
                                return;
                            }

                            files = files.sort((x, y) => {
                                return rapi_helpers.compareValues(rapi_helpers.normalizeString(x),
                                                                  rapi_helpers.normalizeString(y));
                            });
                            
                            let nextFile: () => void;
                            nextFile = () => {
                                if (files.length < 1) {
                                    completed(null, true);
                                    return;
                                }

                                let fn = files.shift();
                                if (!REGEX_WHITEBOARD_FILE.test(fn)) {
                                    nextFile();  // no whiteboard file
                                    return;
                                }

                                let fullPath = Path.join(dir, fn);
                                FS.lstat(fullPath, (err, stats) => {
                                    if (err) {
                                        completed(err);
                                    }
                                    else {
                                        if (stats.isFile()) {
                                            FS.readFile(fullPath, (err, data) => {
                                                if (err) {
                                                    completed(err);
                                                }
                                                else {
                                                    try {
                                                        if (cb) {
                                                            cb(data, fullPath, stats);
                                                        }

                                                        nextFile();
                                                    }
                                                    catch (e) {
                                                        completed(e);
                                                    }
                                                }
                                            });
                                        }
                                        else {
                                            nextFile();  // no file => try next
                                        }
                                    }
                                });
                            };

                            nextFile();
                        });
                    }
                }, (err) => {
                    completed(err);
                });
            }
            catch (e) {
                completed(e);
            }
        });
    }

    /** @inheritdoc */
    public abstract get(nr?: number): PromiseLike<rapi_contracts.WhiteboardRevision>;

    /** @inheritdoc */
    public abstract init(): PromiseLike<boolean>;

    /** @inheritdoc */
    protected reset(): PromiseLike<boolean> {
        let me = this;

        return new Promise<boolean>((resolve, reject) => {
            let completed = (err: any) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(true);
                }
            };

            me.clearDirectory().then(() => {
                me.init().then(() => {
                    completed(null);
                }, (err) => {
                    completed(err);
                });
            }, (err) => {
                completed(err);
            });
        });
    }

    /**
     * Resets the internal variables.
     */
    protected resetVars() {
        this._current = undefined;
        this._nextRevisionNr = INITIAL_REVISION_NEXT_NR;
    }

    /**
     * Saves a revision to file.
     * 
     * @param {rapi_contracts.WhiteboardRevision} revision The revision to save.
     * 
     * @returns {PromiseLike<string>} The promise.
     */
    protected saveRevision(revision: rapi_contracts.WhiteboardRevision): PromiseLike<string> {
        let me = this;
        
        return new Promise<string>((resolve, reject) => {
            let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                me.createDirectoryIfNeeded().then((dir) => {
                    if (rapi_helpers.isEmptyString(dir)) {
                        completed(null);
                        return;
                    }

                    let fileName = 'rev';
                    fileName += '_' + ('0000000000000000' + revision.nr).slice(-16);
                    fileName += '.whiteboard.json';
                    
                    let filePath = Path.join(dir, fileName);
                    
                    let fileContent: WhiteboardRevisionFile = {
                    };

                    if (revision.board) {
                        if (revision.board.body) {
                            fileContent.body = revision.board.body.toString('base64');
                        }

                        if (!rapi_helpers.isEmptyString(revision.board.encoding)) {
                            fileContent.encoding = rapi_helpers.normalizeString(revision.board.encoding);
                        }

                        if (!rapi_helpers.isEmptyString(revision.board.mime)) {
                            fileContent.mime = rapi_helpers.normalizeString(revision.board.mime);
                        }

                        if (!rapi_helpers.isEmptyString(revision.board.title)) {
                            fileContent.title = rapi_helpers.toStringSafe(revision.board.title);
                        }

                        if (!rapi_helpers.isNullOrUndefined(revision.board.id)) {
                            fileContent.id = rapi_helpers.toStringSafe(revision.board.id);
                        }
                    }

                    if (revision.time) {
                        fileContent.time = revision.time.toISOString();
                    }

                    FS.writeFile(filePath, new Buffer(JSON.stringify(fileContent), 'utf8'), (err) => {
                        if (err) {
                            completed(err);
                        }
                        else {
                            completed(null, filePath);
                        }
                    });
                }, (err) => {
                    completed(err);
                });
            }
            catch (e) {
                completed(e);
            }
        });
    }

     /** @inheritdoc */
    public setBoard(board: rapi_contracts.Whiteboard): PromiseLike<rapi_contracts.WhiteboardRevision> {
        let me = this;
        
        return new Promise<rapi_contracts.WhiteboardRevision>((resolve, reject) => {
            let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

            // first reset repo ...
            me.reset().then(() => {
                // ... last but not least: add first revision
                me.addRevision(board).then((newRevision) => {
                    completed(null, newRevision);
                }, (err) => {
                    completed(err);
                });
            }, (err) => {
                completed(err);
            });
        });
    }
}

/**
 * A whiteboard repository that stores its revisions in memory.
 */
export class MemoryWhitespaceRepository extends WhiteboardRepositoryBase {
    /**
     * Stores the revisions.
     */
    protected _revisions: rapi_contracts.WhiteboardRevision[];

    /** @inheritdoc */
    public addRevision(board: rapi_contracts.Whiteboard): PromiseLike<rapi_contracts.WhiteboardRevision> {
        let me = this;
        
        return new Promise<rapi_contracts.WhiteboardRevision>((res, rej) => {
            let completed = rapi_helpers.createSimplePromiseCompletedAction(res, rej);
            
            try {
                if (board) {
                    let newRevision: rapi_contracts.WhiteboardRevision;

                    newRevision = {
                        board: board,
                        next: undefined,
                        nr: undefined,
                        previous: undefined,
                        time: Moment().utc(),
                    };

                    let newIndex: number;

                    me.updateNextAndPreviousMethods(newRevision,
                                                    () => newIndex);

                    if (rapi_helpers.toBooleanSafe(me.config.isActive, true)) {
                        (<any>newRevision).nr = me._nextRevisionNr++;

                        me.saveRevision(newRevision).then((filePath) => {
                            newRevision.__file = filePath;

                            newIndex = me._revisions.push(newRevision) - 1;
                            me._current = newRevision;

                            completed(null, newRevision);
                        }, (err) => {
                            completed(err);
                        });
                    }
                    else {
                        completed(null, newRevision);
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

    /** @inheritdoc */
    public dispose() {
        this._CONFIG.isActive = false;
        this._CONFIG.dir = null;

        this._revisions = [];
    }

    /** @inheritdoc */
    public get(nr?: number): PromiseLike<rapi_contracts.WhiteboardRevision> {
        let me = this;
        
        return new Promise<rapi_contracts.WhiteboardRevision>((resolve, reject) => {
            let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                let revision: rapi_contracts.WhiteboardRevision;

                nr = parseInt(rapi_helpers.toStringSafe(nr).trim());
                if (isNaN(nr)) {
                    revision = me.current;
                }
                else {
                    let machtingRevision = me._revisions.filter(x => x.nr === nr);
                    if (machtingRevision.length > 0) {
                        revision = machtingRevision[machtingRevision.length - 1];
                    }
                }

                completed(null, revision);
            }
            catch (e) {
                completed(e);
            }
        });
    }

    /** @inheritdoc */
    public init(): PromiseLike<boolean> {
        let me = this;
        
        return new Promise<boolean>((resolve, reject) => {
            let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

            let newResivionList: rapi_contracts.WhiteboardRevision[] = [];
            me.forEachFile((data, filePath, stats) => {
                if (!data || data.length < 1) {
                    return;
                }

                let obj: WhiteboardRevisionFile = JSON.parse(data.toString('utf8'));
                if (!obj) {
                    return;
                }

                let fn = REGEX_WHITEBOARD_FILE.exec(Path.basename(filePath));

                let newRevision: rapi_contracts.WhiteboardRevision = {
                    board: {
                        body: undefined,
                    },
                    next: undefined,
                    nr: parseInt(fn[2]),
                    previous: undefined,
                    time: undefined,
                };

                if (obj.body) {
                    newRevision.board.body = new Buffer(obj.body, 'base64');
                }

                if (rapi_helpers.isEmptyString(obj.time)) {
                    (<any>newRevision).time = Moment(stats.birthtime);
                }
                else {
                    (<any>newRevision).time = Moment(rapi_helpers.toStringSafe(obj.time));
                }

                newRevision.board.encoding = rapi_helpers.toStringSafe(obj.encoding);
                newRevision.board.id = rapi_helpers.toStringSafe(obj.id);
                newRevision.board.mime = rapi_helpers.toStringSafe(obj.mime);
                newRevision.board.title = rapi_helpers.toStringSafe(obj.title);

                newResivionList.push(newRevision);
            }).then(() => {
                newResivionList = newResivionList.sort((x, y) => {
                    return rapi_helpers.compareValues(x.nr, y.nr);
                });

                newResivionList.forEach((x, i) => {
                    me.updateNextAndPreviousMethods(x,
                                                    () => i);
                });

                me.resetVars();
                
                if (newResivionList.length > 0) {
                    let curRev = newResivionList[newResivionList.length - 1];

                    me._current = curRev;
                    me._nextRevisionNr = curRev.nr + 1;
                }
                
                me._revisions = newResivionList;

                completed();
            }, (err) => {
                completed(err);
            });
        });
    }

    /** @inheritdoc */
    protected resetVars() {
        super.resetVars();

        this._revisions = [];
    }
    
    /**
     * Updates the 'next()' and 'previous()' methods of a revision.
     * 
     * @param {rapi_contracts.WhiteboardRevision} revision The revision.
     * @param {Function} [indexProvider] The function that provides the underlying index.
     */
    protected updateNextAndPreviousMethods(revision: rapi_contracts.WhiteboardRevision,
                                           indexProvider?: () => number): rapi_contracts.WhiteboardRevision {
        if (revision) {
            let me = this;

            let getIndex = (): number => {
                let i: number;
                if (indexProvider) {
                    i = indexProvider();
                }

                return i;
            };
            
            // revision.next()
            (<any>revision).next = () => {
                let index = getIndex();

                return new Promise<rapi_contracts.WhiteboardRevision>((resolve, reject) => {
                    resolve(rapi_helpers.isNullOrUndefined(index) ? undefined
                                                                  : me._revisions[index + 1]);
                });
            };

            // revision.previous()
            (<any>revision).previous = () => {
                let index = getIndex();

                return new Promise<rapi_contracts.WhiteboardRevision>((resolve, reject) => {
                    resolve(rapi_helpers.isNullOrUndefined(index) ? undefined
                                                                  : me._revisions[index - 1]);
                });
            };
        }

        return revision;
    }
}
