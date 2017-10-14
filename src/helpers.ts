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

import * as ChildProcess from 'child_process';
const Entities = require('html-entities').AllHtmlEntities;
import * as FS from 'fs';
import * as HTTP from 'http';
import * as i18 from './i18';
const IsBinaryFile = require("isbinaryfile");
const MIME = require('mime');
import * as Moment from 'moment';
import * as Path from 'path';
import * as rapi_contracts from './contracts';
import * as rapi_host_users from './host/users';
import * as rapi_workspace from './workspace';
import * as vscode from 'vscode';
import * as ZLib from 'zlib';

/**
 * Options for open function.
 */
export interface OpenOptions {
    /**
     * The app (or options) to open.
     */
    app?: string | string[];
    /**
     * The custom working directory.
     */
    cwd?: string;
    /**
     * Wait until exit or not.
     */
    wait?: boolean;
}

/**
 * Describes a simple 'completed' action.
 * 
 * @param {any} [err] The occurred error.
 * @param {TResult} [result] The result.
 */
export type SimpleCompletedAction<TResult> = (err?: any, result?: TResult) => void;


let nextHtmlDocId = -1;

/**
 * Returns a value as array.
 * 
 * @param {T | T[]} val The value.
 * 
 * @return {T[]} The value as array.
 */
export function asArray<T>(val: T | T[]): T[] {
    if (!Array.isArray(val)) {
        return [ val ];
    }

    return val;
}

/**
 * Returns data as buffer.
 * 
 * @param {any} val The input value.
 * 
 * @returns {Buffer} The output value.
 */
export function asBuffer(val: any, enc?: string): Buffer {
    if (isNullOrUndefined(val)) {
        return val;
    }

    enc = normalizeString(enc);
    if (!enc) {
        enc = 'utf8';
    }

    let buff: Buffer = val;
    if ('object' !== typeof val) {
        buff = new Buffer(toStringSafe(val), enc);
    }

    return buff;
}

/**
 * Cleans up a string.
 * 
 * @param {any} str The string to cleanup.
 * @param {any} allowedChars The allowed chars.
 * @param {any} replaceWith The expression to use to replace non-allowed chars.
 * 
 * @return {string} The cleanup string.
 */
export function cleanupString(str: any,
                              allowedChars: any = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_', replaceWith: any = ''): string {
    if (!str) {
        return str;
    }

    str = toStringSafe(str);
    allowedChars = toStringSafe(allowedChars);
    replaceWith = toStringSafe(replaceWith);

    let newString = '';

    for (let i = 0; i < str.length; i++) {
        let c = str[i];
        if (allowedChars.indexOf(c) > -1) {
            newString += c;
        }
        else {
            newString += replaceWith;  // not allowed
        }
    }

    return newString;
}

/**
 * Clones an object / value deep.
 * 
 * @param {T} val The value / object to clone.
 * 
 * @return {T} The cloned value / object.
 */
export function cloneObject<T>(val: T): T {
    if (!val) {
        return val;
    }

    return JSON.parse(JSON.stringify(val));
}

/**
 * Compares two values for a sort operation.
 * 
 * @param {T} x The left value.
 * @param {T} y The right value.
 * 
 * @return {number} The "sort value".
 */
export function compareValues<T>(x: T, y: T): number {
    if (x === y) {
        return 0;
    }

    if (x > y) {
        return 1;
    }

    if (x < y) {
        return -1;
    }

    return 0;
}

/**
 * Creates a simple 'completed' callback for a promise.
 * 
 * @param {Function} resolve The 'succeeded' callback.
 * @param {Function} reject The 'error' callback.
 * 
 * @return {SimpleCompletedAction<TResult>} The created action.
 */
export function createSimplePromiseCompletedAction<TResult>(resolve: (value?: TResult | PromiseLike<TResult>) => void,
                                                            reject?: (reason: any) => void): SimpleCompletedAction<TResult> {
    return (err?, result?) => {
        if (err) {
            if (reject) {
                reject(err);
            }
        }
        else {
            if (resolve) {
                resolve(result);
            }
        }
    };
}

