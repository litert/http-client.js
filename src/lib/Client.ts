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

import * as C from './Common';
import * as $TLS from 'tls';
import * as E from './Errors';
import * as Filters from './Filters';
import { createSimpleKVSCache } from './SimpleKVSCache';
import * as I from './Internal';
import { HttpHelper } from './Internal/Helper';

interface ILocalTLSConnectionOptions extends $TLS.ConnectionOptions {

    localAddress?: string;
}

class HttpClient implements C.IClient {

    private readonly _clients: Record<'h1' | 'h1s' | 'h2' | 'h2s', I.IProtocolClient>;

    public readonly filters: Filters.IFilterManager<C.IFilters, true>;

    private readonly _kvCache: C.IKeyValueCache;

    private readonly _: I.IHelper;

    public constructor(opts?: Partial<C.IClientOptions>) {

        this.filters = opts?.filters ?? Filters.createAsyncFilterManager<C.IFilters>();

        this._kvCache = opts?.kvCache ?? createSimpleKVSCache(C.DEFAULT_PROTOCOL_DETECTION_CACHE_TTL);

        this._ = new HttpHelper();

        this._clients = {
            h2s: new I.H2SClient(this._),
            h2: new I.H2Client(this._),
            h1s: new I.H1SClient(this._),
            h1: new I.H1Client(this._)
        };
    }

    public close(): void {

        this._clients.h1.close();
        this._clients.h1s.close();
        this._clients.h2.close();
        this._clients.h2s.close();
    }

    public async request(optsIn: C.IRequestOptionsInput): Promise<C.IResponse> {

        optsIn = await this.filters.filter(
            'pre_args',
            this._cloneRequestInput(optsIn)
        );
        optsIn = this._cloneRequestInput(optsIn);

        const url = this._normalizeUrl(optsIn.url);

        // eslint-disable-next-line @typescript-eslint/naming-convention
        function _default<T, K extends keyof T>(
            obj: Partial<T>,
            key: K,
            defaultValue: T[K]
        ): T[K] {

            return obj[key] ?? defaultValue;
        }

        let opts: C.IRequestOptions = {

            'method': optsIn.method,
            url,
            'headers': { ..._default(optsIn, 'headers', {}) },
            'authentication': {
                ..._default(optsIn, 'authentication', { type: 'none' })
            },
            'minTLSVersion': _default(optsIn, 'minTLSVersion', C.ETlsVersion.TLS_V1),
            'data': _default(optsIn, 'data', ''),
            'signal': optsIn.signal ?? optsIn.requestOptions?.['signal'],
            'localAddress': _default(optsIn, 'localAddress', ''),
            'timeout': _default(optsIn, 'timeout', C.DEFAULT_TIMEOUT),
            'keepAlive': _default(optsIn, 'keepAlive', true),
            'keepAliveTimeout': _default(optsIn, 'keepAliveTimeout', C.DEFAULT_KEEP_ALIVE_TTL),
            'version': _default(optsIn, 'version', C.EVersion.HTTP_1_1),
            'maxConnections': _default(optsIn, 'maxConnections', Infinity),
            'concurrency': _default(optsIn, 'concurrency', Infinity),
            'ca': _default(optsIn, 'ca', ''),
            'gzip': _default(optsIn, 'gzip', true),
            'deflate': _default(optsIn, 'deflate', true),
            'requestOptions': { ..._default(optsIn, 'requestOptions', {}) },
            'connectionOptions': {
                ..._default(optsIn, 'connectionOptions', {})
            },
        };

        opts = await this.filters.filter('pre_request', opts);

        const headers: C.TRequestHeaders = {};

        for (const k in opts.headers) {

            headers[k.toLowerCase()] = opts.headers[k];
        }

        opts.headers = headers;

        if (opts.gzip && opts.deflate) {

            opts.headers['accept-encoding'] = 'gzip, deflate';
        }
        else if (opts.gzip) {

            opts.headers['accept-encoding'] = 'gzip';
        }
        else if (opts.deflate) {

            opts.headers['accept-encoding'] = 'deflate';
        }

        /**
         * Check if the authentication plugin is not loaded.
         */
        if (opts.authentication.type !== 'none' && !opts.headers.authorization) {

            throw new E.E_UNKNOWN_AUTH_TYPE();
        }

        return this._request(opts);
    }

