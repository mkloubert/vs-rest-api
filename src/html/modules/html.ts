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

import * as rapi_content from '../../content';
import * as rapi_contracts from '../../contracts';
import * as rapi_helpers from '../../helpers';


export function execute(args: rapi_content.HtmlViewerExecutorArguments): string {
    let htmlDocs: rapi_contracts.Document[] = args.workspaceState[rapi_contracts.VAR_HTML_DOCS];

    let doc: rapi_contracts.Document;

    let params = rapi_helpers.uriParamsToObject(args.uri);

    let idValue = rapi_helpers.getUrlParam(params, 'id');
    if (!rapi_helpers.isEmptyString(idValue)) {
        let id = parseInt(idValue.trim());
        
        // search for document
        for (let i = 0; i < htmlDocs.length; i++) {
            let d = htmlDocs[i];

            if (d.id == id) {
                doc = d;
                break;
            }
        }
    }

    let html = '';

    if (doc) {
        if (doc.body) {
            let enc = rapi_helpers.normalizeString(doc.encoding);
            if (!enc) {
                enc = 'utf8';
            }

            html = doc.body.toString(enc);
        }
    }

    return html;
}
