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
 * Create a request preprocessor for HTTP Basic Authentication.
 *
 * Register the returned callback on a client's `pre_request` filter. For a
 * request whose authentication type is `Basic` (case-insensitive), the
 * callback encodes the username and password and sets the `authorization`
 * header. Requests using another authentication type pass through unchanged.
 *
 * Basic credentials are only encoded, not encrypted. Send them only over
 * HTTPS.
 *
 * @returns An asynchronous `pre_request` filter callback.
 * @throws The returned callback rejects with `E_EMPTY_AUTH_CREDENTIALS` when
 * a matching request has an empty username.
 *
 * @example
 * ```ts
 * import {
 *     createBasicPreprocessor,
 *     createHttpClient,
 *     type IBasicAuthentication
 * } from '@litert/http-client';
 *
 * const client = createHttpClient();
 * const authentication: IBasicAuthentication = {
 *     type: 'Basic',
 *     username: 'api-user',
 *     password: 'example-password'
 * };
 *
 * client.filters.register({
 *     name: 'pre_request',
 *     key: 'basic-authentication',
 *     callback: createBasicPreprocessor()
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
export function createBasicPreprocessor(): Filters.IAsyncFilterCallback<C.IFilters['pre_request']> {

    // eslint-disable-next-line @typescript-eslint/require-await
    return async (opts: C.IRequestOptions): Promise<C.IRequestOptions> => {

        const auth = opts.authentication as C.IBasicAuthentication;

        if (auth?.type.toLowerCase() === 'basic') {

            if (!auth.username) {

                throw new E.E_EMPTY_AUTH_CREDENTIALS();
            }

            opts.headers['authorization'] = `Basic ${
                Buffer.from(`${auth.username}:${auth.password}`).toString('base64')
            }`;
        }

        return opts;
    };
}
