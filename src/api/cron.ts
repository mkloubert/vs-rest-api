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

import * as rapi_contracts from '../contracts';
import * as rapi_helpers from '../helpers';
import * as vscode from 'vscode';

/**
 * Information about a job.
 */
export interface JobInfo {
    /**
     * The description for the job.
     */
    description: string;
    /**
     * Detail information for the job.
     */
    detail: string;
    /**
     * Gets if the job is currently running or not.
     */
    isRunning: boolean;
    /**
     * Gets the timestamp of the last execution in ISO format.
     */
    lastExecution: string;
    /**
     * Gets the name of the job.
     */
    name: string;
}


// [DELETE] /api/cron(/{name})
export function DELETE(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    let canActivate = args.request.user.can('activate');

    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        if (!canActivate) {
            args.sendForbidden();
            completed();
            
            return;
        }

        getJobs().then((jobs) => {
            if (false === jobs) {
                args.sendResponse(410);  // 'vs-cron' is NOT installed
                completed();

                return;
            }

            let jobName: string;
            if (args.endpoint.arguments.length > 0) {
                jobName = rapi_helpers.normalizeString(args.endpoint.arguments[0]);
            }

            let filterJobs = (j?: JobInfo[]): JobInfo[] => {
                return (j || jobs).filter(x => rapi_helpers.normalizeString(x.name) == jobName ||
                                               !jobName);
            };

            let machtingJobs = filterJobs();
            if (!jobName || machtingJobs.length > 0) {
                vscode.commands.getCommands(true).then((commands) => {
                    let stopJobsCmd = commands.filter(x => 'extension.cronJons.stopJobsByName' == x);
                    if (stopJobsCmd.length < 1) {  // 'vs-cron' is NOT installed
                        completed(null, false);
                        return;
                    }

                    vscode.commands.executeCommand(stopJobsCmd[0], machtingJobs.map(x => x.name)).then(() => {
                        getJobs().then((upToDateJobs) => {
                            if (false !== upToDateJobs) {
                                upToDateJobs = upToDateJobs.filter(utdj => machtingJobs.map(mj => rapi_helpers.normalizeString(mj.name))
                                                                                       .indexOf(rapi_helpers.normalizeString(utdj.name)) > -1);

                                args.response.data = filterJobs(upToDateJobs).map(x => jobInfoToObject(x));
                            }

                            completed();
                        }, (err) => {
                            completed(err);
                        });
                    }, (err) => {
                        completed(err);
                    });
                });
            }
            else {
                // not found

                args.sendNotFound();
                completed();
            }
        }, (err) => {
            completed(err);    
        });
    });
}

// [GET] /api/cron
export function GET(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        getJobs().then((jobs) => {
            if (false === jobs) {
                args.sendResponse(410);  // 'vs-cron' is NOT installed
            }
            else {
                args.response.data = jobs.map(x => jobInfoToObject(x));
            }
            
            completed();
        }, (err) => {
            completed(err);    
        });
    });
}

