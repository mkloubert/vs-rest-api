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


const Entities = require('html-entities').AllHtmlEntities;
import * as FS from 'fs';
import * as HTTP from 'http';
import * as HTTPs from 'https';
import * as Moment from 'moment';
import * as Path from 'path';
import * as rapi_contracts from './contracts';
import * as rapi_controller from './controller';
import * as rapi_helpers from './helpers';
import * as rapi_host_dirs from './host/dirs';
import * as rapi_host_files from './host/files';
import * as rapi_host_helpers from './host/helpers';
import * as rapi_users from './host/users';
import * as URL from 'url';
import * as vscode from 'vscode';


/**
 * The default text encoding.
 */
export const DEFAULT_ENCODING = 'utf8';
/**
 * The default port for the workspace host.
 */
export const DEFAULT_PORT = 1781;
/**
 * Checks if URL path represents an API request.
 */
export const REGEX_API = /^(\/)(api)(\/)?/i;


/**
 * A HTTP for browsing the workspace.
 */
export class ApiHost implements vscode.Disposable {
    /**
     * Stores the permanent state values of API endpoint script states.
     */
    protected readonly _API_ENDPOINT_SCRIPT_STATES: { [script: string]: any } = {};
    /**
     * Stores an object that shares data between all API endpoint scripts.
     */
    protected readonly _API_ENDPOINT_STATE: Object = {};
    /**
     * Stores the underlying controller.
     */
    protected readonly _CONTROLLER: rapi_controller.Controller;
    /**
     * The current server instance.
     */
    protected _server: HTTP.Server | HTTPs.Server;
    /**
     * Stores the permanent state values of validator script states.
     */
    protected readonly _VALIDATOR_SCRIPT_STATES: { [script: string]: any } = {};
    /**
     * Stores an object that shares data between all validator scripts.
     */
    protected readonly _VALIDATOR_STATE: Object = {};

    /**
     * Initializes a new instance of that class.
     * 
     * @param {rapi_controller.Controller} controller The underlying controller.
     */
    constructor(controller: rapi_controller.Controller) {
        this._CONTROLLER = controller;
    }

    /**
     * Gets the underlying controller.
     */
    public get controller(): rapi_controller.Controller {
        return this._CONTROLLER;
    }
    
    /** @inheritdoc */
    public dispose() {
        let me = this;
        
        me.stop().then(() => {
            //TODO
        }).catch((err) => {
            me.controller.log(`[ERROR] host.dispose(): ${rapi_helpers.toStringSafe(err)}`);
        });
    }