/**
 * Tries to detect the MIME type of a file.
 * 
 * @param {string} file The Filename.
 * @param {any} defValue The default value.
 * 
 * @return {string} The MIME type.
 */
export function detectMimeByFilename(file: string, defValue: any = 'application/octet-stream'): string {
    let mime: string;
    try {
        try {
            let ext = normalizeString(Path.extname(file));
            if (ext) {
                ext = ext.substr(1).trim();
            }

            switch (ext) {
                case 'ts':
                    mime = 'text/typescript';
                    break;
            }
        }
        catch (e) {
            log(`[ERROR] helpers.detectMimeByFilename(2): ${toStringSafe(e)}`);
        }

        if (!mime) {
            mime = MIME.lookup(file);
        }
    }
    catch (e) {
        log(`[ERROR] helpers.detectMimeByFilename(1): ${toStringSafe(e)}`);
    }

    mime = toStringSafe(mime).toLowerCase().trim();
    if (!mime) {
        mime = defValue;
    }

    return mime;
}

/**
 * Removes duplicate entries from an array.
 * 
 * @param {T[]} arr The input array.
 * 
 * @return {T[]} The filtered array.
 */
export function distinctArray<T>(arr: T[]): T[] {
    if (!arr) {
        return arr;
    }

    return arr.filter((x, i) => arr.indexOf(x) == i);
}

/**
 * Formats a string.
 * 
 * @param {any} formatStr The value that represents the format string.
 * @param {any[]} [args] The arguments for 'formatStr'.
 * 
 * @return {string} The formated string.
 */
export function format(formatStr: any, ...args: any[]): string {
    return formatArray(formatStr, args);
}

/**
 * Formats a string.
 * 
 * @param {any} formatStr The value that represents the format string.
 * @param {any[]} [args] The arguments for 'formatStr'.
 * 
 * @return {string} The formated string.
 */
export function formatArray(formatStr: any, args: any[]): string {
    if (!args) {
        args = [];
    }

    formatStr = toStringSafe(formatStr);

    // apply arguments in
    // placeholders
    return formatStr.replace(/{(\d+)(\:)?([^}]*)}/g, (match, index, formatSeparator, formatExpr) => {
        index = parseInt(toStringSafe(index).trim());
        
        let resultValue = args[index];

        if (':' === formatSeparator) {
            // collect "format providers"
            let formatProviders = toStringSafe(formatExpr).split(',')
                                                          .map(x => x.toLowerCase().trim())
                                                          .filter(x => x);

            // transform argument by
            // format providers
            formatProviders.forEach(fp => {
                switch (fp) {
                    case 'entities':
                        resultValue = toStringSafe(resultValue);
                        if (resultValue) {
                            resultValue = toStringSafe(Entities.encode(resultValue));
                        }
                        break;

                    case 'json':
                        resultValue = JSON.stringify(resultValue);
                        break;

                    case 'json_pretty':
                        resultValue = JSON.stringify(resultValue, null, 4);
                        break;

                    case 'leading_space':
                        resultValue = toStringSafe(resultValue);
                        if (resultValue) {
                            resultValue = ' ' + resultValue;
                        }
                        break;

                    case 'lower':
                        resultValue = toStringSafe(resultValue).toLowerCase();
                        break;

                    case 'trim':
                        resultValue = toStringSafe(resultValue).trim();
                        break;

                    case 'upper':
                        resultValue = toStringSafe(resultValue).toUpperCase();
                        break;

                    case 'uri_comp':
                        resultValue = toStringSafe(resultValue);
                        if (resultValue) {
                            resultValue = encodeURIComponent(resultValue);
                        }
                        break;

                    case 'surround':
                        resultValue = toStringSafe(resultValue);
                        if (resultValue) {
                            resultValue = "'" + toStringSafe(resultValue) + "'";
                        }
                        break;
                }
            });
        }

        if ('undefined' === typeof resultValue) {
            return match;
        }

        return toStringSafe(resultValue);        
    });
}

