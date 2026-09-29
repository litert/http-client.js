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

import type * as C from '../Common';
import type * as $H2 from 'http2';

export const INITIAL_CONN_ID_COUNTER = 0;
export const MINIMUM_CONNECTION_LIMIT = 1;

/**
 * @internal
 */
export interface IConnection {

    concurrency: number;

    connection: $H2.ClientHttp2Session;
}

/**
 * @internal
 */
export interface ISiteConnectionPool {

    maximum: number;

    pending: number;

    quantity: number;

    connections: Record<string, IConnection>;

    waiters: Set<() => void>;
}

/**
 * @internal
 */
export interface IConnectionCreationOptions {

    authority: string;

    clientOptions: C.IRequestOptions;

    connectionOptions: $H2.ClientSessionOptions | $H2.SecureClientSessionOptions;

    key: string;

    pool: ISiteConnectionPool;

    signal?: AbortSignal;
}

/**
 * Wake every request waiting for available pool capacity.
 *
 * @internal
 */
export function wakeConnectionWaiters(pool: ISiteConnectionPool): void {

    const waiters = [...pool.waiters];

    pool.waiters.clear();

    for (const resume of waiters) {

        resume();
    }
}
