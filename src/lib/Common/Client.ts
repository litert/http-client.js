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

import * as Req from './Request';
import * as Resp from './Response';
import type * as Filters from '../Filters';

/**
 * Defines the ordered request-filter stages exposed by {@link IClient.filters}.
 *
 * `pre_args` runs first on a clone of the caller's input, before URL parsing
 * and defaults are applied. `pre_request` runs after normalization, but before
 * header names are lowercased, compression headers are added, and the request
 * is sent. Callbacks registered on the client's asynchronous filter manager
 * may return either a value or a promise-like value.
 *
 * Filters at the same stage run from the lowest numeric priority to the
 * highest, and each callback receives the preceding callback's result.
 *
 * @example
 * ```ts
 * import { createHttpClient } from '@litert/http-client';
 *
 * const client = createHttpClient();
 *
 * client.filters.register({
 *     name: 'pre_args',
 *     key: 'request-source',
 *     priority: -10,
 *     callback: async (options) => ({
 *         ...options,
 *         headers: {
 *             ...options.headers,
 *             'x-request-source': 'example',
 *         },
 *     }),
 * });
 *
 * client.close();
 * ```
 */
export interface IFilters {

    /**
     * Transforms complete, normalized request options immediately before
     * transport-specific processing.
     *
     * @param opts The normalized options produced from the `pre_args` result.
     * @returns The options passed to the next callback or to the transport.
     */
    ['pre_request']: (opts: Req.IRequestOptions) => Req.IRequestOptions;

    /**
     * Transforms request input before URL normalization and default values are
     * applied.
     *
     * @param opts A clone of the options passed to {@link IClient.request}.
     * @returns The input passed to the next callback or to normalization.
     */
    ['pre_args']: (opts: Req.IRequestOptionsInput) => Req.IRequestOptionsInput;
}

/**
 * A synchronous string-keyed cache used by the HTTP client.
 *
 * The client uses this cache to remember successful HTTPS protocol detection.
 * Implementations must make writes and removals visible synchronously. The
 * built-in cache returns `null` for missing and expired entries.
 *
 * @example
 * ```ts
 * import {
 *     createHttpClient,
 *     type IKeyValueCache,
 * } from '@litert/http-client';
 *
 * const values = new Map<string, unknown>();
 * const cache: IKeyValueCache = {
 *     set: (key, value) => { values.set(key, value); },
 *     get: (key) => values.get(key) ?? null,
 *     remove: (key) => { values.delete(key); },
 * };
 *
 * const client = createHttpClient({ kvCache: cache });
 * client.close();
 * ```
 */
export interface IKeyValueCache {

    /**
     * Stores or replaces a value for a key.
     *
     * @param key The cache key.
     * @param value The value to store.
     * @returns Nothing.
     *
     * @example
     * ```ts
     * import { createSimpleKVSCache } from '@litert/http-client';
     *
     * const cache = createSimpleKVSCache(60_000);
     * cache.set('https://example.com', 'h2');
     * ```
     */
    set(key: string, value: any): void;

    /**
     * Reads the current value for a key.
     *
     * @param key The cache key.
     * @returns The cached value, or the implementation's missing-value
     * sentinel when the key is absent or expired.
     *
     * @example
     * ```ts
     * import { createSimpleKVSCache } from '@litert/http-client';
     *
     * const cache = createSimpleKVSCache(60_000);
     * cache.set('https://example.com', 'h2');
     * const protocol = cache.get('https://example.com');
     *
     * console.log(protocol);
     * ```
     */
    get(key: string): any;

    /**
     * Removes the value stored for a key, if present.
     *
     * @param key The cache key.
     * @returns Nothing.
     *
     * @example
     * ```ts
     * import { createSimpleKVSCache } from '@litert/http-client';
     *
     * const cache = createSimpleKVSCache(60_000);
     * cache.set('https://example.com', 'h2');
     * cache.remove('https://example.com');
     * ```
     */
    remove(key: string): void;
}

/**
 * A reusable client for HTTP/1.1, HTTPS, and HTTP/2 requests.
 *
 * The client owns connection pools and a request-filter pipeline. Call
 * {@link IClient.close} when the client is no longer needed so keep-alive
 * connections are closed.
 */
export interface IClient {

    /**
     * The asynchronous request-filter manager owned by this client.
     *
     * Registered callbacks can return request options directly or through a
     * promise-like value.
     *
     * @default A new filter manager with no registered callbacks.
     */
    readonly filters: Filters.IFilterManager<IFilters, true>;

    /**
     * Starts an HTTP request and resolves when the response is available.
     *
     * The response entity remains unread; consume it through the returned
     * response object or abort the response when its body is not needed.
     *
     * @param opts The options for the request.
     * @returns A promise that resolves to the response metadata and entity
     * accessors.
     * @throws The promise rejects with `E_INVALID_URL` when a string URL
     * cannot be parsed.
     * @throws The promise rejects with `E_PROTOCOL_NOT_SUPPORTED` when the URL
     * or requested protocol is unsupported.
     * @throws The promise rejects with `E_UNKNOWN_AUTH_TYPE` when
     * authentication remains unhandled and no `authorization` header was
     * produced.
     * @throws The promise rejects with filter, cancellation, TLS, or network
     * errors encountered while starting the request.
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
     *         url: 'https://example.com/',
     *     });
     *     const body = await response.getBuffer();
     *
     *     console.log(response.statusCode, body.toString('utf8'));
     * }
     * finally {
     *     client.close();
     * }
     * ```
     */
    request(opts: Req.IRequestOptionsInput): Promise<Resp.IResponse>;

    /**
     * Closes the client's HTTP/1.1 and HTTP/2 connection pools.
     *
     * Use this during application shutdown or after a short-lived client has
     * completed its requests.
     *
     * @returns Nothing.
     *
     * @example
     * ```ts
     * import { createHttpClient } from '@litert/http-client';
     *
     * const client = createHttpClient();
     *
     * try {
     *     const response = await client.request({
     *         method: 'HEAD',
     *         url: 'https://example.com/',
     *     });
     *
     *     console.log(response.statusCode);
     * }
     * finally {
     *     client.close();
     * }
     * ```
     */
    close(): void;
}

/**
 * Replaceable dependencies used to construct an {@link IClient}.
 *
 * `createHttpClient` accepts a partial form of this interface, so either
 * dependency may be omitted independently.
 *
 * @example
 * ```ts
 * import {
 *     createHttpClient,
 *     createSimpleKVSCache,
 * } from '@litert/http-client';
 *
 * const client = createHttpClient({
 *     kvCache: createSimpleKVSCache(5 * 60_000),
 * });
 *
 * client.close();
 * ```
 */
export interface IClientOptions {

    /**
     * The asynchronous manager that executes the two {@link IFilters} stages.
     *
     * @default A new filter manager with no registered callbacks.
     */
    filters: Filters.IFilterManager<IFilters, true>;

    /**
     * The cache used to remember successful HTTPS protocol detection.
     *
     * @default `createSimpleKVSCache(60_000)`, using
     * `DEFAULT_PROTOCOL_DETECTION_CACHE_TTL` as its TTL.
     */
    kvCache: IKeyValueCache;
}