/**
 * Returns Base64 stored content that is stored in object(s).
 * 
 * @param {string} key The key with the data.
 * @param {Object|Object[]} objs The object(s).
 * @param {boolean} compressed Is data compressed or not.
 * 
 * @return {Buffer} The data (if found).
 */    
export function getBase64ContentFromObjects(key: string, objs: Object | Object[], compressed = false): Buffer {
    let allObjects = asArray(objs).filter(x => x);

    key = normalizeString(key);

    let data: Buffer;


    while (allObjects.length > 0) {
        let o = allObjects.shift();

        for (let p in o) {
            if (normalizeString(p) == key) {
                data = new Buffer(o[p], 'base64');
                break;
            }
        }
    }

    if (data) {
        if (toBooleanSafe(compressed)) {
            data = ZLib.gunzipSync(data);
        }
    }

    return data;
}

/**
 * Tries to return a value from a "header" object.
 * 
 * @param {any} headers The object with the header values.
 * @param {string} key The key.
 * @param {any} [defaultValue] The default value.
 * 
 * @return {string} The value from the object.
 */
export function getHeaderValue(headers: any, key: string, defaultValue?: any): string {
    if (!headers) {
        return defaultValue;
    }

    key = normalizeString(key);

    let value = defaultValue;

    for (let p in headers) {
        if (normalizeString(p) == key) {
            value = toStringSafe(headers[p]);
        }
    }

    return value;
}

/**
 * Returns the state repository item for a memento.
 * 
 * @param {vscode.Memento} memento The memento.
 * @param {string} [varName] The name of the variable inside the memento.
 * 
 * @return {rapi_contracts.StateRepository} The item.
 */
export function getStateRepository(memento: vscode.Memento, varName = rapi_contracts.VAR_STATE): rapi_contracts.StateRepository {
    if (!memento) {
        return;
    }

    let repo = memento.get<rapi_contracts.StateRepository>(varName) || {
        globals: {},
        guest: {},
        users: {},
    };

    for (let p in repo) {
        repo[p] = repo[p] || {};
    }

    return repo;
}

/**
 * Returns the value from a "parameter" object.
 * 
 * @param {Object} params The object.
 * @param {string} name The name of the parameter.
 * 
 * @return {string} The value of the parameter (if found).
 */
export function getUrlParam(params: Object, name: string): string {
    if (params) {
        name = normalizeString(name);

        for (let p in params) {
            if (normalizeString(p) == name) {
                return toStringSafe(params[p]);
            }
        }
    }
}

/**
 * Checks if data is binary or text content.
 * 
 * @param {Buffer} data The data to check.
 * 
 * @returns {PromiseLike<boolean>} The promise.
 */
export function isBinaryContent(data: Buffer): PromiseLike<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        let completed = createSimplePromiseCompletedAction(resolve, reject);
        if (!data) {
            completed(null);
            return;
        }

        try {
            IsBinaryFile(data, data.length, (err, result) => {
                if (err) {
                    completed(err);
                    return;
                }

                completed(null, toBooleanSafe(result));
            });
        }
        catch (e) {
            completed(e);
        }
    });
}

/**
 * Checks if the string representation of a value is empty
 * or contains whitespaces only.
 * 
 * @param {any} val The value to check.
 * 
 * @return {boolean} Is empty or not.
 */
export function isEmptyString(val: any): boolean {
    return '' === toStringSafe(val).trim();
}

/**
 * Checks if a value is (null) or (undefined).
 * 
 * @param {any} val The value to check.
 * 
 * @return {boolean} Is (null)/(undefined) or not.
 */
export function isNullOrUndefined(val: any): boolean {
    return null === val ||
           'undefined' === typeof val;
}

/**
 * Loads a module.
 * 
 * @param {string} file The path of the module's file.
 * @param {boolean} useCache Use cache or not.
 * 
 * @return {TModule} The loaded module.
 */
export function loadModuleSync<TModule extends rapi_contracts.ScriptModule>(file: string, useCache: boolean = false): TModule {
    if (!Path.isAbsolute(file)) {
        file = Path.join(rapi_workspace.getRootPath(), file);
    }
    file = Path.resolve(file);

    let stats = FS.lstatSync(file);
    if (!stats.isFile()) {
        throw new Error(i18.t('isNo.file', file));
    }

    if (!useCache) {
        delete require.cache[file];  // remove from cache
    }
    
    return require(file);
}

