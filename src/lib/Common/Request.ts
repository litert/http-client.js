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

import * as B from './Basic';
import { Readable } from 'stream';

export interface IUrl {

    protocol: 'http' | 'https';

    hostname: string;

    pathname: string;

    query?: Record<string, string | number | Array<string | number>>;

    port?: number;
}

export interface IAuthentication {

    type: string;
}

export interface IBasicAuthentication extends IAuthentication {

    type: 'Basic';

    username: string;

    password: string;
}

export interface IBearerAuthentication extends IAuthentication {

    type: 'Bearer';

    credentials: string;
}

export type TRequestHeaders = Record<string, string | number>;

export enum ETLSVersion {

    TLS_V1 = 1,
    TLS_V1_1 = 1.1,
    TLS_V1_2 = 1.2,
    TLS_V1_3 = 1.3
}

export interface IRequestOptions {

    method: B.TMethod;

    url: IUrl;

    headers: TRequestHeaders;

    /**
     * Local interface to bind for network connections when issuing the request.
     */
    localAddress: string;

    /**
     * Specify the authentication mechanism and credentials.
     */
    authentication: IAuthentication;

    /**
     * The minimum version of TLS could be used.
     *
     * If no limitation, set to `false`.
     *
     * @default 1.1
     */
    minTLSVersion: ETLSVersion;

    /**
     * The entity content to be sent to server-side.
     */
    data?: Buffer | string | Readable;

    /**
     * The version of HTTP protocol to be used.
     *
     * Set to `0` to make it detect protocol automatically, while using HTTPS.
     *
     * If use `0` for plain HTTP, then `HTTP/1.1` will be used.
     *
     * @default 2.0 for HTTPS and 1.1 for plain HTTP
     */
    version: B.EVersion;

    /**
     * Enable accepting GZIP compressed data.
     *
     * @default true
     */
    gzip: boolean;

    /**
     * Enable accepting deflate compressed data.
     *
     * @default true
     */
    deflate: boolean;

    /**
     * The maximum number of connections for each site at the same time.
     *
     * @default Infinity
     */
    maxConnections: number;

    /**
     * The maximum number of requests for each site at the same time.
     *
     * For HTTP/1.1, this value will overwrite `maxConnection` due to
     *
     * @default Infinity
     */
    concurrency: number;

    /**
     * Allow reusing connections.
     *
     * @default true
     */
    keepAlive: boolean;

    /**
     * How long could a connection last for keep-alive.
     *
     * @default 30000
     */
    keepAliveTimeout: number;

    /**
     * The CA bundle to be used in the request.
     */
    ca: string | Buffer;

    /**
     * The extra options for requests.
     */
    requestOptions: Record<string, any>;

    /**
     * The extra options for connections.
     */
    connectionOptions: {

        [k: string]: any;

        /**
         * Specify the remote IP/hostname to connect.
         *
         * The hostname/IP in URL will be used as `servername` for TLS authentication and HTTP `Host` header.
         */
        'remoteHost'?: string;
    };

    /**
     * How long, in milliseconds, will timeout while no any action on the connection.
     *
     * @default 30000
     */
    timeout: number;
}

export interface IRequestTimeout {

    connect: number;

    sending: number;

    response: number;

    receiving: number;
}

export interface IRequestOptionsInput extends B.CreateInputOptions<
    IRequestOptions,
    'method',
    Exclude<keyof IRequestOptions, 'method' | 'url'>
> {

    url: string | IUrl;
}

export const DEFAULT_PROTOCOL_DETECTION_CACHE_TTL = 60000;

export const DEFAULT_KEEP_ALIVE_TTL = 60000;

export const DEFAULT_TIMEOUT = 30000;

export const DEFAULT_HTTPS_PORT = 443;

export const DEFAULT_HTTP_PORT = 80;
