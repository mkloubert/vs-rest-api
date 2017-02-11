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

import * as i18 from './i18';
import * as Moment from 'moment';
import * as OS from 'os';
import * as rapi_contracts from './contracts';
import * as rapi_helpers from './helpers';
import * as rapi_host from './host';
import * as vscode from 'vscode';


/**
 * The controller of that extension.
 */
export class Controller implements vscode.Disposable {
    /**
     * The current configuration.
     */
    protected _config: rapi_contracts.Configuration;
    /**
     * Stores the underlying extension context.
     */
    protected readonly _CONTEXT: vscode.ExtensionContext;
    /**
     * The current host.
     */
    protected _host: rapi_host.ApiHost;
    /**
     * Stores the global output channel.
     */
    protected readonly _OUTPUT_CHANNEL: vscode.OutputChannel;
    /**
     * Stores the package file of that extension.
     */
    protected readonly _PACKAGE_FILE: rapi_contracts.PackageFile;
    /**
     * Stores the object that shares data workspace wide.
     */
    protected _workspaceState: Object;

    /**
     * Initializes a new instance of that class.
     * 
     * @param {vscode.ExtensionContext} context The underlying extension context.
     * @param {vscode.OutputChannel} outputChannel The global output channel to use.
     * @param {rapi_contracts.PackageFile} pkgFile The package file of that extension.
     */
    constructor(context: vscode.ExtensionContext,
                outputChannel: vscode.OutputChannel,
                pkgFile: rapi_contracts.PackageFile) {
        this._CONTEXT = context;
        this._OUTPUT_CHANNEL = outputChannel;
        this._PACKAGE_FILE = pkgFile;
    }

    /**
     * Gets the current configuration.
     */
    public get config(): rapi_contracts.Configuration {
        return this._config;
    }

    /**
     * Gets the extension context.
     */
    public get context(): vscode.ExtensionContext {
        return this._CONTEXT;
    }

    /**
     * Logs a message.
     * 
     * @param {any} msg The message to log.
     * 
     * @chainable
     */
    public log(msg: any): Controller {
        let now = Moment();

        msg = rapi_helpers.toStringSafe(msg);
        this.outputChannel
            .appendLine(`[${now.format('YYYY-MM-DD HH:mm:ss')}] ${msg}`);

        return this;
    }

    /** @inheritdoc */
    public dispose() {
    }

    /**
     * Returns a copy of the global data from the settings.
     * 
     * @return {any} The global data from the settings.
     */
    public getGlobals(): any {
        let globals = this.config.globals;
        if (globals) {
            globals = rapi_helpers.cloneObject(globals);
        }

        return globals;
    }

    /**
     * The 'on activated' event.
     */
    public onActivated() {
        this.reloadConfiguration();
    }

    /**
     * The 'on deactivate' event.
     */
    public onDeactivate() {
    }

    /**
     * Event after configuration changed.
     */
    public onDidChangeConfiguration() {
        this.reloadConfiguration();
    }

    /**
     * Gets the global output channel.
     */
    public get outputChannel(): vscode.OutputChannel {
        return this._OUTPUT_CHANNEL;
    }

    /**
     * Gets the package file of that extension.
     */
    public get packageFile(): rapi_contracts.PackageFile {
        return this._PACKAGE_FILE;
    }

