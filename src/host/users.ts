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
const Glob = require('glob');
import * as Path from 'path';
import * as rapi_contracts from '../contracts';
import * as rapi_helpers from '../helpers';
import * as vscode from 'vscode';


/**
 * Name of a variable that defines if an user has the right activate extensions or not.
 */
export const VAR_CAN_ACTIVATE = 'can_activate';
/**
 * Name of a variable that defines if an user has the right to do anything with the API or not.
 */
export const VAR_CAN_ANYTHING = 'can_anything';
/**
 * Name of a variable that defines if an user has the right to close editor tabs or not.
 */
export const VAR_CAN_CLOSE = 'can_close';
/**
 * Name of a variable that defines if an user has the right to create things like output channels or not or not.
 */
export const VAR_CAN_CREATE = 'can_create';
/**
 * Name of a variable that defines if an user has the right to delete items or not.
 */
export const VAR_CAN_DELETE = 'can_delete';
/**
 * Name of a variable that defines if an user has the right to deploy files or not.
 */
export const VAR_CAN_DEPLOY = 'can_deploy';
/**
 * Name of a variable that defines if an user can execute commands or not.
 */
export const VAR_CAN_EXECUTE = 'can_execute';
/**
 * Name of a variable that defines if an user can open an editor tab or not.
 */
export const VAR_CAN_OPEN = 'can_open';
/**
 * Name of a variable that defines if an user has write access or not.
 */
export const VAR_CAN_WRITE = 'can_write';
/**
 * Name of a variable that defines if an user can see directories with leading dots or not.
 */
export const VAR_WITH_DOT = 'with_dot';

const DEFAULT_USER: rapi_contracts.Account = {
    __globals: {},
};


class User implements rapi_contracts.User {
    protected readonly _ACCOUNT: rapi_contracts.Account;
    protected readonly _CONTEXT: rapi_contracts.RequestContext;
    protected readonly _IS_GUEST: boolean;

    constructor(ctx: rapi_contracts.RequestContext, account: rapi_contracts.Account, isGuest: boolean) {
        this._ACCOUNT = account;
        this._CONTEXT = ctx;
        this._IS_GUEST = rapi_helpers.toBooleanSafe(isGuest);
    }

    public get account(): rapi_contracts.Account {
        return this._ACCOUNT;
    }

    public can(name: string, defaultValue?: boolean): boolean {
        name = this.parseVarName(name);

        let value = this.get<boolean>('can_' + name,
                                      rapi_helpers.toBooleanSafe(defaultValue));

        return rapi_helpers.toBooleanSafe(value ||
                                          this.get(VAR_CAN_ANYTHING, false));
    }

    public get context(): rapi_contracts.RequestContext {
        return this._CONTEXT;
    }

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

    public has(name: string): boolean {
        name = this.parseVarName(name);

        return (<Object>this.account.__globals).hasOwnProperty(name);
    }

    public isDirVisible(dir: string, withDot: boolean): PromiseLike<boolean> {
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

                if (!Path.isAbsolute(dir)) {
                    dir = Path.join(vscode.workspace.rootPath, dir);
                }

                let parentDir = dir + '/..';
                try {
                    parentDir = normalizePath(parentDir);
                }
                catch (e) {
                    parentDir = dir;
                }

                dir = normalizePath(dir);
                let dirName = Path.basename(dir);

                let checkThisDirectory = () => {
                    FS.lstat(dir, (err, stats) => {
                        if (err) {
                            completed(err);
                        }
                        else {
                            let isVisible: boolean = null;

                            if (stats.isDirectory()) {
                                isVisible = true;
                                if (0 == rapi_helpers.normalizeString(dirName).indexOf('.')) {
                                    isVisible = rapi_helpers.toBooleanSafe(me.get<boolean>(VAR_WITH_DOT) || withDot);
                                }
                            }

                            completed(null, isVisible);
                        }
                    });
                };

                // check parent directory
                if (rapi_helpers.normalizeString(dir) == parentDir) {
                    // there is no parent directory to check
                    checkThisDirectory();
                }
                else {
                    me.isDirVisible(parentDir, withDot).then((isDirectoryVisible) => {
                        if (isDirectoryVisible) {
                            checkThisDirectory();
                        }
                        else {
                            completed(null, false);
                        }
                    }, (err) => {
                        completed(err);
                    });
                }
            }
            catch (e) {
                completed(e);
            }
        });
    }

    public isFileVisible(file: string, withDot: boolean): PromiseLike<boolean> {
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

                if (!Path.isAbsolute(file)) {
                    file = Path.join(vscode.workspace.rootPath, file);
                }

                file = normalizePath(file);
                
                FS.stat(file, (err, stats) => {
                    if (err) {
                        completed(err);
                        return;
                    }

                    if (!stats.isFile()) {
                        completed(null, false);
                        return;
                    }

                    try {
                        let dir = Path.dirname(file);

                        me.isDirVisible(dir, withDot).then((isDirectoryVisible) => {
                            if (!isDirectoryVisible) {
                                completed(null, false);  // directory not visible
                                return;
                            }

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
                                            completed(null, true);

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
                        }, (err) => {
                            completed(err);
                        });
                    }
                    catch (e) {
                        completed(e);
                    }
                });
            }
            catch (e) {
                completed(e);
            }
        });
    }

    public get isGuest(): boolean {
        return this._IS_GUEST;
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

    public set<T>(name: string, value: T): User {
        this.account.__globals[this.parseVarName(name)] = value;
        return this;
    }

    public unset(name: string): User {
        name = this.parseVarName(name);
        delete this.account.__globals[name];

        return this;
    }
}


