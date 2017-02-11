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
import * as HTTP from 'http';
import * as HTTPs from 'https';
import * as i18 from './i18';
import * as Moment from 'moment';
import * as OS from 'os';
import * as Path from 'path';
import * as rapi_contracts from './contracts';
import * as rapi_controller from './controller';
import * as rapi_helpers from './helpers';
import * as rapi_host_helpers from './host/helpers';
import * as rapi_host_users from './host/users';
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
 * Context for validating a connection / user.
 */
export interface ValidateConnectionContext {
    /**
     * The app settings.
     */
    config: rapi_contracts.Configuration;
    /**
     * The request method.
     */
    readonly method: string;
    /**
     * The request context.
     */
    request: HTTP.IncomingMessage;
    /**
     * The response context.
     */
    response: HTTP.ServerResponse;
    /**
     * The status code to return if connection is invalid.
     */
    statusCode: number;
    /**
     * The timestamp.
     */
    readonly time: Moment.Moment;
    /**
     * The user.
     */
    readonly user: rapi_contracts.User;
}


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
        }, (err) => {
            me.controller.log(i18.t('errors.withCategory', 'ApiHost.dispose()', err));
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
                                      .map(x => decodeURIComponent(x))
                                      .filter(x => !rapi_helpers.isEmptyString(x));

            let apiArgs: rapi_contracts.ApiMethodArguments;
            apiArgs = {
                encoding: DEFAULT_ENCODING,
                executeBuildIn: function(endpoint?, args?) {
                    args = args || apiArgs;

                    return new Promise<any>((resolve, reject) => {
                        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

                        try {
                            endpoint = rapi_helpers.normalizeString(endpoint);
                            if (!endpoint) {
                                // try use default
                                if (parts.length > 0) {
                                    endpoint = rapi_helpers.normalizeString(parts[0]);
                                }
                            }

                            let buildInMethod: rapi_contracts.ApiMethod;
                            if (endpoint) {
                                try {
                                    let buildInModule: rapi_contracts.ApiModule = require('./api/' + endpoint);
                                    if (buildInModule) {
                                        let upperMethod = ctx.method.toUpperCase();
                                        for (let p in buildInModule) {
                                            if (p == upperMethod) {
                                                if ('function' === typeof buildInModule[p]) {
                                                    // found

                                                    buildInMethod = buildInModule[p];
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
                                catch (e) { /* not found */ }
                            }

                            if (buildInMethod) {
                                let buildInMethodResult = buildInMethod(args);
                                if (buildInMethodResult) {
                                    // Promise => async

                                    buildInMethodResult.then((r) => {
                                        completed(null, r);
                                    }, (err) => {
                                        completed(err);
                                    });
                                }
                                else {
                                    completed();
                                }
                            }
                            else {
                                args.sendMethodNotAllowed();

                                completed();
                            }
                        }
                        catch (e) {
                            completed(e);
                        }
                    });
                },
                extension: me.controller.context,
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
                options: undefined,
                outputChannel: me.controller.outputChannel,
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
                sendForbidden: function() {
                    this.statusCode = 403;
                    
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

                            let upperMethod = ctx.method.toUpperCase();
                            for (let p in mod) {
                                if (p == upperMethod) {
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
                            endpoints: {},
                            time: ctx.time.format('YYYY-MM-DD HH:mm:ss'),
                        };

                        // endpoints
                        {
                            let endpoints: { [key: string]: any } = ac.response.data['endpoints'];

                            // commands
                            if (ac.request.user.get(rapi_host_users.VAR_CAN_EXECUTE)) {
                                endpoints['commands'] = {
                                    'get': '/api/commands',
                                    'post': '/api/commands/{commandId}',
                                };
                            }

                            // active editor
                            {
                                endpoints['active_editor'] = {
                                    'get': '/api/editor',
                                };

                                if (ac.request.user.get(rapi_host_users.VAR_CAN_CLOSE)) {
                                    endpoints['active_editor']['delete'] = '/api/editor';
                                }
                                if (ac.request.user.get(rapi_host_users.VAR_CAN_OPEN)) {
                                    endpoints['active_editor']['post'] = '/api/editor(/{file})';
                                }
                                if (ac.request.user.get(rapi_host_users.VAR_CAN_WRITE)) {
                                    endpoints['active_editor']['patch'] = '/api/editor';
                                    endpoints['active_editor']['put'] = '/api/editor';
                                }
                            }

                            // app globals
                            {
                                endpoints['app_globals'] = {
                                    'get': '/api/appglobals',
                                };

                                if (ac.request.user.get(rapi_host_users.VAR_CAN_DELETE)) {
                                    endpoints['app_globals']['delete'] = '/api/appglobals/{name}';
                                }
                                if (ac.request.user.get(rapi_host_users.VAR_CAN_WRITE)) {
                                    endpoints['app_globals']['put'] = '/api/appglobals/{name}';
                                }
                            }

                            // app state
                            {
                                endpoints['app_state'] = {
                                    'get': '/api/appstate',
                                };

                                if (ac.request.user.get(rapi_host_users.VAR_CAN_DELETE)) {
                                    endpoints['app_state']['delete'] = '/api/appstate/{name}';
                                }
                                if (ac.request.user.get(rapi_host_users.VAR_CAN_WRITE)) {
                                    endpoints['app_state']['put'] = '/api/appstate/{name}';
                                }
                            }

                            // open editor
                            {
                                endpoints['open_editors'] = {
                                    'get': '/api/editors',
                                };

                                if (ac.request.user.get(rapi_host_users.VAR_CAN_CLOSE)) {
                                    endpoints['open_editors']['delete'] = '/api/editors(/{id})';
                                }
                                if (ac.request.user.get(rapi_host_users.VAR_CAN_OPEN)) {
                                    endpoints['open_editors']['post'] = '/api/editors(/{id})';
                                }
                                if (ac.request.user.get(rapi_host_users.VAR_CAN_WRITE)) {
                                    endpoints['open_editors']['patch'] = '/api/editors(/{id})';
                                    endpoints['open_editors']['put'] = '/api/editors(/{id})';
                                }
                            }

                            // extensions
                            {
                                endpoints['extensions'] = {
                                    'get': '/api/extensions',
                                };

                                if (ac.request.user.get(rapi_host_users.VAR_CAN_ACTIVATE)) {
                                    endpoints['extensions']['post'] = '/api/editors/{id}';
                                }
                            }

                            // globals
                            {
                                endpoints['globals'] = {
                                    'get': '/api/globals',
                                };

                                if (ac.request.user.get(rapi_host_users.VAR_CAN_DELETE)) {
                                    endpoints['globals']['delete'] = '/api/globals/{name}';
                                }
                                if (ac.request.user.get(rapi_host_users.VAR_CAN_WRITE)) {
                                    endpoints['globals']['put'] = '/api/globals/{name}';
                                }
                            }

                            // languages
                            {
                                endpoints['languages'] = {
                                    'get': '/api/languages',
                                };
                            }

                            // output channels
                            {
                                endpoints['outputs'] = {
                                    'get': '/api/outputs',
                                };

                                if (ac.request.user.get(rapi_host_users.VAR_CAN_DELETE)) {
                                    endpoints['outputs']['delete'] = '/api/outputs/{id}';
                                }
                                if (ac.request.user.get(rapi_host_users.VAR_CAN_CREATE)) {
                                    endpoints['outputs']['post'] = '/api/outputs/{name}';
                                }
                                if (ac.request.user.get(rapi_host_users.VAR_CAN_WRITE)) {
                                    endpoints['outputs']['patch'] = '/api/outputs/{id}';
                                    endpoints['outputs']['put'] = '/api/outputs/{id}';
                                }
                            }

                            // state
                            {
                                endpoints['state'] = {
                                    'get': '/api/state',
                                };

                                if (ac.request.user.get(rapi_host_users.VAR_CAN_DELETE)) {
                                    endpoints['state']['delete'] = '/api/state/{name}';
                                }
                                if (ac.request.user.get(rapi_host_users.VAR_CAN_WRITE)) {
                                    endpoints['state']['put'] = '/api/state/{name}';
                                }
                            }

                            // workspace
                            {
                                endpoints['workspace'] = {
                                    'get': '/api/workspace(/{path})',
                                };

                                if (ac.request.user.get(rapi_host_users.VAR_CAN_DELETE)) {
                                    endpoints['workspace']['delete'] = '/api/workspace/{path}';
                                }
                                if (ac.request.user.get(rapi_host_users.VAR_CAN_WRITE)) {
                                    endpoints['workspace']['patch'] = '/api/workspace/{path}';
                                    endpoints['workspace']['post'] = '/api/workspace/{path}';
                                    endpoints['workspace']['put'] = '/api/workspace/{path}';
                                }
                            }

                            // popups
                            {
                                if (ac.request.user.get(rapi_host_users.VAR_CAN_EXECUTE)) {
                                    endpoints['popups'] = {
                                        'post': '/api/popups',
                                    };
                                }
                            }
                        }

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
                                    me.controller.log(i18.t('errors.withCategory', 'ApiHost.handleApi.sendResponseData()', e));
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
                                }, (err) => {
                                    me.controller.log(i18.t('errors.withCategory', 'ApiHost.handleApi.compressForResponse()', err));

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
                    }, (err) => {
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
                env: {
                    app: {
                        name: rapi_helpers.toStringSafe(vscode.env.appName),
                        version: rapi_helpers.toStringSafe(vscode.version),
                    },
                    host: rapi_helpers.normalizeString(OS.hostname()),
                    lang: rapi_helpers.normalizeString(vscode.env.language),
                    machine: rapi_helpers.toStringSafe(vscode.env.machineId),
                    session: rapi_helpers.toStringSafe(vscode.env.sessionId),
                }
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
     * @return PromiseLike<boolean> The promise.
     */
    public start(port?: number): PromiseLike<boolean> {
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
                            workspaceState: undefined,
                        };

                        // ctx.workspaceState
                        Object.defineProperty(ctx, 'workspaceState', {
                            enumerable: true,
                            get: () => {
                                return me.controller.workspaceState;
                            }
                        });

                        if (!ctx.method) {
                            ctx.method = 'get';
                        }

                        rapi_users.getUser(ctx).then((user) => {
                            ctx.user = user;
                            if (!ctx.user) {
                                rapi_host_helpers.sendUnauthorized(ctx);
                                return;
                            }

                            try {
                                let validatorCtx: ValidateConnectionContext = {
                                    config: ctx.config,
                                    method: ctx.method,
                                    request: req,
                                    response: resp,
                                    statusCode: 404,
                                    time: ctx.time,
                                    user: user,
                                };

                                let validatorArgs: rapi_contracts.ValidatorArguments<rapi_contracts.RemoteClient> = {
                                    context: validatorCtx,
                                    globals: me.controller.getGlobals(),
                                    globalState: undefined,
                                    options: undefined,
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
                                            rapi_helpers.log(i18.t('errors.withCategory', 'ApiHost.start().requestListener()', e));
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
                                        }, (err) => {
                                            rapi_host_helpers.sendError(err, ctx);
                                        });
                                    }
                                    else {
                                        handleTheRequest(validatorResult);
                                    }
                                }
                            }
                            catch (e) {
                                rapi_host_helpers.sendError(e, ctx);
                            }
                        }, (err) => {
                            rapi_host_helpers.sendError(err, ctx);
                        });  
                    }
                    catch (e) {
                        try {
                            resp.statusCode = 500;
                            resp.end();
                        }
                        catch (e) {
                            me.controller.log(i18.t('errors.withCategory', 'ApiHost.handleApi.HTTP_500', e));
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
     * @return PromiseLike<boolean> The promise.
     */
    public stop(): PromiseLike<boolean> {
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