/**
 * Logs a message.
 * 
 * @param {any} msg The message to log.
 */
export function log(msg: any) {
    let now = Moment();

    msg = toStringSafe(msg);
    console.log(`[vs-rest-api :: ${now.format('YYYY-MM-DD HH:mm:ss')}] => ${msg}`);
}

/**
 * Normalizes a value as string so that is comparable.
 * 
 * @param {any} val The value to convert.
 * @param {(str: string) => string} [normalizer] The custom normalizer.
 * 
 * @return {string} The normalized value.
 */
export function normalizeString(val: any, normalizer?: (str: string) => string): string {
    if (!normalizer) {
        normalizer = (str) => str.toLowerCase().trim();
    }

    return normalizer(toStringSafe(val));
}

/**
 * Opens a target.
 * 
 * @param {string} target The target to open.
 * @param {OpenOptions} [opts] The custom options to set.
 * 
 * @param {PromiseLike<ChildProcess.ChildProcess>} The promise.
 */
export function open(target: string, opts?: OpenOptions): PromiseLike<ChildProcess.ChildProcess> {
    let me = this;

    if (!opts) {
        opts = {};
    }

    opts.wait = toBooleanSafe(opts.wait, true);
    
    return new Promise((resolve, reject) => {
        let completed = (err?: any, cp?: ChildProcess.ChildProcess) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(cp);
            }
        };
        
        try {
            if (typeof target !== 'string') {
                throw new Error('Expected a `target`');
            }

            let cmd: string;
            let appArgs: string[] = [];
            let args: string[] = [];
            let cpOpts: ChildProcess.SpawnOptions = {
                cwd: opts.cwd || rapi_workspace.getRootPath(),
            };

            if (Array.isArray(opts.app)) {
                appArgs = opts.app.slice(1);
                opts.app = opts.app[0];
            }

            if (process.platform === 'darwin') {
                // Apple

                cmd = 'open';

                if (opts.wait) {
                    args.push('-W');
                }

                if (opts.app) {
                    args.push('-a', opts.app);
                }
            }
            else if (process.platform === 'win32') {
                // Microsoft

                cmd = 'cmd';
                args.push('/c', 'start', '""');
                target = target.replace(/&/g, '^&');

                if (opts.wait) {
                    args.push('/wait');
                }

                if (opts.app) {
                    args.push(opts.app);
                }

                if (appArgs.length > 0) {
                    args = args.concat(appArgs);
                }
            }
            else {
                // Unix / Linux

                if (opts.app) {
                    cmd = opts.app;
                } else {
                    cmd = Path.join(__dirname, 'xdg-open');
                }

                if (appArgs.length > 0) {
                    args = args.concat(appArgs);
                }

                if (!opts.wait) {
                    // xdg-open will block the process unless
                    // stdio is ignored even if it's unref'd
                    cpOpts.stdio = 'ignore';
                }
            }

            args.push(target);

            if (process.platform === 'darwin' && appArgs.length > 0) {
                args.push('--args');
                args = args.concat(appArgs);
            }

            let cp = ChildProcess.spawn(cmd, args, cpOpts);

            if (opts.wait) {
                cp.once('error', (err) => {
                    completed(err);
                });

                cp.once('close', function (code) {
                    if (code > 0) {
                        completed(new Error('Exited with code ' + code));
                        return;
                    }

                    completed(null, cp);
                });
            }
            else {
                cp.unref();

                completed(null, cp);
            }
        }
        catch (e) {
            completed(e);
        }
    });
}

/**
 * Opens a HTML document in a new tab for a document storage.
 * 
 * @param {rapi_contracts.Document[]} storage The storage to open for.
 * @param {string} html The HTML document (source code).
 * @param {string} [title] The custom title for the tab.
 * @param {any} [id] The custom ID for the document in the storage.
 * 
 * @returns {Promise<any>} The promise.
 */
