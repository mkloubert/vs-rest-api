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

const Glob = require('glob');
import * as Path from 'path';
import * as rapi_contracts from '../contracts';
import * as rapi_helpers from '../helpers';
import * as rapi_host from '../host';
import * as vscode from 'vscode';


/**
 * Name of a variable that defines if an user can see live updates or not.
 */
export const VAR_CAN_SEE_LIVE_UPDATES = 'can_see_live_updates';
/**
 * Name of a variable that stores the cache for visible files.
 */
export const VAR_VISIBLE_FILES = 'visible_files';

const DEFAULT_USER: rapi_contracts.Account = {
    __globals: {},
};
DEFAULT_USER.__globals[VAR_VISIBLE_FILES] = {};

/**
 * An user.
 */
export class User {
    /**
     * Stores the underlying account.
     */
    protected readonly _ACCOUNT: rapi_contracts.Account;
    /**
     * Stores the underlying request context.
     */
    protected readonly _CONTEXT: rapi_host.RequestContext;
    /**
     * Stores the if user is a guest or not.
     */
    protected readonly _IS_GUEST: boolean;

    /**
     * Initializes a new instance of that class.
     * 
     * @param {rapi_host.RequestContext} ctx The underlying request context.
     * @param {rapi_contracts.Account} account The underlying account object.
     * @param {boolean} isGuest Is guest or not.
     */
    constructor(ctx: rapi_host.RequestContext, account: rapi_contracts.Account, isGuest: boolean) {
        this._ACCOUNT = account;
        this._CONTEXT = ctx;
        this._IS_GUEST = rapi_helpers.toBooleanSafe(isGuest);
    }

    /**
     * Gets the underlying account.
     */
    public get account(): rapi_contracts.Account {
        return this._ACCOUNT;
    }

    /**
     * Gets the underlying request context.
     */
    public get context(): rapi_host.RequestContext {
        return this._CONTEXT;
    }

    public filterVisibleFiles(files: string | string[]): Promise<string[]> {
        let me = this;

        let filesToCheck = rapi_helpers.asArray(files)
                                       .filter(x => !rapi_helpers.isEmptyString(x));
        
        return new Promise<string[]>((resolve, reject) => {
            let visibleFiles: string[] = [];
            let completed = (err?: any) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(visibleFiles);
                }
            };

            let nextFile: () => void;
            nextFile = () => {
                if (filesToCheck.length < 1) {
                    completed();
                    return;
                }

                let f = filesToCheck.shift();

                me.isFileVisible(f).then((isVisible) => {
                    if (isVisible) {
                        visibleFiles.push(f);
                    }

                    nextFile();
                }).catch((err) => {
                    completed(err);
                });
            };

            nextFile();
        });
    }

    /**
     * Gets a variable of the user.
     * 
     * @param {string} name The name of the variable.
     * @param {T} [defaultValue] The default value.
     * 
     * @return {T} The value.
     */
    public get<T>(name: string, defaultValue?: T): T {
        name = this.parseVarName(name);

        let value = defaultValue;
        for (let p in this.account.__globals) {
            if (p == name) {
                value = this.account.__globals[p];
                break;
            }
        }

        return value;
    }

    /**
     * Checks if a variable exists.
     * 
     * @param {string} name The name of the variable.
     * 
     * @returns {boolean} Exists or not.
     */
    public has(name: string): boolean {
        name = this.parseVarName(name);

        return (<Object>this.account.__globals).hasOwnProperty(name);
    }

    /**
     * Gets if user is a guest or not.
     */
    public get isGuest(): boolean {
        return this._IS_GUEST;
    }

    /**
     * Checks if a file is visible for that user.
     * 
     * @param {string} file The file to check.
     * 
     * @returns {Promise<boolean>} The promise.
     */
    public isFileVisible(file: string): Promise<boolean> {
        let me = this;
        
        return new Promise<boolean>((resolve, reject) => {
            let completed = (err: any, isVisible?: boolean) => {
                if (err) {
                    reject();
                }
                else {
                    resolve(isVisible);
                }
            };

            try {
                let normalizePath = (p: string) => {
                    p = Path.resolve(p);
                    p = rapi_helpers.replaceAllStrings(p, Path.sep, '/');

                    return p;
                };

                file = normalizePath(file);

                let cache = me.get<Object>(VAR_VISIBLE_FILES);
                if (cache.hasOwnProperty(file)) {
                    // cached
                    completed(null, rapi_helpers.toBooleanSafe(cache[file]));
                    return;
                }

                cache[file] = false;

                let patterns = rapi_helpers.asArray(me.account.files)
                                           .map(x => rapi_helpers.toStringSafe(x))
                                           .filter(x => !rapi_helpers.isEmptyString(x));
                patterns = rapi_helpers.distinctArray(patterns);
                if (patterns.length < 1) {
                    patterns = [ '**' ];
                }

                let excludePatterns = rapi_helpers.asArray(me.account.exclude)
                                                  .map(x => rapi_helpers.toStringSafe(x))
                                                  .filter(x => !rapi_helpers.isEmptyString(x));
                excludePatterns = rapi_helpers.distinctArray(excludePatterns);

                let nextPattern: () => void;
                nextPattern = () => {
                    if (patterns.length < 1) {
                        completed(null, false);
                        return;
                    }

                    let p = patterns.shift();

                    try {
                        Glob(p, {
                            absolute: true,
                            cwd: vscode.workspace.rootPath,
                            dot: true,
                            ignore: excludePatterns,
                            nodir: true,
                            root: vscode.workspace.rootPath,
                        }, (err: any, matchingFiles: string[]) => {
                            if (err) {
                                completed(err);
                                return;
                            }

                            matchingFiles = matchingFiles.map(x => normalizePath(x));
                            if (matchingFiles.indexOf(file) > -1) {
                                cache[file] = true;
                                completed(null, cache[file]);

                                return;
                            }
                            else {
                                nextPattern();
                            }
                        });
                    }
                    catch (e) {
                        completed(e);
                    }
                };

                nextPattern();
            }
            catch (e) {
                completed(e);
            }
        });
    }

    /**
     * Parses a value for use as variable name.
     * 
     * @param {string} name The input value.
     * 
     * @return {string} The parsed value.
     */
    protected parseVarName(name: string) {
        return rapi_helpers.normalizeString(name);
    }

    /**
     * Sets a variable for the user.
     * 
     * @param {string} name The name of the variable.
     * @param {T} value The value to set.
     * 
     * @chainable
     */
    public set<T>(name: string, value: T): User {
        this.account.__globals[this.parseVarName(name)] = value;
        return this;
    }

    /**
     * Removes a variable.
     * 
     * @param {string} name The name of the variable.
     * 
     * @chainable
     */
    public unset(name: string): User {
        name = this.parseVarName(name);
        delete this.account.__globals['name'];

        return;
    }
}


