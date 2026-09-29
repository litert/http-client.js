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
import * as E from '../Errors';
import type * as $H2 from 'http2';
import type * as A from './Abstract';

const STREAM_CLOSED_BEFORE_RESPONSE = 'stream_closed_before_response';

/**
 * @internal
 */
interface IResponsePromiseOptions {

    clientOptions: C.IRequestOptions;

    helper: A.IHelper;

    releaseConnection(): void;

    request: $H2.ClientHttp2Stream;
}

/**
 * Create a promise for the initial response lifecycle of an HTTP/2 stream.
 *
 * @internal
 */
export function createResponsePromise(
    opts: IResponsePromiseOptions
): Promise<A.IRequestResult> {

    return new Promise((resolve, reject) => {

        let responded = false;
        let onClose: () => void;
        let onError: (error: Error) => void;

        const onResponse = (headers: $H2.IncomingHttpHeaders): void => {

            responded = true;
            opts.request.removeListener('error', onError);
            resolve({
                'protocol': opts.clientOptions.url.protocol === 'https' ?
                    C.EProtocol.HTTPS_2 : C.EProtocol.HTTP_2,
                'gzip': opts.clientOptions.gzip,
                'deflate': opts.clientOptions.deflate,
                'stream': opts.request,
                'headers': headers as C.TResponseHeaders,
                'statusCode': Number(headers[':status']),
                'contentLength': headers['content-length'] === undefined ?
                    Infinity : parseInt(headers['content-length']),
                'noEntity': !opts.helper.hasEntity(opts.clientOptions.method)
            });
        };
        onError = (error: Error): void => {

            opts.request.removeListener('response', onResponse);
            opts.request.removeListener('close', onClose);
            opts.releaseConnection();
            reject(error);
        };
        onClose = (): void => {

            opts.releaseConnection();

            if (!responded) {

                reject(new E.E_NETWORK_FAILED({
                    'reason': STREAM_CLOSED_BEFORE_RESPONSE
                }));
            }
        };

        opts.request.once('response', onResponse);
        opts.request.once('error', onError);
        opts.request.on('close', onClose);
    });
}
