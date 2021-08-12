/**
 * Copyright 2021 Angus.Fenying <fenying@litert.org>
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

import * as $TLS from 'tls';
import * as C from '../Common';
import { Readable } from 'stream';

export interface IRequestResult {

    protocol: C.EProtocol;

    headers: C.TResponseHeaders;

    contentLength: number;

    statusCode: number;

    stream: Readable;

    /**
     * Tell if GZIP encoding is acceptable.
     */
    gzip: boolean;

    /**
     * Tell if deflate encoding is acceptable.
     */
    deflate: boolean;

    /**
     * Tell if the response has a entity.
     */
    noEntity: boolean;
}

export interface IProtocolClient {

    close(): void;

    request(
        opts: C.IRequestOptions,
        tlsSocket?: $TLS.TLSSocket,
        key?: string
    ): Promise<IRequestResult>;

    getAuthorityKey(opts: C.IRequestOptions): string;
}

export interface IHelper {

    requireEntity(method: C.TMethod): boolean;

    hasEntity(method: C.TMethod): boolean;

    buildPath(url: C.IUrl): string;

    getAuthroity(url: C.IUrl): string;
}