export function openHtmlDocument(storage: rapi_contracts.Document[],
                                 html: string, title?: string, id?: any): Promise<any> {
    return new Promise((resolve, reject) => {
        let completed = createSimplePromiseCompletedAction(resolve, reject);

        try {
            let body: Buffer;
            let enc = 'utf8';
            if (html) {
                body = new Buffer(toStringSafe(html), enc);
            }

            if (isNullOrUndefined(id)) {
                id = 'vsraGlobalHtmlDocs::302b46ff-1539-48fd-893e-d7b83d763f93::' + (++nextHtmlDocId);
            }

            let doc: rapi_contracts.Document = {
                body: body,
                encoding: enc,
                id: id,
                mime: 'text/html',
            };

            if (!isEmptyString(title)) {
                doc.title = toStringSafe(title).trim();
            }

            if (storage) {
                storage.push(doc);
            }

            vscode.commands.executeCommand('extension.restApi.openHtmlDoc', doc).then((result: any) => {
                completed(null, result);
            }, (err) => {
                completed(err);
            });
        }
        catch (e) {
            completed(e);
        }
    });
}

/**
 * Reads the content of the HTTP request body.
 * 
 * @param {HTTP.IncomingMessag} msg The HTTP message with the body.
 * 
 * @returns {Promise<Buffer>} The promise.
 */
export function readHttpBody(msg: HTTP.IncomingMessage): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        let buff: Buffer;
        let completedInvoked = false;

        let dataListener: (chunk: Buffer | string) => void;

        let completed = (err: any) => {
            if (completedInvoked) {
                return;
            }

            completedInvoked = true;

            if (dataListener) {
                try {
                    msg.removeListener('data', dataListener);
                }
                catch (e) { 
                    log(i18.t('errors.withCategory',
                              'helpers.readHttpBody()', e));
                }
            }

            if (err) {
                reject(err);
            }
            else {
                resolve(buff);
            }
        };

        dataListener = (chunk: Buffer | string) => {
            try {
                if (chunk && chunk.length > 0) {
                    if ('string' === typeof chunk) {
                        chunk = new Buffer(chunk);
                    }

                    buff = Buffer.concat([ buff, chunk ]);
                }
            }
            catch (e) {
                completed(e);
            }
        };

        try {
            buff = Buffer.alloc(0);

            msg.once('error', (err) => {
                if (err) {
                    completed(err);
                }
            });

            msg.on('data', dataListener);

            msg.once('end', () => {
                resolve(buff);
            });
        }
        catch (e) {
            completed(e);
        }
    });
}

/**
 * Reads the content of the HTTP request body and returns it as parsed object.
 * 
 * @param {HTTP.IncomingMessag} msg The HTTP message with the body.
 * @param {string} encoding The custom text encoding to use.
 * 
 * @returns {PromiseLike<T>} The promise.
 */
export function readHttpBodyAsJSON<T>(msg: HTTP.IncomingMessage, encoding?: string): PromiseLike<T> {
    return new Promise<T>((resolve, reject) => {
        let completed = createSimplePromiseCompletedAction(resolve, reject);

        readHttpBodyAsString(msg, encoding).then((str) => {
            try {
                let obj: T;
                if (str && str.length > 0) {
                    obj = JSON.parse(str);
                }

                completed(null, obj);
            }
            catch (e) {
                completed(e);
            }
        }, (err) => {
            completed(err);
        });
    });
}

/**
 * Reads the content of the HTTP request body and returns it as string.
 * 
 * @param {HTTP.IncomingMessag} msg The HTTP message with the body.
 * @param {string} encoding The custom text encoding to use.
 * 
 * @returns {PromiseLike<string>} The promise.
 */
export function readHttpBodyAsString(msg: HTTP.IncomingMessage, encoding?: string): PromiseLike<string> {
    encoding = normalizeString(encoding);
    if (!encoding) {
        encoding = 'utf8';
    }
    
    return new Promise<string>((resolve, reject) => {
        let completed = createSimplePromiseCompletedAction(resolve, reject);

        readHttpBody(msg).then((body) => {
            try {
                completed(null,
                          !isNullOrUndefined(body) ? body.toString(encoding) : <any>body);
            }
            catch (e) {
                completed(e);
            }
        }, (err) => {
            completed(err);
        });
    });
}