    /**
     * Reloads configuration.
     */
    public reloadConfiguration() {
        let me = this;

        let oldWorkspaceState = this._workspaceState;
        if (oldWorkspaceState) {
            // dispose old output channels
            let oldOutputChannels: vscode.OutputChannel[] = oldWorkspaceState['outputChannels'];
            if (oldOutputChannels) {
                oldOutputChannels.filter(x => x).forEach(x => {
                    rapi_helpers.tryDispose(x);
                });

                delete oldWorkspaceState['outputChannels'];
            }
        }

        let cfg = <rapi_contracts.Configuration>vscode.workspace.getConfiguration("rest.api");
        me._workspaceState = {
            globalAccountPreparerStates: {},
            globalAccountPreparerScriptStates: {},
            outputChannels: [],
        };
        me._workspaceState[rapi_contracts.VAR_HTML_DOCS] = [];
        me._workspaceState[rapi_contracts.VAR_NEXT_HTML_DOC_ID] = -1;

        let nextSteps = (err?: any) => {
            if (err) {
                vscode.window.showErrorMessage(`Could not load language: ${rapi_helpers.toStringSafe(err)}`);
                return;
            }

            me._config = cfg;

            me.showNewVersionPopup();

            if (rapi_helpers.toBooleanSafe(cfg.autoStart)) {
                this.start().then(() => {
                    //TODO
                }, (e) => {
                    me.log(`[ERROR] Controller.reloadConfiguration().autoStart(1): ${rapi_helpers.toStringSafe(e)}`);
                });
            }
            else {
                this.stop().then(() => {
                    //TODO
                }, (e) => {
                    me.log(`[ERROR] Controller.reloadConfiguration().autoStart(2): ${rapi_helpers.toStringSafe(e)}`);
                });
            }
        };

        // load language
        try {
            i18.init(cfg.lang).then(() => {
                nextSteps();
            }, (err) => {
                nextSteps(err);
            });
        }
        catch (e) {
            nextSteps(e);
        }
    }


    /**
     * Shows the popup for a new version.
     */
    protected showNewVersionPopup() {
        let me = this;

        let pkg = me.packageFile;
        if (!pkg) {
            return;
        }

        let currentVersion = pkg.version;
        if (!currentVersion) {
            return;
        }

        const KEY_LAST_KNOWN_VERSION = 'vsraLastKnownVersion';

        // update last known version
        let updateCurrentVersion = false;
        try {
            let lastKnownVersion: any = this._CONTEXT.globalState.get(KEY_LAST_KNOWN_VERSION, false);
            if (lastKnownVersion != currentVersion) {
                if (!rapi_helpers.toBooleanSafe(this.config.disableNewVersionPopups)) {
                    // tell the user that it runs on a new version
                    updateCurrentVersion = true;

                    // [BUTTON] show change log
                    let changeLogBtn: rapi_contracts.PopupButton = {
                        action: () => {
                            rapi_helpers.open('https://github.com/mkloubert/vs-rest-api/blob/master/CHANGELOG.md').then(() => {
                            }, (err) => {
                                me.log(i18.t('errors.withCategory', 'Controller.showNewVersionPopup(4)', err));
                            });
                        },
                        title: i18.t('popups.newVersion.showChangeLog'),
                    };

                    vscode.window
                          .showInformationMessage(i18.t('popups.newVersion.message', currentVersion),
                                                  changeLogBtn)
                          .then((item) => {
                                  if (!item || !item.action) {
                                      return;
                                  }

                                  try {
                                      item.action();
                                  }
                                  catch (e) { 
                                      me.log(i18.t('errors.withCategory', 'Controller.showNewVersionPopup(3)', e));
                                  }
                                });
                }
            }
        }
        catch (e) { 
            me.log(i18.t('errors.withCategory', 'Controller.showNewVersionPopup(2)', e));
        }

        if (updateCurrentVersion) {
            // update last known version
            try {
                this._CONTEXT.globalState.update(KEY_LAST_KNOWN_VERSION, currentVersion);
            }
            catch (e) {
                me.log(i18.t('errors.withCategory', 'Controller.showNewVersionPopup(1)', e));
            }
        }
    }

