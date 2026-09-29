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
import * as $H2 from 'http2';
import * as $H1 from 'http';
import * as A from './Abstract';
import * as E from '../Errors';
import { addAbortSignal, Readable } from 'stream';
import { pipeline } from 'stream/promises';
import * as Pool from './Http2Pool';
import * as Http2Response from './Http2Response';

export abstract class AbstractHttp2Client extends AbstractProtocolClient {

    private readonly _connections: Record<string, Pool.ISiteConnectionPool>;

    private _connIndex: number = Pool.INITIAL_CONN_ID_COUNTER;

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

        const ret: C.TRequestHeaders = {};

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

    public abstract getAuthorityKey(opts: C.IRequestOptions): string;

    protected async _getConnection(
        opts: C.IRequestOptions,
        h2Opts: $H2.ClientSessionOptions | $H2.SecureClientSessionOptions,
        key: string,
        authority: string
    ): Promise<[string, Pool.IConnection]> {

        const signal = this._getAbortSignal(opts);

        while (true) {

            if (signal?.aborted) {

                throw this._createAbortError(signal);
            }

            const pool = this._connections[key] ??= {
                'connections': {},
                'maximum': opts.maxConnections > 0 ?
                    opts.maxConnections : Pool.MINIMUM_CONNECTION_LIMIT,
                'pending': 0,
                'quantity': 0,
                'waiters': new Set()
            };
            const maximumConcurrency = opts.concurrency > 0 ?
                opts.concurrency : Pool.MINIMUM_CONNECTION_LIMIT;

            for (const connId in pool.connections) {

                const conn = pool.connections[connId];

                if (
                    conn.concurrency < maximumConcurrency &&
                    !conn.connection.closed &&
                    !conn.connection.destroyed
                ) {

                    conn.concurrency++;

                    return [connId, conn];
                }
            }

            if (pool.quantity + pool.pending < pool.maximum) {

                return this._createConnection({
                    authority,
                    'clientOptions': opts,
                    'connectionOptions': h2Opts,
                    key,
                    pool,
                    signal
                });
            }

            await this._waitForConnection(pool, signal);
        }
    }

    private _createConnection(
        opts: Pool.IConnectionCreationOptions
    ): Promise<[string, Pool.IConnection]> {

        opts.pool.pending++;

        return new Promise((resolve, reject) => {

            const session = $H2.connect(
                opts.authority,
                opts.connectionOptions
            );
            let completed = false;
            let onAbort: (() => void) | null = null;

            const cleanup = (): void => {

                if (onAbort) {

                    opts.signal?.removeEventListener('abort', onAbort);
                }
            };

            const rejectConnection = (error: unknown): void => {

                if (completed) {

                    return;
                }

                completed = true;
                cleanup();
                this._completePendingConnection(opts.key, opts.pool);
                session.destroy();
                reject(error);
            };

            onAbort = (): void => {

                rejectConnection(this._createAbortError(opts.signal!));
            };

            opts.signal?.addEventListener('abort', onAbort, { 'once': true });

            session.once('connect', () => {

                if (completed) {

                    return;
                }

                completed = true;
                cleanup();

                const connId = `${this._connIndex++}`;
                const conn: Pool.IConnection = {
                    'concurrency': 1,
                    'connection': session
                };

                opts.pool.quantity++;
                opts.pool.connections[connId] = conn;

                session.on('close', () => {

                    this._removeConnection(opts.key, connId, opts.pool);
                });

                session.removeListener('error', rejectConnection);
                session.on('error', () => {

                    /**
                     * Stream errors are reported to their request promises.
                     * Destroy the failed session while preventing an uncaught event.
                     */
                    session.destroy();
                });

                this._completePendingConnection(opts.key, opts.pool);
                resolve([connId, conn]);

            }).once('error', rejectConnection);
        });
    }

    private _waitForConnection(
        pool: Pool.ISiteConnectionPool,
        signal?: AbortSignal
    ): Promise<void> {

        if (signal?.aborted) {

            return Promise.reject(this._createAbortError(signal));
        }

        return new Promise((resolve, reject) => {

            let completed = false;
            let onAbort: (() => void) | null = null;

            const resume = (): void => {

                if (completed) {

                    return;
                }

                completed = true;

                if (onAbort) {

                    signal?.removeEventListener('abort', onAbort);
                }

                resolve();
            };

            onAbort = (): void => {

                if (completed) {

                    return;
                }

                completed = true;
                pool.waiters.delete(resume);
                reject(this._createAbortError(signal!));
            };

            pool.waiters.add(resume);
            signal?.addEventListener('abort', onAbort, { 'once': true });
        });
    }