/**
 * Removes documents from a storage.
 * 
 * @param {rapi_contracts.Document|rapi_contracts.Document[]} docs The document(s) to remove.
 * @param {rapi_contracts.Document[]} storage The storage.
 * 
 * @return {rapi_contracts.Document[]} The removed documents.
 */
export function removeDocuments(docs: rapi_contracts.Document | rapi_contracts.Document[],
                                storage: rapi_contracts.Document[]): rapi_contracts.Document[] {
    let ids = asArray(docs).filter(x => x)
                           .map(x => x.id);

    let removed = [];

    if (storage) {
        for (let i = 0; i < storage.length; ) {
            let d = storage[i];
            if (ids.indexOf(d.id) > -1) {
                removed.push(d);
                storage.splice(i, 1);
            }
            else {
                ++i;
            }
        }
    }

    return removed;
}

/**
 * Replaces all occurrences of a string.
 * 
 * @param {string} str The input string.
 * @param {string} searchValue The value to search for.
 * @param {string} replaceValue The value to replace 'searchValue' with.
 * 
 * @return {string} The output string.
 */
export function replaceAllStrings(str: string, searchValue: string, replaceValue: string) {
    str = toStringSafe(str);
    searchValue = toStringSafe(searchValue);
    replaceValue = toStringSafe(replaceValue);

    return str.split(searchValue)
              .join(replaceValue);
}

/**
 * Loads a module from the extension context.
 * 
 * @param {string} id The ID / path of the module.
 * 
 * @return {any} The loaded module.
 */
export function requireModule(id: string) {
    return require(toStringSafe(id));
}

/**
 * Sets the content of a text editor.
 * 
 * @param {vscode.TextEditor} editor The text editor.
 * @param {string} value The new value.
 * 
 * @param {PromiseLike<vscode.TextDocument>} The promise.
 */
