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

import * as C from '../Common';
import * as E from '../Errors';

export function createBasicPreprocessor(): C.IFilterPrerequest['callback'] {

    return async (opts: C.IRequestOptions): Promise<C.IRequestOptions> => {

        const auth = opts.authentication as C.IBasicAuthentication;

        if (auth && auth.type.toLowerCase() === 'basic') {

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
