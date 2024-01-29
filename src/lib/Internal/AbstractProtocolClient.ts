/**
 * Copyright 2024 Angus.Fenying <fenying@litert.org>
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

export abstract class AbstractProtocolClient {

    /**
     * Validate the type of request entity and calculate the length of it.
     *
     * THIS METHOD SHOULD BE CALLED AFTER _preprocessHeaders
     */
    protected _preprocessEntity(opts: C.IRequestOptions): void {

        if (typeof opts.data === 'string') {

            opts.headers[C.Headers.CONTENT_LENGTH_H1] = Buffer.byteLength(opts.data);
        }
        else if (opts.data instanceof Buffer) {

            opts.headers[C.Headers.CONTENT_LENGTH_H1] = opts.data.byteLength;
        }
        else if ((opts.headers[C.Headers.CONTENT_LENGTH_H1] ?? -1) === -1) {

            throw new E.E_NO_CONTENT_LENGTH();
        }
    }

}
