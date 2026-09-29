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

import * as B from './Basic';
import { Readable } from 'stream';

/**
 * A structured HTTP or HTTPS URL accepted by the client.
 *
 * The `pre_args` filter receives a clone before normalization. The client then
 * normalizes the URL before `pre_request` filters and protocol dispatch.
 * Missing ports and empty paths are replaced with protocol-specific defaults.
 */
export interface IUrl {

    /**
     * The application protocol used for the request.
     */
    protocol: 'http' | 'https';

    /**
     * The logical server hostname used in the request authority and, for
     * HTTPS, in TLS SNI and certificate verification.
     */
    hostname: string;

    /**
     * The URL path, beginning with `/`.
     *
     * An empty value is normalized to `/`.
     *
     * @default '/'
     */
    pathname: string;

    /**
     * Query parameters appended to the path.
     *
     * Array values produce repeated parameters. When a string URL contains a
     * parameter more than once, normalization stores its values in an array.
     *
     * @default undefined
     */
    query?: Record<string, string | number | Array<string | number>>;

    /**
     * The remote TCP port.
     *
     * @default 80 for HTTP and 443 for HTTPS
     */
    port?: number;
}

/**
 * The discriminator shared by request authentication configurations.
 *
 * Authentication preprocessors use `type` to recognize and apply a
 * scheme before the request is dispatched.
 */
export interface IAuthentication {

    /**
     * The authentication scheme name understood by a registered preprocessor.
     */
    type: string;
}

/**
 * Credentials consumed by the Basic authentication preprocessor.
 */
export interface IBasicAuthentication extends IAuthentication {

    /**
     * Selects HTTP Basic authentication.
     */
    type: 'Basic';

    /**
     * The user name included in the Basic credentials.
     */
    username: string;

    /**
     * The password included in the Basic credentials.
     */
    password: string;
}

/**
 * Credentials consumed by the Bearer authentication preprocessor.
 */
export interface IBearerAuthentication extends IAuthentication {

    /**
     * Selects HTTP Bearer authentication.
     */
    type: 'Bearer';

    /**
     * The bearer token sent in the `Authorization` header.
     */
    credentials: string;
}

/**
 * Outgoing request headers keyed by header name.
 *
 * Header names are converted to lowercase after pre-request filters run.
 */
export type TRequestHeaders = Record<string, string | number>;

/**
 * Minimum TLS protocol versions supported by secure requests.
 */
export enum ETlsVersion {

    /** Allow TLS 1.0 or a later version. */
    TLS_V1 = 1,

    /** Allow TLS 1.1 or a later version. */
    TLS_V1_1 = 1.1,

    /** Allow TLS 1.2 or a later version. */
    TLS_V1_2 = 1.2,

    /** Require TLS 1.3 or a later version. */
    TLS_V1_3 = 1.3
}

/**
 * Fully normalized options used by request filters and protocol clients.
 *
 * Applications normally provide {@link IRequestOptionsInput} to
 * `IClient.request()`. The client clones that input, supplies the defaults
 * documented below, then passes this shape to pre-request filters.
 */
export interface IRequestOptions {

    /** The HTTP or WebDAV request method. */
    method: B.TMethod;

    /** The cloned, normalized request URL. */
    url: IUrl;

    /**
     * Headers to send with the request.
     *
     * After pre-request filters run, names are lowercased and the client sets
     * `accept-encoding` according to {@link gzip} and {@link deflate}.
     *
     * @default {}
     */
    headers: TRequestHeaders;

    /**
     * Local interface to bind for network connections when issuing the request.
     * An empty string leaves interface selection to Node.js.
     *
     * @default ''
     */
    localAddress: string;

    /**
     * The authentication mechanism and its credentials.
     *
     * A non-`none` value requires a matching pre-request authentication
     * preprocessor unless the request already has an authorization header.
     *
     * @default { type: 'none' }
     */
    authentication: IAuthentication;

    /**
     * The minimum TLS version accepted for HTTPS connections.
     *
     * @default ETlsVersion.TLS_V1
     */
    minTLSVersion: ETlsVersion;

    /**
     * The request entity sent for methods that require one.
     *
     * String and Buffer lengths are calculated automatically. A Readable
     * entity requires a `content-length` header. GET, HEAD, OPTIONS, and TRACE
     * requests do not send this value.
     *
     * @default ''
     */
    data?: Buffer | string | Readable;

    /**
     * A signal that aborts the request and any pending connection acquisition.
     *
     * When omitted, `requestOptions.signal` is used if present.
     *
     * @default undefined
     */
    signal?: AbortSignal;

    /**
     * The version of HTTP protocol to be used.
     *
     * Set to `EVersion.ALPN` to detect the protocol automatically for HTTPS.
     *
     * ALPN mode falls back to HTTP/1.1 for plain HTTP.
     *
     * @default EVersion.HTTP_1_1
     */
    version: B.EVersion;

