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
import type * as Filters from '../Filters';

/**
 * Create a request preprocessor for HTTP Bearer Authentication.
 *
 * Register the returned callback on a client's `pre_request` filter. For a
 * request whose authentication type is `Bearer` (case-insensitive), the
 * callback sets the credential on the `authorization` header. Requests using
 * another authentication type pass through unchanged.
 *
 * Treat bearer credentials as secrets and send them only over HTTPS.
 *
 * @returns An asynchronous `pre_request` filter callback.
 * @throws The returned callback rejects with `E_EMPTY_AUTH_CREDENTIALS` when
 * a matching request has an empty bearer credential.
 *
 * @example
 * ```ts
 * import {
 *     createBearerPreprocessor,
 *     createHttpClient,
 *     type IBearerAuthentication
 * } from '@litert/http-client';
 *
 * const client = createHttpClient();
 * const authentication: IBearerAuthentication = {
 *     type: 'Bearer',
 *     credentials: 'example-token'
 * };
 *
 * client.filters.register({
 *     name: 'pre_request',
 *     key: 'bearer-authentication',
 *     callback: createBearerPreprocessor()
 * });
 *
 * try {
 *     const response = await client.request({
 *         method: 'GET',
 *         url: 'https://api.example.com/profile',
 *         authentication
 *     });
 *     response.abort();
 * }
 * finally {
 *     client.close();
 * }
 * ```
 */
export function createBearerPreprocessor(): Filters.IAsyncFilterCallback<C.IFilters['pre_request']> {

    // eslint-disable-next-line @typescript-eslint/require-await
    return async (opts: C.IRequestOptions): Promise<C.IRequestOptions> => {

        const auth = opts.authentication as C.IBearerAuthentication;

        if (auth?.type.toLowerCase() === 'bearer') {

            if (!auth.credentials) {

                throw new E.E_EMPTY_AUTH_CREDENTIALS();
            }

            opts.headers['authorization'] = `Bearer ${auth.credentials}`;
        }

        return opts;
    };
}
