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

import * as $TLS from 'tls';
import * as C from '../Common';
import * as $H2 from 'http2';
import * as A from './Abstract';
import { AbstractHttp2Client } from './AbstractHttp2Client';
import * as $Crypto from 'crypto';

export class H2SClient extends AbstractHttp2Client implements A.IProtocolClient {

    public constructor(helper: A.IHelper) {

        super(helper);
    }

    public async request(
        opts: C.IRequestOptions,
        tlsSocket?: $TLS.TLSSocket,
        key?: string
    ): Promise<A.IRequestResult> {

        if (tlsSocket) {

            opts.connectionOptions ??= {};

            opts.connectionOptions.createConnection = () => tlsSocket;
        }

        return this._processRequest(opts, key);
    }

    protected _prepareOptions(opts: C.IRequestOptions): $H2.SecureClientSessionOptions {

        const h2Opts: $H2.SecureClientSessionOptions = {
            /**
             * Always set servername, for SNI.
             */
            'servername': opts.url.hostname,
            'minVersion': `TLSv${opts.minTLSVersion}` as `TLSv1.2`
        };

        if (opts.ca) {

            h2Opts.ca = opts.ca;
        }

        if (opts.localAddress) {

            (h2Opts as any).localAddress = opts.localAddress;
        }

        return {
            ...h2Opts,
            ...opts.connectionOptions
        };
    }

    public getAuthorityKey(opts: C.IRequestOptions): string {

        if (opts.ca) {

            const hash = $Crypto.createHash('md5');

            hash.update(`${this._.getAuthority(opts.url)}/la:${opts.localAddress}/tls_v${opts.minTLSVersion}/ca:`);

            hash.end(opts.ca);

            return hash.digest('base64');
        }

        return `${this._.getAuthority(opts.url)}/la:${opts.localAddress}/tls_v${opts.minTLSVersion}`;
    }
}
