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


/**
 * An account.
 */
export interface Account {
    /**
     * [INTERNAL USE] This is used to store global data.
     */
    __globals: { [action: string]: any };

    /**
     * One or more glob patterns with files to exclude.
     */
    exclude?: string | string[];
    /**
     * One or more glob patterns with files to include.
     */
    files?: string | string[];
    /**
     * Is account active or not.
     */
    isActive?: boolean;
}

/**
 * The configuration.
 */
export interface Configuration {
    /**
     * Start HTTP on startup or not.
     */
    autoStart?: boolean;
    /**
     * Configuration for the "guest" account.
     */
    guest?: Account | boolean;
    /**
     * The custom language to use.
     */
    lang?: string;
    /**
     * Settings for live file content updates.
     */
    liveUpdate?: {
        /**
         * Is active or not.
         */
        isActive?: boolean;
    },
    /**
     * Indicates if the root endpoint should be opened in browser after host has been started or not.
     */
    openInBrowser?: boolean;
    /**
     * The TCP port the HTTP server should listen on.
     */
    port?: number;
    /**
     * The name of the realm for the authentication.
     */
    realm?: string;
    /**
     * Indicates if an info popup / notification should be displayed after a successful start / stop of the API host.
     */
    showPopupOnSuccess?: boolean;
    /**
     * Configuration for running as HTTPs server.
     */
    ssl?: {
        /**
         * The path to the ca file.
         */
        ca?: string;
        /**
         * The path to the file of the certificate.
         */
        cert?: string;
        /**
         * The path to the key file.
         */
        key?: string;
        /**
         * The required password for the key file.
         */
        passphrase?: string;
        /**
         * Request unauthorized or not.
         */
        rejectUnauthorized?: boolean;
    },
    /**
     * One or more user accounts.
     */
    users?: UserAccount | UserAccount[];
    /**
     * Show (directories) with leading '.' character or not.
     */
    withDot?: boolean;
}

/**
 * Describes the structure of the package file of that extenstion.
 */
export interface PackageFile {
    /**
     * The display name.
     */
    displayName: string;
    /**
     * The (internal) name.
     */
    name: string;
    /**
     * The version string.
     */
    version: string;
}

/**
 * An user account.
 */
export interface UserAccount extends Account {
    /**
     * The name of the user.
     */
    name: string;
    /**
     * The password.
     */
    password: string;
}
