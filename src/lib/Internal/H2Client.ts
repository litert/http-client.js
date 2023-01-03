/**
 * Copyright 2023 Angus.Fenying <fenying@litert.org>
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
import * as $H2 from 'http2';
import * as A from './Abstract';
import { AbstractHttp2Client } from './AbstractHttp2Client';

export class H2Client extends AbstractHttp2Client implements A.IProtocolClient {

    public constructor(helper: A.IHelper) {

        super(helper);
    }

    public async request(opts: C.IRequestOptions): Promise<A.IRequestResult> {

        return this._processRequest(opts);
    }

    protected _prepareOptions(opts: C.IRequestOptions): $H2.ClientSessionOptions {

        const h2Opts: $H2.ClientSessionOptions = {};

        if (opts.localAddress) {

            (h2Opts as any).localAddress = opts.localAddress;
        }

        return {
            ...h2Opts,
            ...opts.connectionOptions
        };
    }

    public getAuthorityKey(opts: C.IRequestOptions): string {

        return `${this._.getAuthroity(opts.url)}/la:${opts.localAddress}`;
    }
}
