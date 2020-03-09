/**
 * Copyright 2020 Angus.Fenying <fenying@litert.org>
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
import * as $H2 from 'http2';
import * as $H1 from 'http';
import * as A from './Abstract';
import { Readable } from 'stream';

interface IConnection {

    concurrency: number;

    connection: $H2.ClientHttp2Session;
}

interface ISiteConnectionPool {

    maximum: number;

    quantity: number;

    connections: Record<string, IConnection>;
}

export abstract class AbstractHttp2Client extends AbstractProtocolClient {

    private _connections: Record<string, ISiteConnectionPool>;

    private _connIndex: number = 0;

    public constructor(
        protected _: A.IHelper
    ) {

        super();

        this._connections = {};
    }

    public close(): void {

        for (const k in this._connections) {

            const pool = this._connections[k];

            for (const connId in pool.connections) {

                pool.connections[connId].connection.destroy();
            }
        }
    }

    /**
     * Preprocess the headers of request, make all the header-names lowercase, and replace
     * H2 headers into H1 headers.
     */
    protected _preprocessHeaders(headers: C.TRequestHeaders): C.TRequestHeaders {

        let ret: C.TRequestHeaders = {};

        for (const k in headers) {

            const key = k.toLowerCase();

            switch (key) {
            case $H2.constants.HTTP2_HEADER_CONTENT_LENGTH:

                ret[C.Headers.CONTENT_LENGTH_H1] = headers[k];
                break;

            case $H2.constants.HTTP2_HEADER_METHOD:
            case $H2.constants.HTTP2_HEADER_AUTHORITY:

                continue;

            default:

                ret[key] = headers[k];
            }
        }

        return ret;
    }

    protected abstract getAuthorityKey(opts: C.IRequestOptions): string;

    protected async _getConnection(
        opts: C.IRequestOptions,
        h2Opts: $H2.ClientSessionOptions | $H2.SecureClientSessionOptions,
        key: string
    ): Promise<[string, IConnection]> {

        let pool = this._connections[key];

        if (pool) {

            if (pool.quantity) {

                for (let k in pool.connections) {

                    const conn = pool.connections[k];

                    if (conn.concurrency < opts.concurrency && !conn.connection.closed) {

                        conn.concurrency++;

                        return [k, conn];
                    }
                }
            }
        }
        else {

            pool = this._connections[key] = {
                'connections': {},
                'quantity': 0,
                'maximum': opts.maxConnections
            };
        }

        return new Promise((resolve, reject) => {

            let session = $H2.connect(this._.getAuthroity(opts.url), h2Opts);

            session.once('connect', () => {

                const connId = this._connIndex++;

                pool.quantity++;
                pool.connections[connId] = {
                    concurrency: 1,
                    connection: session
                };

                session.on('close', () => {

                    pool.quantity--;

                    delete pool.connections[connId];

                    if (!pool.quantity) {

                        delete this._connections[key];
                    }
                });

                session.removeAllListeners('error');

                resolve([connId as any, pool.connections[connId]]);

            }).once('error', reject);
        });
    }

    private _releaseConnection(key: string, connId: string, conn: IConnection) {

        conn.concurrency--;

        if (conn.connection.closed) {

            const pool = this._connections[key];

            delete pool.connections[connId];

            pool.quantity--;

            if (!pool.quantity) {

                delete this._connections[key];
            }
        }
    }

    protected abstract _prepareOptions(opts: C.IRequestOptions): $H2.SecureClientSessionOptions | $H2.ClientSessionOptions;

    protected async _processRequest(
        opts: C.IRequestOptions,
        key: string = this.getAuthorityKey(opts)
    ): Promise<A.IRequestResult> {

        let [connId, conn] = await this._getConnection(
            opts,
            this._prepareOptions(opts),
            key
        );

        try {

            const headers: $H1.OutgoingHttpHeaders = {
                ...this._preprocessHeaders(opts.headers),
                [$H2.constants.HTTP2_HEADER_METHOD]: opts.method,
                [$H2.constants.HTTP2_HEADER_PATH]: this._.buildPath(opts.url)
            };

            const REQ_ENTITY = this._.requireEntity(opts.method);

            if (REQ_ENTITY) {

                /**
                 * Here will validate the type of entity.
                 */
                this._preprocessEntity(opts);

                headers[$H2.constants.HTTP2_HEADER_CONTENT_LENGTH] = opts.headers[C.Headers.CONTENT_LENGTH_H1];
            }

            const req = conn.connection.request(headers, opts.requestOptions);

            if (REQ_ENTITY) {

                if (opts.data instanceof Readable) {

                    opts.data.pipe(req);
                }
                else {

                    req.end(opts.data);
                }

                delete opts.data;
            }

            if (opts.timeout) {

                req.setTimeout(opts.timeout);
            }

            return new Promise((resolve, reject) => {

                req.on('response', (respHeaders) => {

                    resolve({
                        'gzip': opts.gzip,
                        'deflate': opts.deflate,
                        'stream': req,
                        'headers': respHeaders as any,
                        'statusCode': parseInt(respHeaders[$H2.constants.HTTP2_HEADER_STATUS] as string),
                        'contentLength': respHeaders[$H2.constants.HTTP2_HEADER_CONTENT_LENGTH] === undefined ?
                            Infinity : parseInt(respHeaders[$H2.constants.HTTP2_HEADER_CONTENT_LENGTH] as string)
                    });

                })
                    .once('error', reject)
                    .on('close', () => this._releaseConnection(key, connId, conn));
            });
        }
        catch (e) {

            this._releaseConnection(key, connId, conn);

            throw e;
        }
    }

}