    /**
     * Handles an API call.
     * 
     * @param {rapi_contracts.RequestContext} ctx The request context.
     * @param {ApiResponse} response The predefined response data.
     */
    protected handleApi(ctx: rapi_contracts.RequestContext, response: rapi_contracts.ApiResponse) {
        let me = this;
        
        try {
            let apiModule: rapi_contracts.ApiModule;
            let method: rapi_contracts.ApiMethod;

            let normalizedPath = rapi_helpers.toStringSafe(ctx.url.pathname);
            normalizedPath = rapi_helpers.replaceAllStrings(normalizedPath, "\\", '/');
            normalizedPath = rapi_helpers.replaceAllStrings(normalizedPath, Path.sep, '/');
            normalizedPath = rapi_helpers.normalizeString(normalizedPath);

            let parts = normalizedPath.substr(4)
                                      .split('/')
                                      .filter(x => !rapi_helpers.isEmptyString(x));

            let apiArgs: rapi_contracts.ApiMethodArguments = {
                encoding: DEFAULT_ENCODING,
                getBody: function() {
                    return rapi_helpers.readHttpBody(this.request.request);
                },
                getJSON: function() {
                    return rapi_helpers.readHttpBodyAsJSON(this.request.request,
                                                           this.encoding);
                },
                globals: me.controller.getGlobals(),
                globalState: undefined,
                headers: {
                    'Content-type': 'application/json; charset=utf-8',
                },
                path: parts.join('/'),
                request: ctx,
                require: function(id) {
                    return rapi_helpers.requireModule(id);
                },
                response: response,
                setContent: function(newContent, mime) {
                    delete this.response;

                    this.content = newContent;

                    mime = rapi_helpers.normalizeString(mime);
                    if (mime) {
                        if (!this.headers) {
                            this.headers = {};
                        }

                        this.headers['Content-type'] = mime;
                    }

                    return this;
                },
                sendError: function(err: any) {
                    this.statusCode = 500;
                    
                    delete this.response;
                    delete this.headers;

                    return this;
                },
                sendMethodNotAllowed: function() {
                    this.statusCode = 405;
                    
                    delete this.response;
                    delete this.headers;

                    return this;
                },
                sendNotFound: function() {
                    this.statusCode = 404;
                    
                    delete this.response;
                    delete this.headers;

                    return this;
                },
                state: undefined,
                statusCode: 200,
                workspaceState: undefined,
                write: function(data) {
                    if (!data) {
                        return;
                    }

                    let enc = rapi_helpers.normalizeString(this.encoding);
                    if (!enc) {
                        enc = DEFAULT_ENCODING;
                    }

                    this.request
                        .response.write(rapi_helpers.asBuffer(data), enc);

                    return this;
                }
            };

            // apiArgs.globalState
            Object.defineProperty(apiArgs, 'globalState', {
                enumerable: true,
                get: () => {
                    return me._API_ENDPOINT_STATE;
                }
            });

            // apiArgs.workspaceState
            Object.defineProperty(apiArgs, 'workspaceState', {
                enumerable: true,
                get: () => {
                    return me.controller.workspaceState;
                }
            });

            // search for a matching external API module
            if (ctx.config.endpoints) {
                for (let pattern in ctx.config.endpoints) {
                    let ep = ctx.config.endpoints[pattern];
                    if (!ep) {
                        continue;
                    }

                    if (!rapi_helpers.toBooleanSafe(ep.isActive, true)) {
                        continue;  // not active
                    }

                    let isMatching = true;
                
                    if (pattern) {
                        let regex = new RegExp(rapi_helpers.toStringSafe(pattern), 'i');

                        isMatching = regex.test(apiArgs.path);
                    }

                    if (isMatching) {
                        // found
                        apiArgs.options = ep.options;

                        let apiScript = rapi_helpers.toStringSafe(ep.script);
                        if (!rapi_helpers.isEmptyString(apiScript)) {
                            if (!Path.isAbsolute(apiScript)) {
                                apiScript = Path.join(vscode.workspace.rootPath, apiScript);
                            }
                            apiScript = Path.resolve(apiScript);

                            apiModule = rapi_helpers.loadModuleSync<rapi_contracts.ApiModule>(apiScript);

                            // apiArgs.state
                            Object.defineProperty(apiArgs, 'state', {
                                enumerable: true,
                                get: () => {
                                    return me._API_ENDPOINT_SCRIPT_STATES[apiScript];
                                },
                                set: (newValue: any) => {
                                    me._API_ENDPOINT_SCRIPT_STATES[apiScript] = newValue;
                                }
                            });
                        }

                        if (!apiModule) {
                            // ... but not implemented

                            rapi_host_helpers.sendNotImplemented(ctx);
                            return;
                        }

                        break;
                    }
                }
            }

            if (apiModule) {
                // custom method from external API module
                method = apiModule[ctx.method];
            }
            else {
                // no custom method found
                // now try to bind matching "build in" ...

                let isRoot = true;

                if (parts.length > 0) {
                    let modName = rapi_helpers.normalizeString(rapi_helpers.cleanupString(parts[0]));
                    if (!rapi_helpers.isEmptyString(modName)) {
                        isRoot = false;

                        // try load module
                        let mod: any;
                        try {
                            mod = require(`./api/${modName}`);
                        }
                        catch (e) { /* not found */ }

                        if (mod) {
                            // search for function that
                            // has the same name as the HTTP request
                            // method
                            for (let p in mod) {
                                if (p == ctx.method) {
                                    if ('function' === typeof mod[p]) {
                                        method = mod[p];
                                    }

                                    break;
                                }
                            }

                            if (!method) {
                                // no matching method found

                                method = (ac) => {
                                    ac.sendMethodNotAllowed();
                                };
                            }
                        }
                    }
                }

                if (isRoot) {
                    // root
                    method = (ac) => {
                        ac.response.data = {
                            addr: ctx.request.connection.remoteAddress,
                            time: ctx.time.format('YYYY-MM-DD HH:mm:ss'),
                        };

                        if (!ctx.user.isGuest) {
                            ac.response.data.me = {
                                name: rapi_helpers.normalizeString(ctx.user.account['name']),
                            };
                        }
                    };
                }
            }

            if (method) {
                let sendResponse = (err?: any) => {
                    if (err) {
                        rapi_host_helpers.sendError(err, ctx);
                    }
                    else {
                        try {
                            let enc = rapi_helpers.normalizeString(apiArgs.encoding);
                            if (!enc) {
                                enc = DEFAULT_ENCODING;
                            }

                            let responseData: any;
                            if (apiArgs.response) {
                                responseData = JSON.stringify(response);
                            }
                            else {
                                responseData = apiArgs.content;
                            }

                            let sendResponseData = (finalDataToSend: any) => {
                                try {
                                    let statusCode = apiArgs.statusCode;
                                    if (rapi_helpers.isEmptyString(statusCode)) {
                                        statusCode = 200;
                                    }
                                    else {
                                        statusCode = parseInt(rapi_helpers.normalizeString(apiArgs.statusCode));
                                    }

                                    let headersToSend = apiArgs.headers;
                                    if (!headersToSend) {
                                        headersToSend = {};
                                    }

                                    headersToSend['X-Vscode-Restapi'] = me.controller.packageFile.version;

                                    ctx.response.writeHead(statusCode, headersToSend);

                                    ctx.response.write(rapi_helpers.asBuffer(finalDataToSend));

                                    ctx.response.end();
                                }
                                catch (e) {
                                    //TODO: log
                                }
                            };

                            if (rapi_helpers.toBooleanSafe(apiArgs.compress, true)) {
                                rapi_host_helpers.compressForResponse(responseData, ctx, enc).then((compressResult) => {
                                    if (compressResult.contentEncoding) {
                                        if (!apiArgs.headers) {
                                            apiArgs.headers = {};
                                        }

                                        apiArgs.headers['Content-encoding'] = compressResult.contentEncoding;
                                    }

                                    sendResponseData(compressResult.dataToSend);
                                }).catch((err) => {
                                    //TODO: log

                                    sendResponseData(responseData);
                                });
                            }
                            else {
                                // no compression
                                sendResponseData(responseData);
                            }
                        }
                        catch (e) {
                            rapi_host_helpers.sendError(e, ctx);
                        }
                    }
                }
                
                let methodResult = method(apiArgs);
                if (methodResult) {
                    // async / promise call

                    methodResult.then(() => {
                        sendResponse();
                    }).catch((err) => {
                        rapi_host_helpers.sendError(err, ctx);
                    });
                }
                else {
                    sendResponse();
                }
            }
            else {
                rapi_host_helpers.sendNotFound(ctx);
            }
        }
        catch (e) {
            rapi_host_helpers.sendError(e, ctx);
        }
    }