    private _cloneRequestInput(
        opts: C.IRequestOptionsInput
    ): C.IRequestOptionsInput {

        const url = typeof opts.url === 'string' ? opts.url :
            this._cloneUrl(opts.url);

        return {
            ...opts,
            url,
            'headers': opts.headers ? { ...opts.headers } : undefined,
            'authentication': opts.authentication ? {
                ...opts.authentication
            } : undefined,
            'requestOptions': opts.requestOptions ? {
                ...opts.requestOptions
            } : undefined,
            'connectionOptions': opts.connectionOptions ? {
                ...opts.connectionOptions
            } : undefined
        };
    }

    private _cloneQuery(query: NonNullable<C.IUrl['query']>): C.IUrl['query'] {

        const cloned: NonNullable<C.IUrl['query']> = {};

        for (const key in query) {

            const value = query[key];

            cloned[key] = Array.isArray(value) ? [...value] : value;
        }

        return cloned;
    }

    private _cloneUrl(url: C.IUrl): C.IUrl {

        const cloned = { ...url };

        if (url.query) {

            cloned.query = this._cloneQuery(url.query);
        }

        return cloned;
    }

    private _normalizeUrl(input: string | C.IUrl): C.IUrl {

        if (typeof input !== 'string') {

            if (input.protocol !== 'http' && input.protocol !== 'https') {

                throw new E.E_PROTOCOL_NOT_SUPPORTED();
            }

            const url = this._cloneUrl(input);

            url.pathname ||= '/';
            url.port ??= this._getDefaultPort(input.protocol);

            return url;
        }

        let parsed: URL;

        try {

            parsed = new URL(input);
        }
        catch (error) {

            throw new E.E_INVALID_URL({}, error);
        }

        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {

            throw new E.E_PROTOCOL_NOT_SUPPORTED();
        }

        const protocol = parsed.protocol === 'https:' ? 'https' : 'http';
        const query: NonNullable<C.IUrl['query']> = {};

        for (const [key, value] of parsed.searchParams) {

            const existing = query[key];

            if (existing === undefined) {

                query[key] = value;
            }
            else if (Array.isArray(existing)) {

                existing.push(value);
            }
            else {

                query[key] = [existing, value];
            }
        }

        const port = parsed.port ? Number(parsed.port) :
            this._getDefaultPort(protocol);

        return {
            protocol,
            'hostname': parsed.hostname,
            'pathname': parsed.pathname || '/',
            'query': Object.keys(query).length ? query : undefined,
            port
        };
    }

    private _getDefaultPort(protocol: C.IUrl['protocol']): number {

        return protocol === 'https' ? C.DEFAULT_HTTPS_PORT :
            C.DEFAULT_HTTP_PORT;
    }

    private _request(opts: C.IRequestOptions): Promise<C.IResponse> {

        if (opts.url.protocol === 'https') {

            /**
             * When version is set to `0`, detect the protocol supported by server automatically.
             */
            if (opts.version === C.EVersion.ALPN) {

                for (const k of ['h1s', 'h2s'] as const) {

                    const key = this._clients[k].getAuthorityKey(opts);

                    if (this._kvCache.get(key) === k) {

                        return this._wrapResponse(
                            this._clients[k].request(opts, undefined, key)
                        );
                    }
                }

                return this._autoDetectProtocol(opts);
            }
            else {

                switch (opts.version) {
                    case C.EVersion.HTTP_2:
                        return this._wrapResponse(this._clients.h2s.request(opts));
                    case C.EVersion.HTTP_1_1:
                        return this._wrapResponse(this._clients.h1s.request(opts));
                    default:
                        throw new E.E_PROTOCOL_NOT_SUPPORTED();
                }
            }
        }
        else {

            switch (opts.version) {
                case C.EVersion.HTTP_2:
                    return this._wrapResponse(this._clients.h2.request(opts));
                case C.EVersion.ALPN:
                case C.EVersion.HTTP_1_1:
                    return this._wrapResponse(this._clients.h1.request(opts));
                default:
                    throw new E.E_PROTOCOL_NOT_SUPPORTED();
            }
        }
    }