function getJobs(): PromiseLike<JobInfo[] | false> {
    return new Promise<JobInfo[] | false>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        try {
            vscode.commands.getCommands(true).then((commands) => {
                let getJobsCmd = commands.filter(x => 'extension.cronJons.getJobs' == x);
                if (getJobsCmd.length < 1) {  // 'vs-cron' is NOT installed
                    completed(null, false);
                    return;
                }

                try {
                    let callback = (err, jobs: JobInfo[]) => {
                        if (!err) {
                            jobs = (jobs || []).filter(x => x);
                        }

                        completed(err, jobs);
                    };

                    vscode.commands.executeCommand(getJobsCmd[0], callback).then(() => {
                        //TODO
                    }, (err) => {
                        completed(err);
                    });
                }
                catch (e) {
                    completed(e);
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

function jobInfoToObject(job: JobInfo): Object {
    let obj: Object;

    if (job) {
        obj = {
            description: rapi_helpers.isEmptyString(job.description) ? undefined : rapi_helpers.toStringSafe(job.description),
            detail: rapi_helpers.isEmptyString(job.detail) ? undefined : rapi_helpers.toStringSafe(job.detail),
            isRunning: rapi_helpers.toBooleanSafe(job.isRunning),
            lastExecution: rapi_helpers.isEmptyString(job.lastExecution) ? undefined : rapi_helpers.toStringSafe(job.lastExecution),
            name: rapi_helpers.isEmptyString(job.name) ? undefined : rapi_helpers.toStringSafe(job.name),
            path: '/api/cron/' + encodeURIComponent(rapi_helpers.toStringSafe(job.name)),
        };
    }

    return obj;
}


// [POST] /api/cron(/{name})
export function POST(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    let canActivate = args.request.user.can('activate');

    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        if (!canActivate) {
            args.sendForbidden();
            completed();
            
            return;
        }

        getJobs().then((jobs) => {
            if (false === jobs) {
                args.sendResponse(410);  // 'vs-cron' is NOT installed
                completed();

                return;
            }

            let jobName: string;
            if (args.endpoint.arguments.length > 0) {
                jobName = rapi_helpers.normalizeString(args.endpoint.arguments[0]);
            }

            let filterJobs = (j?: JobInfo[]): JobInfo[] => {
                return (j || jobs).filter(x => rapi_helpers.normalizeString(x.name) == jobName ||
                                               !jobName);
            };

            let machtingJobs = filterJobs();
            if (!jobName || machtingJobs.length > 0) {
                if (jobName && machtingJobs.filter(x => x.isRunning).length > 0) {
                    // at least one job is running

                    args.sendResponse(409);
                    completed();
                    
                    return;
                }

                vscode.commands.getCommands(true).then((commands) => {
                    let startJobsCmd = commands.filter(x => 'extension.cronJons.startJobsByName' == x);
                    if (startJobsCmd.length < 1) {  // 'vs-cron' is NOT installed
                        completed(null, false);
                        return;
                    }

                    vscode.commands.executeCommand(startJobsCmd[0], machtingJobs.map(x => x.name)).then(() => {
                        getJobs().then((upToDateJobs) => {
                            if (false !== upToDateJobs) {
                                upToDateJobs = upToDateJobs.filter(utdj => machtingJobs.map(mj => rapi_helpers.normalizeString(mj.name))
                                                                                       .indexOf(rapi_helpers.normalizeString(utdj.name)) > -1);

                                args.response.data = filterJobs(upToDateJobs).map(x => jobInfoToObject(x));
                            }

                            completed();
                        }, (err) => {
                            completed(err);
                        });
                    }, (err) => {
                        completed(err);
                    });
                });
            }
            else {
                // not found

                args.sendNotFound();
                completed();
            }
        }, (err) => {
            completed(err);    
        });
    });
}

// [PUT] /api/cron(/{name})
export function PUT(args: rapi_contracts.ApiMethodArguments): PromiseLike<any> {
    let canActivate = args.request.user.can('activate');

    return new Promise<any>((resolve, reject) => {
        let completed = rapi_helpers.createSimplePromiseCompletedAction(resolve, reject);

        if (!canActivate) {
            args.sendForbidden();
            completed();
            
            return;
        }

        getJobs().then((jobs) => {
            if (false === jobs) {
                args.sendResponse(410);  // 'vs-cron' is NOT installed
                completed();

                return;
            }

            let jobName: string;
            if (args.endpoint.arguments.length > 0) {
                jobName = rapi_helpers.normalizeString(args.endpoint.arguments[0]);
            }

            let filterJobs = (j?: JobInfo[]): JobInfo[] => {
                return (j || jobs).filter(x => rapi_helpers.normalizeString(x.name) == jobName ||
                                               !jobName);
            };

            let machtingJobs = filterJobs();
            if (!jobName || machtingJobs.length > 0) {
                vscode.commands.getCommands(true).then((commands) => {
                    let restartJobsCmd = commands.filter(x => 'extension.cronJons.restartJobsByName' == x);
                    if (restartJobsCmd.length < 1) {  // 'vs-cron' is NOT installed
                        completed(null, false);
                        return;
                    }

                    vscode.commands.executeCommand(restartJobsCmd[0], machtingJobs.map(x => x.name)).then(() => {
                        getJobs().then((upToDateJobs) => {
                            if (false !== upToDateJobs) {
                                upToDateJobs = upToDateJobs.filter(utdj => machtingJobs.map(mj => rapi_helpers.normalizeString(mj.name))
                                                                                       .indexOf(rapi_helpers.normalizeString(utdj.name)) > -1);

                                args.response.data = filterJobs(upToDateJobs).map(x => jobInfoToObject(x));
                            }

                            completed();
                        }, (err) => {
                            completed(err);
                        });
                    }, (err) => {
                        completed(err);
                    });
                });
            }
            else {
                // not found

                args.sendNotFound();
                completed();
            }
        }, (err) => {
            completed(err);    
        });
    });
}