    /**
     * Handles a request.
     * 
     * @param {RequestContext} ctx The request context.
     */
    protected handleRequest(ctx: rapi_contracts.RequestContext) {
        let me = this;

        let normalizedPath = rapi_helpers.normalizeString(ctx.url.pathname);

        if (REGEX_API.test(normalizedPath)) {
            // API
            let apiResponse: rapi_contracts.ApiResponse = {
                code: 0,
            };
            
            me.handleApi(ctx, apiResponse);
            return;
        }

        rapi_host_helpers.sendNotFound(ctx);
    }

    /**
     * Starts the server.
     * 
     * @param {number} [port] The custom TCP port to use.
     * 
     * @return Promise<boolean> The promise.
     */
    public start(port?: number): Promise<boolean> {
        if (rapi_helpers.isNullOrUndefined(port)) {
            port = DEFAULT_PORT;
        }
        port = parseInt(rapi_helpers.toStringSafe(port).trim());
        
        let me = this;

        let cfg = rapi_helpers.cloneObject(me.controller.config);

        let accounts: rapi_contracts.Account[] = rapi_helpers.asArray(cfg.users);
        if ('object' === typeof cfg.guest) {
            accounts.push(cfg.guest);
        }

        // init global storages
        accounts.filter(x => x).forEach(x => {
            x.__globals = {};
        });
        
        return new Promise<boolean>((resolve, reject) => {
            let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                if (me._server) {
                    completed(null, false);
                    return;
                }

                let requestListener = (req: HTTP.IncomingMessage, resp: HTTP.ServerResponse) => {
                    try {
                        let url = URL.parse(req.url);

                        let ctx: rapi_contracts.RequestContext = {
                            client: {
                                address: req.connection.remoteAddress,
                                port: req.connection.remotePort,
                            },
                            config: cfg,
                            GET: <any>rapi_host_helpers.urlParamsToObject(url),
                            method: rapi_helpers.normalizeString(req.method),
                            request: req,
                            response: resp,
                            time: Moment().utc(),
                            url: url,
                        };

                        if (!ctx.method) {
                            ctx.method = 'get';
                        }

                        ctx.user = rapi_users.getUser(ctx);
                        if (!ctx.user) {
                            rapi_host_helpers.sendUnauthorized(ctx);
                            return;
                        }

                        try {
                            let validatorArgs: rapi_contracts.ValidatorArguments<rapi_contracts.RemoteClient> = {
                                context: {
                                    config: ctx.config,
                                    method: ctx.method,
                                    request: req,
                                    response: resp,
                                    statusCode: 404,
                                    time: ctx,
                                },
                                globals: me.controller.getGlobals(),
                                globalState: undefined,
                                require: function(id) {
                                    return rapi_helpers.requireModule(id);
                                },
                                state: undefined,
                                value: ctx.client,
                                workspaceState: undefined,
                            };

                            // validatorArgs.globalState
                            Object.defineProperty(validatorArgs, 'globalState', {
                                enumerable: true,
                                get: () => {
                                    return me._VALIDATOR_STATE;
                                }
                            });

                            // validatorArgs.state
                            Object.defineProperty(validatorArgs, 'state', {
                                enumerable: true,
                                get: () => {
                                    return me.controller.workspaceState;
                                }
                            });

                            let validator: rapi_contracts.Validator<rapi_contracts.RemoteClient>;
                            if (!rapi_helpers.isNullOrUndefined(cfg.validator)) {
                                let validatorScript: string;

                                let initialState: any;
                                if ('object' === typeof cfg.validator) {
                                    validatorScript = cfg.validator.script;

                                    validatorArgs.options = cfg.validator.options;
                                    initialState = cfg.validator.state;
                                }
                                else {
                                    validatorScript = rapi_helpers.toStringSafe(cfg.validator);
                                }

                                if (!rapi_helpers.isEmptyString(validatorScript)) {
                                    if (!Path.isAbsolute(validatorScript)) {
                                        validatorScript = Path.join(vscode.workspace.rootPath, validatorScript);
                                    }
                                    validatorScript = Path.resolve(validatorScript);

                                    if ('undefined' === typeof me._VALIDATOR_SCRIPT_STATES[validatorScript]) {
                                        me._VALIDATOR_SCRIPT_STATES[validatorScript] = initialState;
                                    }

                                    let validatorModule = rapi_helpers.loadModuleSync<rapi_contracts.ValidatorModule<rapi_contracts.RemoteClient>>(validatorScript);
                                    if (validatorModule) {
                                        validator = validatorModule.validate;
                                    }

                                    // validatorArgs.state
                                    Object.defineProperty(validatorArgs, 'state', {
                                        enumerable: true,
                                        get: () => {
                                            return me._VALIDATOR_SCRIPT_STATES[validatorScript];
                                        },
                                        set: (newValue) => {
                                            me._VALIDATOR_SCRIPT_STATES[validatorScript] = newValue;
                                        }
                                    });
                                }
                            }
                            validator = rapi_helpers.toValidatorSafe(validator);

                            let handleTheRequest = (isRequestValid: boolean) => {
                                isRequestValid = rapi_helpers.toBooleanSafe(isRequestValid, true);

                                if (isRequestValid) {
                                    try {
                                        me.handleRequest(ctx);
                                    }
                                    catch (e) {
                                        rapi_host_helpers.sendError(e, ctx);
                                    }
                                }
                                else {
                                    try {
                                        // not valid
                                        let statusCode = validatorArgs.context.statusCode;
                                        if (rapi_helpers.isEmptyString(statusCode)) {
                                            statusCode = '404';
                                        }
                                        statusCode = parseInt(rapi_helpers.normalizeString(statusCode));

                                        ctx.response.statusCode = statusCode;

                                        ctx.response.end();
                                    }
                                    catch (e) {
                                        rapi_helpers.log(`[ERROR] ApiHost.start().requestListener(): ${rapi_helpers.toStringSafe(e)}`);
                                    }
                                }
                            };

                            let validatorResult = validator(validatorArgs);
                            if (rapi_helpers.isNullOrUndefined(validatorResult)) {
                                handleTheRequest(true);
                            }
                            else {
                                if ('object' === typeof validatorResult) {
                                    validatorResult.then((isValid) => {
                                        handleTheRequest(isValid);
                                    }).catch((err) => {
                                        rapi_host_helpers.sendError(err, ctx);
                                    })
                                }
                                else {
                                    handleTheRequest(validatorResult);
                                }
                            }
                        }
                        catch (e) {
                            rapi_host_helpers.sendError(e, ctx);
                        }
                    }
                    catch (e) {
                        try {
                            resp.statusCode = 500;
                            resp.end();
                        }
                        catch (e) {
                            //TODO: log
                        }
                    }
                };

                let newServer: HTTP.Server | HTTPs.Server;

                if (cfg.ssl) {
                    let ca: Buffer;
                    let cert: Buffer;
                    let key: Buffer;
                    let passphrase: string;

                    if (cfg.ssl.passphrase) {
                        passphrase = rapi_helpers.toStringSafe(cfg.ssl.passphrase);
                    }

                    if (!rapi_helpers.isEmptyString(cfg.ssl.ca)) {
                        let caFile = rapi_helpers.toStringSafe(cfg.ssl.ca);
                        if (!Path.isAbsolute(caFile)) {
                            caFile = Path.join(vscode.workspace.rootPath, caFile);
                        }
                        caFile = Path.resolve(caFile);

                        ca = FS.readFileSync(caFile);
                    }

                    if (!rapi_helpers.isEmptyString(cfg.ssl.cert)) {
                        let certFile = rapi_helpers.toStringSafe(cfg.ssl.cert);
                        if (!Path.isAbsolute(certFile)) {
                            certFile = Path.join(vscode.workspace.rootPath, certFile);
                        }
                        certFile = Path.resolve(certFile);

                        cert = FS.readFileSync(certFile);
                    }

                    if (!rapi_helpers.isEmptyString(cfg.ssl.key)) {
                        let keyFile = rapi_helpers.toStringSafe(cfg.ssl.key);
                        if (!Path.isAbsolute(keyFile)) {
                            keyFile = Path.join(vscode.workspace.rootPath, keyFile);
                        }
                        keyFile = Path.resolve(keyFile);

                        key = FS.readFileSync(keyFile);
                    }

                    newServer = HTTPs.createServer({
                        ca: ca,
                        cert: cert,
                        key: key,
                        passphrase: passphrase,
                        rejectUnauthorized: rapi_helpers.toBooleanSafe(cfg.ssl.rejectUnauthorized, true),
                    }, requestListener);
                }
                else {
                    newServer = HTTP.createServer(requestListener);
                }

                newServer.on('error', (err) => {
                    completed(err || new Error(`Unknown error! Maybe port '${port}' is in use.`));
                });

                newServer.listen(port, function() {
                    me._server = newServer;
                    completed(null, true);
                });
            }
            catch (e) {
                completed(e);
            }
        });
    }

    /**
     * Starts the server.
     * 
     * @param {number} [port] The custom TCP port to use.
     * 
     * @return Promise<boolean> The promise.
     */
    public stop(): Promise<boolean> {
        let me = this;
        
        return new Promise<boolean>((resolve, reject) => {
            let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                let oldServer = me._server;
                if (!oldServer) {
                    completed(null, false);
                    return;
                }

                oldServer.close(function(err) {
                    if (err) {
                        completed(err);
                    }
                    else {
                        me._server = null;
                        completed(null, true);
                    }
                });
            }
            catch (e) {
                completed(e);
            }
        });
    }
}