export function setContentOfTextEditor(editor: vscode.TextEditor, value: string): PromiseLike<vscode.TextDocument> {
    value = toStringSafe(value);
    
    return new Promise<any>((resolve, reject) => {
        let completed = createSimplePromiseCompletedAction(resolve, reject);
        
        try {
            editor.edit((builder) => {
                try {
                    let doc = editor.document;
                    if (doc) {
                        let r = new vscode.Range(new vscode.Position(0, 0),
                                                 new vscode.Position(doc.lineCount, 0));

                        builder.replace(r, value);
                    }

                    completed(null, editor.document);
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

/**
 * Converts a text document to a result object.
 * 
 * @param {vscode.TextDocument} doc The document to convert.
 * @param {rapi_contracts.User} user The user that wants to access the document.
 * 
 * @returns {PromiseLike<Object|false>} The promise.
 */
export function textDocumentToObject(doc: vscode.TextDocument, user: rapi_contracts.User): PromiseLike<Object | false> {
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
                let openPath: string;
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
                        openPath: openPath,
                    };

                    completed();
                };

                if (doc.isUntitled) {
                    createObjectAndReturn();
                }
                else {
                    let relativePath = toRelativePath(fileName);
                    fileName = Path.basename(fileName);
                    mime = detectMimeByFilename(fullPath);

                    if (false !== relativePath) {
                        user.isFileVisible(fullPath, user.get<boolean>(rapi_host_users.VAR_WITH_DOT)).then((isVisible) => {
                            if (isVisible) {
                                filePath = toStringSafe(relativePath);
                                filePath = replaceAllStrings(filePath, "\\", '/');
                                filePath = replaceAllStrings(filePath, Path.sep, '/');

                                let filePathSuffix = filePath.split('/')
                                                             .map(x => encodeURIComponent(x))
                                                             .join('/');

                                filePath = '/api/workspace' + filePathSuffix;
                                openPath = '/api/editor' + filePathSuffix;

                                createObjectAndReturn();
                            }
                            else {
                                // not visible

                                obj = false;

                                completed();
                            }
                        }, (err) => {
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

/**
 * Converts a value to a boolean.
 * 
 * @param {any} val The value to convert.
 * @param {any} defaultValue The value to return if 'val' is (null) or (undefined).
 * 
 * @return {boolean} The converted value.
 */
export function toBooleanSafe(val: any, defaultValue: any = false): boolean {
    if (isNullOrUndefined(val)) {
        return defaultValue;
    }

    return !!val;
}

/**
 * Tries to convert a file path to a relative path.
 * 
 * @param {string} path The path to convert.
 * @param {string} [baseDir] The custom base / root directory to use.
 * 
 * @return {string | false} The relative path or (false) if not possible.
 */
export function toRelativePath(path: string, baseDir?: string): string | false {
    let result: string | false = false;

    if (isEmptyString(baseDir)) {
        baseDir = rapi_workspace.getRootPath();
    }
    else {
        if (!Path.isAbsolute(baseDir)) {
            baseDir = Path.join(rapi_workspace.getRootPath(), baseDir);
        }

        baseDir = Path.resolve(baseDir);
    }
    
    try {
        let normalizedPath = replaceAllStrings(path, Path.sep, '/');

        let wsRootPath = replaceAllStrings(rapi_workspace.getRootPath(), Path.sep, '/');
        if (wsRootPath) {
            if (FS.existsSync(wsRootPath)) {
                if (FS.lstatSync(wsRootPath).isDirectory()) {
                    if (0 == normalizedPath.indexOf(wsRootPath)) {
                        result = normalizedPath.substr(wsRootPath.length);
                        result = replaceAllStrings(result, Path.sep, '/');
                    }
                }
            }
        }
    }
    catch (e) {
        log(`[ERROR] helpers.toRelativePath(): ${toStringSafe(e)}`);
    }

    return result;
}

/**
 * Converts a value to a string that is NOT (null) or (undefined).
 * 
 * @param {any} str The input value.
 * @param {any} defValue The default value.
 * 
 * @return {string} The output value.
 */
export function toStringSafe(str: any, defValue: any = ''): string {
    if (isNullOrUndefined(str)) {
        str = '';
    }
    str = '' + str;
    if (!str) {
        str = defValue;
    }

    return str;
}

/**
 * Keeps sure to return a "validator" that is NOT (null) or (undefined).
 * 
 * @param {rapi_contracts.Validator<T>} validator The input value.
 * 
 * @return {rapi_contracts.Validator<T>} The output value.
 */
export function toValidatorSafe<T>(validator: rapi_contracts.Validator<T>): rapi_contracts.Validator<T> {
    if (!validator) {
        // use "dummy" validator

        validator = (): boolean => {
            return true;
        };
    }
    
    return validator;
}

/**
 * Tries to dispose an object.
 * 
 * @param {vscode.Disposable} obj The object to dispose.
 * 
 * @return {boolean} Operation was successful or not.
 */
export function tryDispose(obj: vscode.Disposable): boolean {
    try {
        if (obj) {
            obj.dispose();
        }

        return true;
    }
    catch (e) {
        log(`[ERROR] helpers.tryDispose(): ${toStringSafe(e)}`);

        return false;
    }
}

/**
 * Extracts the query parameters of an URI to an object.
 * 
 * @param {vscode.Uri} uri The URI.
 * 
 * @return {Object} The parameters of the URI as object.
 */
export function uriParamsToObject(uri: vscode.Uri): Object {
    if (!uri) {
        return uri;
    }

    let params: any;
    if (!isEmptyString(uri.query)) {
        // s. https://css-tricks.com/snippets/jquery/get-query-params-object/
        params = uri.query.replace(/(^\?)/,'')
                          .split("&")
                          .map(function(n) { return n = n.split("="), this[normalizeString(n[0])] =
                                                                           toStringSafe(decodeURIComponent(n[1])), this}
                          .bind({}))[0];
    }

    if (!params) {
        params = {};
    }

    return params;
}