/**
 * Tries to find an user by request context.
 * 
 * @param {rapi_contracts.RequestContext} ctx The request context.
 * 
 * @return {PromiseLike<rapi_contracts.User>} The promise.
 */
export function getUser(ctx: rapi_contracts.RequestContext): PromiseLike<rapi_contracts.User> {
    return new Promise<rapi_contracts.User>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        try {
            let result: rapi_contracts.User;

            let nextAction = () => {
                completed(null, result);
            };

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
                // can anything?
                result.set(VAR_CAN_ANYTHING, rapi_helpers.toBooleanSafe(result.account.canAnything));
                // can activate?
                result.set(VAR_CAN_ACTIVATE, rapi_helpers.toBooleanSafe(result.account.canActivate));
                // can close?
                result.set(VAR_CAN_CLOSE, rapi_helpers.toBooleanSafe(result.account.canClose));
                // can create?
                result.set(VAR_CAN_CREATE, rapi_helpers.toBooleanSafe(result.account.canCreate));
                // can delete files and folders?
                result.set(VAR_CAN_DELETE, rapi_helpers.toBooleanSafe(result.account.canDelete));
                // can deploy?
                result.set(VAR_CAN_DEPLOY, rapi_helpers.toBooleanSafe(result.account.canDeploy));
                // can execute commands?
                result.set(VAR_CAN_EXECUTE, rapi_helpers.toBooleanSafe(result.account.canExecute));
                // can open tabs in editor?
                result.set(VAR_CAN_OPEN, rapi_helpers.toBooleanSafe(result.account.canOpen));
                // can write (files)?
                result.set(VAR_CAN_WRITE, rapi_helpers.toBooleanSafe(result.account.canWrite));

                // custom values
                if (result.account.values) {
                    for (let p in result.account.values) {
                        result.set(p, result.account.values[p]);
                    }
                }

                if (!rapi_helpers.isNullOrUndefined(ctx.config.preparer)) {
                    let userPreparer: rapi_contracts.UserPreparer;
                    if ('object' !== typeof ctx.config.preparer) {
                        let script = rapi_helpers.toStringSafe(ctx.config.preparer);
                        if (!rapi_helpers.isEmptyString(script)) {
                            userPreparer = {
                                script: script,
                            };
                        }
                    }
                    else {
                        userPreparer = ctx.config.preparer;
                    }

                    if (userPreparer) {
                        let preparerScript = userPreparer.script;
                        if (!Path.isAbsolute(preparerScript)) {
                            preparerScript = Path.join(vscode.workspace.rootPath, preparerScript);
                        }
                        preparerScript = Path.resolve(preparerScript);

                        let preparerModule = rapi_helpers.loadModuleSync<rapi_contracts.UserPreparerModule>(preparerScript);
                        if (preparerModule) {
                            if (preparerModule.prepare) {
                                let prepareArgs: rapi_contracts.UserPreparerArguments = {
                                    globals: rapi_helpers.cloneObject(ctx.config.globals),
                                    globalState: undefined,
                                    log: function(msg) {
                                        rapi_helpers.log(msg);
                                        return this;
                                    },
                                    openHtml: (html, title, docId) => {
                                        return rapi_helpers.openHtmlDocument(ctx.workspaceState[rapi_contracts.VAR_HTML_DOCS],
                                                                             html, title, docId);
                                    },
                                    options: userPreparer.options,
                                    require: function(id) {
                                        return rapi_helpers.requireModule(id);
                                    },
                                    state: undefined,
                                    user: result,
                                    workspaceState: undefined,
                                };

                                // prepareArgs.globalState
                                Object.defineProperty(prepareArgs, 'globalState', {
                                    enumerable: true,
                                    get: function() {
                                        return this.workspaceState['globalAccountPreparerStates'];
                                    }
                                });

                                // prepareArgs.state
                                Object.defineProperty(prepareArgs, 'state', {
                                    enumerable: true,
                                    get: function() {
                                        return this.workspaceState['globalAccountPreparerScriptStates'][preparerScript];
                                    },
                                    set: function(newValue) {
                                        this.workspaceState['globalAccountPreparerScriptStates'][preparerScript] = newValue;
                                    }
                                });

                                // prepareArgs.workspaceState
                                Object.defineProperty(prepareArgs, 'workspaceState', {
                                    enumerable: true,
                                    get: () => {
                                        return ctx.workspaceState;
                                    }
                                });

                                let preparerResult = preparerModule.prepare(prepareArgs);
                                if (preparerResult) {
                                    nextAction = null;

                                    preparerResult.then((user) => {
                                        result = user || result;

                                        completed();
                                    }, (err) => {
                                        completed(err);
                                    });
                                }
                            }
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