/**
 * Tries to find an user by request context.
 * 
 * @param {rapi_host.RequestContext} ctx The request context.
 * 
 * @return {User} The user (if found).
 */
export function getUser(ctx: rapi_host.RequestContext): User {
    let result: User;

    let createGuestUser = (account?: rapi_contracts.Account) => {
        if (!account) {
            //TODO: create by IP

            account = DEFAULT_USER;
        }

        result = new User(ctx, account, true);
    };

    try {
        let headers = ctx.request.headers;

        let usernameAndPassword: string;
        if (headers) {
            for (let p in headers) {
                if (rapi_helpers.normalizeString(p) == 'authorization') {
                    let value = rapi_helpers.toStringSafe(headers[p]).trim();
                    if (0 == value.toLowerCase().indexOf('basic ')) {
                        usernameAndPassword = value.substr(6).trim();
                    }
                }
            }
        }

        let activeUsers = rapi_helpers.asArray(ctx.config.users)
                                      .filter(x => x)
                                      .filter(x => rapi_helpers.toBooleanSafe(x.isActive, true));

        if ((activeUsers.length > 0) || !rapi_helpers.isEmptyString(usernameAndPassword)) {
            let temp = new Buffer(usernameAndPassword, 'base64').toString('utf8');

            let username: string;
            let password: string
            if (!rapi_helpers.isEmptyString(temp)) {
                let sepIndex = temp.indexOf(':');
                if (sepIndex > -1) {
                    username = temp.substr(0, sepIndex);
                    password = temp.substr(sepIndex + 1);
                }
                else {
                    username = temp;
                }
            }

            username = rapi_helpers.normalizeString(username);
            password = rapi_helpers.toStringSafe(password);
            
            for (let i = 0; i < activeUsers.length; i++) {
                let user = activeUsers[i];
                if (rapi_helpers.normalizeString(user.name) != username) {
                    continue;
                }

                let doesMatch = password === rapi_helpers.toStringSafe(user.password);
                if (doesMatch) {
                    result = new User(ctx, user, false);

                    break;
                }
            }
        }
        else {
            // check guest

            if ('object' === typeof ctx.config.guest) {
                if (rapi_helpers.toBooleanSafe(ctx.config.guest.isActive, true)) {
                    createGuestUser(ctx.config.guest);
                }
            }
            else {
                if (rapi_helpers.toBooleanSafe(ctx.config.guest, true)) {
                    createGuestUser();
                }
            }
        }
    }
    catch (e) {
        result = null;
    }

    // apply default values
    if (result) {
        let canSeeLiveUpdates = true;
        if (ctx.config.liveUpdate) {
            canSeeLiveUpdates = rapi_helpers.toBooleanSafe(ctx.config.liveUpdate.isActive, true);
        }

        result.set(VAR_CAN_SEE_LIVE_UPDATES, canSeeLiveUpdates);
    }

    return result;
}