    private _completePendingConnection(
        key: string,
        pool: Pool.ISiteConnectionPool
    ): void {

        pool.pending--;
        Pool.wakeConnectionWaiters(pool);
        this._pruneConnectionPool(key, pool);
    }

    private _removeConnection(
        key: string,
        connId: string,
        pool: Pool.ISiteConnectionPool
    ): void {

        if (this._connections[key] !== pool || !pool.connections[connId]) {

            return;
        }

        delete pool.connections[connId];
        pool.quantity--;

        Pool.wakeConnectionWaiters(pool);
        this._pruneConnectionPool(key, pool);
    }

    private _pruneConnectionPool(
        key: string,
        pool: Pool.ISiteConnectionPool
    ): void {

        if (this._connections[key] === pool &&
            !pool.quantity && !pool.pending && !pool.waiters.size) {

            delete this._connections[key];
        }
    }

    private _releaseConnection(
        key: string,
        connId: string,
        conn: Pool.IConnection
    ): void {

        if (conn.concurrency > 0) {

            conn.concurrency--;
        }

        const pool = this._connections[key];

        if (pool?.connections[connId] !== conn) {

            return;
        }

        if (conn.connection.closed || conn.connection.destroyed) {

            this._removeConnection(key, connId, pool);
        }
        else {

            Pool.wakeConnectionWaiters(pool);
        }
    }

    protected abstract _prepareOptions(
        opts: C.IRequestOptions
    ): $H2.SecureClientSessionOptions | $H2.ClientSessionOptions;

    protected async _processRequest(
        opts: C.IRequestOptions,
        key: string = this.getAuthorityKey(opts)
    ): Promise<A.IRequestResult> {

        const signal = this._getAbortSignal(opts);

        if (signal && opts.data instanceof Readable) {

            addAbortSignal(signal, opts.data);
        }

        const headers: $H1.OutgoingHttpHeaders = {
            ...this._preprocessHeaders(opts.headers),
            [$H2.constants.HTTP2_HEADER_METHOD]: opts.method,
            [$H2.constants.HTTP2_HEADER_PATH]: this._.buildPath(opts.url)
        };

        headers[$H2.constants.HTTP2_HEADER_AUTHORITY] =
            this._.getRequestAuthority(opts.url);

        let connectionUrl = opts.url;

        if (opts.connectionOptions.remoteHost) {

            opts.connectionOptions.servername = opts.url.hostname;
            connectionUrl = {
                ...opts.url,
                'hostname': opts.connectionOptions.remoteHost
            };
        }

        const [connId, conn] = await this._getConnection(
            opts,
            this._prepareOptions(opts),
            key,
            this._.getAuthority(connectionUrl)
        );

        let connectionReleased = false;

        const releaseConnection = (): void => {

            if (connectionReleased) {

                return;
            }

            connectionReleased = true;
            this._releaseConnection(key, connId, conn);
        };

        try {

            const REQ_ENTITY = this._.requireEntity(opts.method);

            if (REQ_ENTITY) {

                /**
                 * Here will validate the type of entity.
                 */
                this._preprocessEntity(opts);

                headers[$H2.constants.HTTP2_HEADER_CONTENT_LENGTH] = opts.headers[C.Headers.CONTENT_LENGTH_H1];
            }

            const req = conn.connection.request(headers, {
                ...opts.requestOptions,
                signal
            });

            const response = Http2Response.createResponsePromise({
                'clientOptions': opts,
                'helper': this._,
                releaseConnection,
                'request': req
            });

            /**
             * The request can fail before this method returns the response promise.
             * Observe that rejection immediately while preserving it for the caller.
             */
            void response.catch(() => undefined);

            if (opts.timeout) {

                req.setTimeout(opts.timeout, () => req.destroy(
                    new E.E_REQUEST_TIMEOUT({ 'phase': 'request' })
                ));
            }

            if (REQ_ENTITY) {

                if (opts.data instanceof Readable) {

                    try {

                        await pipeline(opts.data, req);
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
                else if (req.writable) { // if DELETE/GET/HEAD/OPTIONS/TRACE, the writable will be false.

                    req.end(opts.data);
                }
                else {

                    req.end();
                }

                delete opts.data;
            }
            else {

                req.end();
            }

            return await response;
        }
        catch (e) {

            releaseConnection();

            if (signal && this._isAbortError(opts, e)) {

                throw this._createAbortError(signal, e);
            }

            throw e;
        }
    }
}