    protected async _autoDetectProtocol(opts: C.IRequestOptions): Promise<C.IResponse> {

        const tlsOpts: ILocalTLSConnectionOptions = {
            host: opts.connectionOptions.remoteHost ?? opts.url.hostname,
            port: opts.url.port,
            servername: opts.url.hostname,
            minVersion: `TLSv${opts.minTLSVersion}` as $TLS.SecureVersion,
            ALPNProtocols: ['h2', 'http/1.1']
        };

        if (opts.localAddress) {

            tlsOpts.localAddress = opts.localAddress;
        }

        if (opts.ca) {

            tlsOpts.ca = opts.ca;
        }

        if (opts.connectionOptions.remoteHost) {

            tlsOpts.servername = opts.url.hostname;
        }

        return new Promise((resolve, reject) => {

            let completed = false;
            let conn: $TLS.TLSSocket;
            let onAbort: () => void;
            let onError: (error: Error) => void;

            const cleanup = (): void => {

                conn.removeListener('error', onError);
                opts.signal?.removeEventListener('abort', onAbort);
            };
            onError = (error: Error): void => {

                if (completed) {

                    return;
                }

                completed = true;
                cleanup();
                reject(error);
            };
            onAbort = (): void => {

                if (completed) {

                    return;
                }

                completed = true;
                cleanup();
                conn.destroy();
                reject(new E.E_ABORTED({}, opts.signal?.reason));
            };

            conn = $TLS.connect({
                ...tlsOpts,
                ...opts.connectionOptions
            }, () => {

                if (completed) {

                    conn.destroy();
                    return;
                }

                completed = true;
                cleanup();

                switch (conn.alpnProtocol) {
                    case false:
                    case 'http/1.1': {

                        const key: string = this._clients.h1s.getAuthorityKey(opts);

                        this._kvCache.set(key, 'h1s');

                        resolve(this._wrapResponse(this._clients.h1s.request(
                            opts,
                            conn,
                            key
                        )));
                        break;
                    }
                    case 'h2':{

                        const key: string = this._clients.h2s.getAuthorityKey(opts);

                        this._kvCache.set(key, 'h2s');

                        resolve(this._wrapResponse(this._clients.h2s.request(
                            opts,
                            conn,
                            key
                        )));
                        break;
                    }
                    default:
                        conn.destroy();
                        reject(new E.E_PROTOCOL_NOT_SUPPORTED());
                }
            });

            conn.once('error', onError);
            opts.signal?.addEventListener('abort', onAbort, { 'once': true });

            if (opts.signal?.aborted) {

                onAbort();
            }
        });
    }

    private async _wrapResponse(pResult: Promise<I.IRequestResult>): Promise<C.IResponse> {

        const result = await pResult;

        return new I.HttpClientResponse(
            result.protocol,
            result.stream,
            result.contentLength,
            result.headers,
            result.statusCode,
            result.gzip,
            result.deflate,
            result.noEntity
        );
    }
}

/**
 * Create an HTTP client that supports HTTP/1.1, HTTPS, and HTTP/2 requests.
 *
 * Each call creates an independent client. When an option is omitted, the
 * client creates its own asynchronous filter manager and a protocol-detection
 * cache with a 60-second lifetime. Call `client.close()` when the client is no
 * longer needed to release its keep-alive connections.
 *
 * Library-defined request failures reject with an exported
 * `AbstractHttpClientError` subclass. Native transport errors can also
 * propagate when no library-specific error applies.
 *
 * @param opts Optional client collaborators.
 * @returns A new HTTP client.
 * @default {}
 *
 * @example
 * ```ts
 * import { createHttpClient } from '@litert/http-client';
 *
 * const client = createHttpClient();
 *
 * try {
 *     const response = await client.request({
 *         method: 'GET',
 *         url: 'https://example.com/'
 *     });
 *     console.log(response.statusCode, await response.getBuffer());
 * }
 * finally {
 *     client.close();
 * }
 * ```
 */
export function createHttpClient(opts?: Partial<C.IClientOptions>): C.IClient {

    return new HttpClient(opts);
}
