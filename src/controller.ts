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

        let cfg = <rapi_contracts.Configuration>vscode.workspace.getConfiguration("remote.editor");

        let nextSteps = (err?: any) => {
            if (err) {
                vscode.window.showErrorMessage(`Could not load language: ${rapi_helpers.toStringSafe(err)}`);
                return;
            }

            let t = i18.t('__test');

            me._config = cfg;

            if (rapi_helpers.toBooleanSafe(cfg.autoStart)) {
                this.start().then(() => {
                    //TODO
                }).catch((e) => {
                    me.log(`[ERROR] Controller.reloadConfiguration().autoStart(1): ${rapi_helpers.toStringSafe(e)}`);
                });
            }
            else {
                this.stop().then(() => {
                    //TODO
                }).catch((e) => {
                    me.log(`[ERROR] Controller.reloadConfiguration().autoStart(2): ${rapi_helpers.toStringSafe(e)}`);
                });
            }
        };

        // load language
        try {
            i18.init(cfg.lang).then(() => {
                nextSteps();
            }).catch((err) => {
                nextSteps(err);
            });
        }
        catch (e) {
            nextSteps(e);
        }
    }

    /**
     * Starts the host.
     * 
     * @return {Promise<rapi_host.VSCodeRemoteHost>} The promise.
     */
    public start(): Promise<rapi_host.ApiHost> {
        let me = this;

        let cfg = me.config;

        return new Promise<rapi_host.ApiHost>((resolve, reject) => {
            let completed = (err: any, h?: rapi_host.ApiHost) => {
                if (err) {
                    vscode.window.showErrorMessage(`[vs-remote-editor] Could not start host: ${rapi_helpers.toStringSafe(err)}`);

                    reject(err);
                }
                else {
                    resolve(h);
                }
            };

            let startHost = () => {
                me._host = null;

                let newHost = new rapi_host.ApiHost(me);

                let port = cfg.port || rapi_host.DEFAULT_PORT;

                newHost.start(port).then((started) => {
                    if (started) {
                        me._host = newHost;

                        completed(null, newHost);
                    }
                    else {
                        vscode.window.showErrorMessage("[vs-remote-editor] Server has not been started!");
                    }
                }).catch((err) => {
                    completed(err);
                });
            };

            let currentHost = me._host;
            if (currentHost) {
                // restart

                currentHost.stop().then(() => {
                    startHost();
                }).catch((err) => {
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
     * @return {Promise<boolean>} The promise.
     */
    public stop(): Promise<boolean> {
        let me = this;

        return new Promise<boolean>((resolve, reject) => {
            let completed = (err: any, stopped?: boolean) => {
                if (err) {
                    vscode.window.showErrorMessage(`[vs-remote-editor] Could not stop host: ${rapi_helpers.toStringSafe(err)}`);

                    reject(err);
                }
                else {
                    resolve(stopped);
                }
            };

            let currentHost = me._host;
            if (currentHost) {
                currentHost.stop().then(() => {
                    me._host = null;

                    completed(null, true);
                }).catch((err) => {
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
     */
    public toggleHostState() {
        let me = this;
        let cfg = me.config;

        let currentHost = me._host;
        if (currentHost) {
            me.stop().then(() => {
                //TODO
            }).catch((err) => {
                me.log(`[ERROR] Controller.toggleHostState(1): ${rapi_helpers.toStringSafe(err)}`);
            });
        }
        else {
            me.start().then(() => {
                //TODO
            }).catch((err) => {
                me.log(`[ERROR] Controller.toggleHostState(2): ${rapi_helpers.toStringSafe(err)}`);
            });
        }
    }
}