    /**
     * Whether to advertise and decode gzip response content.
     *
     * @default true
     */
    gzip: boolean;

    /**
     * Whether to advertise and decode deflate response content.
     *
     * @default true
     */
    deflate: boolean;

    /**
     * The maximum number of connections per origin.
     *
     * For HTTP/2 this limits pooled sessions. For HTTP/1.1 it is used as the
     * agent socket limit only when {@link concurrency} is `Infinity`.
     * Non-positive limits are treated as `1`.
     *
     * @default Infinity
     */
    maxConnections: number;

    /**
     * The request concurrency limit for each origin.
     *
     * For HTTP/2 this limits active streams on each session. For HTTP/1.1 a
     * finite value becomes the agent socket limit and takes precedence over
     * {@link maxConnections}. Non-positive limits are treated as `1`.
     *
     * @default Infinity
     */
    concurrency: number;

    /**
     * Whether HTTP/1.1 agents should reuse connections.
     *
     * HTTP/2 session pooling is managed independently of this option.
     *
     * @default true
     */
    keepAlive: boolean;

    /**
     * The initial delay for HTTP/1.1 TCP keep-alive probes, in milliseconds.
     *
     * This value is passed to Node.js as `keepAliveMsecs`; it does not control
     * the lifetime of HTTP/2 sessions.
     *
     * @default 60000
     */
    keepAliveTimeout: number;

    /**
     * The CA certificate or bundle used to verify HTTPS peers.
     *
     * An empty string uses Node.js default trust configuration.
     *
     * @default ''
     */
    ca: string | Buffer;

    /**
     * Additional native options applied when creating the protocol request.
     *
     * @default {}
     */
    requestOptions: Record<string, any>;

    /**
     * Additional native options applied when creating connections or sessions.
     *
     * @default {}
     */
    connectionOptions: {

        /** A protocol-specific native connection option. */
        [k: string]: any;

        /**
         * An alternate IP address or hostname to connect to.
         *
         * The URL hostname remains the TLS server name and HTTP Host or
         * `:authority` value, allowing a request to connect to a selected
         * endpoint without changing its logical origin.
         *
         * @default undefined
         */
        'remoteHost'?: string;
    };

    /**
     * The allowed period of transport inactivity, in milliseconds.
     *
     * This is not a total request deadline and does not bound time spent
     * waiting for pooled capacity. Use {@link signal} for a hard deadline. A
     * value of `0` disables the inactivity timeout.
     *
     * @default 30000
     */
    timeout: number;
}

/**
 * Phase-specific timeout durations, in milliseconds.
 *
 * This exported shape is not currently consumed by `IClient.request()`.
 * Configure {@link IRequestOptions.timeout} for transport inactivity and use
 * an AbortSignal when a total deadline is required.
 */
export interface IRequestTimeout {

    /** The intended connection-establishment timeout. */
    connect: number;

    /** The intended request-entity transmission timeout. */
    sending: number;

    /** The intended wait-for-response-headers timeout. */
    response: number;

    /** The intended response-entity reception timeout. */
    receiving: number;
}

/**
 * Consumer input for `IClient.request()`.
 *
 * `method` and `url` are required; all other request options are optional and
 * receive the defaults documented by {@link IRequestOptions}. The input and
 * its nested URL, headers, authentication, query arrays, and native option
 * objects are cloned before filters run.
 *
 * @example
 * ```ts
 * import {
 *     EVersion,
 *     type IRequestOptionsInput
 * } from '@litert/http-client';
 *
 * const options: IRequestOptionsInput = {
 *     method: 'GET',
 *     url: 'https://example.com/items?page=1',
 *     version: EVersion.ALPN
 * };
 * ```
 */
export interface IRequestOptionsInput extends B.CreateInputOptions<
    IRequestOptions,
    'method',
    Exclude<keyof IRequestOptions, 'method' | 'url'>
> {

    /**
     * An absolute HTTP(S) URL or a structured URL value.
     *
     * String URLs are parsed with the WHATWG URL parser. Structured URLs are
     * cloned and normalized without mutating the caller's object.
     */
    url: string | IUrl;
}

/** Default lifetime, in milliseconds, of cached HTTPS ALPN results. */
export const DEFAULT_PROTOCOL_DETECTION_CACHE_TTL = 60000;

/**
 * Default initial delay for HTTP/1.1 TCP keep-alive probes, in milliseconds.
 */
export const DEFAULT_KEEP_ALIVE_TTL = 60000;

/** Default transport inactivity timeout, in milliseconds. */
export const DEFAULT_TIMEOUT = 30000;

/** Default HTTPS port used when a URL does not specify one. */
export const DEFAULT_HTTPS_PORT = 443;

/** Default HTTP port used when a URL does not specify one. */
export const DEFAULT_HTTP_PORT = 80;
