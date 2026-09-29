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

import { Readable } from 'stream';
import * as B from './Basic';

/**
 * The negotiated transport protocol of a response.
 */
export enum EProtocol {

    /** HTTP/1.1 over a plain TCP connection. */
    HTTP_1,

    /** HTTP/1.1 over TLS. */
    HTTPS_1,

    /** HTTP/2 over a plain TCP connection. */
    HTTP_2,

    /** HTTP/2 over TLS. */
    HTTPS_2
}

/**
 * The metadata and single-use entity of a completed response-header exchange.
 *
 * `getBuffer()`, `getStream()`, and `getRawStream()` all access the same
 * response entity. Choose one consumption mode per response. The streaming
 * methods return Readable instances that can emit `error`; consumers must
 * handle that event directly or through an error-aware utility such as
 * `stream.pipeline()`.
 */
export interface IResponse {

    /**
     * The protocol used to receive this response.
     */
    'protocol': EProtocol;

    /**
     * The response headers as reported by Node.js.
     */
    'headers': B.TResponseHeaders;

    /**
     * The HTTP response status code.
     */
    'statusCode': number;

    /**
     * The declared raw response entity length, in bytes.
     *
     * This is parsed from `content-length` before gzip or deflate decoding. It
     * is `Infinity` when the header is absent, and therefore may differ from
     * the number of bytes returned by {@link getBuffer}.
     */
    'contentLength': number;

    /**
     * Stops receiving the response entity and destroys its stream.
     *
     * For HTTP/1.1, this also makes the underlying connection unavailable for
     * reuse. For HTTP/2, the response stream is closed without intentionally
     * closing the shared session.
     *
     * @returns Nothing.
     *
     * @example
     * ```ts
     * import type { IResponse } from '@litert/http-client';
     *
     * function discardEntity(response: IResponse): void {
     *     response.abort();
     * }
     * ```
     */
    abort(): void;

    /**
     * Reads the complete response entity into a decoded Buffer.
     *
     * Gzip and deflate content is decoded when the corresponding request
     * option was enabled. The limit is checked against decoded bytes. HEAD,
     * 204, 304, and responses with a non-positive declared content length
     * resolve with an empty Buffer. A non-positive limit aborts the entity and
     * also resolves with an empty Buffer.
     *
     * @param maxBytes The maximum decoded bytes to retain in memory.
     * @returns The complete decoded response entity.
     * @throws Rejects with `E_TOO_LARGE_RESPONSE_ENTITY` when decoded data
     * exceeds `maxBytes`, or with a transport or decoding error.
     * @default Infinity
     *
     * @example
     * ```ts
     * import type { IResponse } from '@litert/http-client';
     *
     * async function readJson(response: IResponse): Promise<unknown> {
     *     const body = await response.getBuffer(1024 * 1024);
     *     return JSON.parse(body.toString('utf8'));
     * }
     * ```
     */
    getBuffer(maxBytes?: number): Promise<Buffer>;

    /**
     * Returns the response entity stream before gzip or deflate decoding.
     *
     * > [!WARNING]
     * > The returned Readable is single-use and can emit `error`. Consumers
     * > MUST attach an error listener or use `pipeline()` before reading it.
     *
     * @returns The original response entity stream.
     * @throws `E_NO_RESPONSE_ENTITY` for HEAD, 204, or 304 responses, or a
     * previously recorded transport error.
     *
     * @example
     * ```ts
     * import { createWriteStream } from 'node:fs';
     * import { pipeline } from 'node:stream/promises';
     * import type { IResponse } from '@litert/http-client';
     *
     * async function saveRaw(response: IResponse): Promise<void> {
     *     await pipeline(
     *         response.getRawStream(),
     *         createWriteStream('body.gz')
     *     );
     * }
     * ```
     */
    getRawStream(): Readable;

    /**
     * Returns a response entity stream with enabled content decoding applied.
     *
     * Gzip and deflate content is decoded when the corresponding request
     * option was enabled.
     *
     * > [!WARNING]
     * > The returned Readable is single-use and can emit `error`. Consumers
     * > MUST attach an error listener or use `pipeline()` before reading it.
     *
     * @returns The decoded response entity stream.
     * @throws `E_NO_RESPONSE_ENTITY` for HEAD, 204, or 304 responses, or a
     * previously recorded transport error.
     *
     * @example
     * ```ts
     * import { createWriteStream } from 'node:fs';
     * import { pipeline } from 'node:stream/promises';
     * import type { IResponse } from '@litert/http-client';
     *
     * async function saveDecoded(response: IResponse): Promise<void> {
     *     await pipeline(response.getStream(), createWriteStream('body.txt'));
     * }
     * ```
     */
    getStream(): Readable;

    /**
     * Tests whether the status code is between 200 and 299, inclusive.
     *
     * @returns `true` for a successful response; otherwise `false`.
     *
     * @example
     * ```ts
     * import type { IResponse } from '@litert/http-client';
     *
     * function requireSuccess(response: IResponse): void {
     *     if (!response.isSuccess()) {
     *         throw new Error(`Unexpected status: ${response.statusCode}`);
     *     }
     * }
     * ```
     */
    isSuccess(): boolean;

    /**
     * Tests whether the status code is between 300 and 399, inclusive.
     *
     * @returns `true` for a redirection response; otherwise `false`.
     *
     * @example
     * ```ts
     * import type { IResponse } from '@litert/http-client';
     *
     * function redirected(response: IResponse): boolean {
     *     return response.isRedirection();
     * }
     * ```
     */
    isRedirection(): boolean;

    /**
     * Tests whether the status code is between 400 and 499, inclusive.
     *
     * @returns `true` for a client-error response; otherwise `false`.
     *
     * @example
     * ```ts
     * import type { IResponse } from '@litert/http-client';
     *
     * function shouldReviseRequest(response: IResponse): boolean {
     *     return response.isClientError();
     * }
     * ```
     */
    isClientError(): boolean;

    /**
     * Tests whether the status code is between 500 and 599, inclusive.
     *
     * @returns `true` for a server-error response; otherwise `false`.
     *
     * @example
     * ```ts
     * import type { IResponse } from '@litert/http-client';
     *
     * function mayRetry(response: IResponse): boolean {
     *     return response.isServerError();
     * }
     * ```
     */
    isServerError(): boolean;

    /**
     * Tests whether the status code is exactly 100 Continue.
     *
     * @returns `true` only for a 100 response; otherwise `false`.
     *
     * @example
     * ```ts
     * import type { IResponse } from '@litert/http-client';
     *
     * function isInterim(response: IResponse): boolean {
     *     return response.isContinue();
     * }
     * ```
     */
    isContinue(): boolean;

    /**
     * Tests whether the status code is exactly 101 Switching Protocols.
     *
     * @returns `true` only for a 101 response; otherwise `false`.
     *
     * @example
     * ```ts
     * import type { IResponse } from '@litert/http-client';
     *
     * function switchedProtocols(response: IResponse): boolean {
     *     return response.isUpgrade();
     * }
     * ```
     */
    isUpgrade(): boolean;
}
