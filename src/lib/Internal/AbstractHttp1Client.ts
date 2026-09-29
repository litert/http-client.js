/**
 * Copyright 2026 Angus.Fenying <fenying@litert.org>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as C from '../Common';
import { AbstractProtocolClient } from './AbstractProtocolClient';
import { Readable } from 'stream';
import * as $H1 from 'http';
import * as A from './Abstract';
import * as E from '../Errors';
import { pipeline } from 'stream/promises';

export abstract class AbstractHttp1Client extends AbstractProtocolClient {

    public constructor(
        protected _: A.IHelper
    ) {

        super();
    }

    protected async _processRequest(
        theReq: $H1.ClientRequest,
        opts: C.IRequestOptions,
        hasReqEntity: boolean
    ): Promise<A.IRequestResult> {

        const signal = this._getAbortSignal(opts);
        const response = new Promise<A.IRequestResult>((resolve, reject) => {

            const onResponse = (resp: $H1.IncomingMessage): void => {

                if (opts.timeout) {

                    resp.setTimeout(opts.timeout, () => resp.destroy(
                        new E.E_REQUEST_TIMEOUT({ 'phase': 'receiving' })
                    ));
                }

                resolve({
                    'protocol': opts.url.protocol === 'https' ?
                        C.EProtocol.HTTPS_1 : C.EProtocol.HTTP_1,
                    'gzip': opts.gzip,
                    'deflate': opts.deflate,
                    'stream': resp,
                    'headers': resp.headers as C.TResponseHeaders,
                    'statusCode': resp.statusCode!,
                    'contentLength': resp.headers[C.Headers.CONTENT_LENGTH_H1] === undefined ?
                        Infinity : parseInt(resp.headers[C.Headers.CONTENT_LENGTH_H1] ),
                    'noEntity': !this._.hasEntity(opts.method),
                });
            };
            const onError = (error: Error): void => {

                theReq.removeListener('response', onResponse);
                reject(error);
            };

            theReq.on('response', onResponse);
            theReq.once('error', onError);
        });

        /**
         * The request can fail before this method returns the response promise.
         * Observe that rejection immediately while preserving it for the caller.
         */
        void response.catch(() => undefined);

        theReq.setTimeout(opts.timeout, () => theReq.destroy(
            new E.E_REQUEST_TIMEOUT({ 'phase': 'request' })
        ));

        if (hasReqEntity) {

            if (opts.data instanceof Readable) {

                try {

                    await pipeline(opts.data, theReq);
                }
                catch (e) {

                    if (signal && this._isAbortError(opts, e)) {

                        throw this._createAbortError(signal, e);
                    }

                    if (e instanceof E.E_REQUEST_TIMEOUT) {

                        throw e;
                    }

                    throw new E.E_NETWORK_FAILED({}, e);
                }
            }
            else {

                theReq.end(opts.data);
            }

            delete opts.data;
        }
        else {

            theReq.end();
        }

        try {

            return await response;
        }
        catch (e) {

            if (signal && this._isAbortError(opts, e)) {

                throw this._createAbortError(signal, e);
            }

            throw e;
        }
    }
}