    /**
     * Starts the host.
     * 
     * @return {PromiseLike<rapi_host.VSCodeRemoteHost>} The promise.
     */
    public start(): PromiseLike<rapi_host.ApiHost> {
        let me = this;

        let cfg = me.config;

        let port = cfg.port;
        if (rapi_helpers.isEmptyString(port)) {
            port = rapi_host.DEFAULT_PORT;
        }
        port = parseInt(rapi_helpers.normalizeString(port));

        return new Promise<rapi_host.ApiHost>((resolve, reject) => {
            let completed = (err: any, h?: rapi_host.ApiHost) => {
                if (err) {
                    vscode.window.showErrorMessage(`[vs-rest-api] ${i18.t('host.startFailed', err)}`);

                    reject(err);
                }
                else {
                    if (rapi_helpers.toBooleanSafe(cfg.showPopupOnSuccess, true)) {
                        vscode.window.showInformationMessage(`[vs-rest-api] ${i18.t('host.started', port)}.`);
                    }

                    let protocol = 'http';
                    if (cfg.ssl) {
                        protocol += 's';
                    }

                    let browserUrl = `${protocol}://127.0.0.1:${port}/api/`;

                    me.outputChannel.appendLine(`${i18.t('host.started', port)}:`);
                    try {
                        me.outputChannel.appendLine(`\t- ${protocol}://${rapi_helpers.normalizeString(OS.hostname())}:${port}/api/`);

                        let networkInterfaces = OS.networkInterfaces();
                        let networkInterfaceNames = Object.keys(networkInterfaces);

                        if (networkInterfaceNames.length > 0) {
                            networkInterfaceNames.forEach((ifName) => {
                                let ifaces = networkInterfaces[ifName].filter(x => {
                                    let addr = rapi_helpers.normalizeString(x.address);
                                    if ('IPv4' == x.family) {
                                        return !/^(127\.[\d.]+|[0:]+1|localhost)$/.test(addr);
                                    }

                                    return false;
                                });

                                ifaces.forEach((x) => {
                                    me.outputChannel.appendLine(`\t- ${protocol}://${x.address}:${port}/api/`);
                                });
                            });
                        }
                    }
                    catch (e) {
                        me.log(i18.t('errors.withCategory', e));
                    }
                    me.outputChannel.appendLine('');

                    if (rapi_helpers.toBooleanSafe(cfg.openInBrowser)) {
                        rapi_helpers.open(browserUrl).then(() => {
                            //TODO
                        }, (err) => {
                            vscode.window.showWarningMessage(`[vs-rest-api] ${i18.t('browser.openFailed', browserUrl, err)}`);
                        });
                    }

                    resolve(h);
                }
            };

            let startHost = () => {
                me._host = null;

                let newHost = new rapi_host.ApiHost(me);

                newHost.start(port).then((started) => {
                    if (started) {
                        me._host = newHost;

                        completed(null, newHost);
                    }
                    else {
                        completed(new Error(`[vs-rest-api] ${i18.t('host.notStarted')}`));
                    }
                }, (err) => {
                    completed(err);
                });
            };

            let currentHost = me._host;
            if (currentHost) {
                // restart

                currentHost.stop().then(() => {
                    startHost();
                }, (err) => {
                    completed(err);
                });
            }
            else {
                startHost();
            }
        });
    }

    /**
     * Stops the host.
     * 
     * @return {PromiseLike<boolean>} The promise.
     */
    public stop(): PromiseLike<boolean> {
        let me = this;

        let cfg = me.config;

        return new Promise<boolean>((resolve, reject) => {
            let completed = (err: any, stopped?: boolean) => {
                if (err) {
                    vscode.window.showErrorMessage(`[vs-rest-api] ${i18.t('host.stopFailed', err)}`);

                    reject(err);
                }
                else {
                    if (stopped) {
                        if (rapi_helpers.toBooleanSafe(cfg.showPopupOnSuccess, true)) {
                            vscode.window.showInformationMessage(`[vs-rest-api] ${i18.t('host.stopped')}`);
                        }
                    }
                    
                    resolve(stopped);
                }
            };

            let currentHost = me._host;
            if (currentHost) {
                currentHost.stop().then((stopped) => {
                    me._host = null;

                    completed(null, stopped);
                }, (err) => {
                    completed(err);
                });
            }
            else {
                // nothing to stop
                completed(null, false);
            }
        });
    }

    /**
     * Toggle the state of the current host.
     * 
     * @returns {PromiseLike<boolean>} The promise.
     */
    public toggleHostState(): PromiseLike<boolean> {
        let me = this;

        return new Promise<boolean>((resolve, reject) => {
            if (me._host) {
                me.stop().then(() => {
                    resolve(false);
                }, (err) => {
                    reject(err);
                });
            }
            else {
                me.start().then(() => {
                    resolve(true);
                }, (err) => {
                    reject(err);
                });
            }
        });
    }

    /**
     * Gets the object that shares data workspace wide.
     */
    public get workspaceState(): Object {
        return this._workspaceState;
    }
}
