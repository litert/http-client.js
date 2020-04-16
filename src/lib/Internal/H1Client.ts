/**
 * Copyright 2020 Angus.Fenying <fenying@litert.org>
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
import * as $H1 from 'http';
import * as A from './Abstract';
import { AbstractHttp1Client } from './AbstractHttp1Client';

export class H1Client extends AbstractHttp1Client implements A.IProtocolClient {

    private _agents: Record<string, $H1.Agent>;

    public constructor(helper: A.IHelper) {

        super(helper);

        this._agents = {};
    }

    public close(): void {

        for (const k in this._agents) {

            this._agents[k].destroy();
        }

        this._agents = {};
    }

    protected _getAgent(
        opts: C.IRequestOptions,
        key: string = this.getAuthorityKey(opts)
    ): $H1.Agent {

        if (this._agents[key]) {

            return this._agents[key];
        }

        return this._agents[key] = new $H1.Agent({
            'maxSockets': opts.maxConnections,
            'keepAlive': opts.keepAlive,
            'keepAliveMsecs': opts.keepAliveTimeout,
            ...opts.connectionOptions
        }) as any;
    }

    public async request(opts: C.IRequestOptions): Promise<A.IRequestResult> {

        if (opts.concurrency !== Infinity) {

            /**
             * Overwrite maxConnections when concurrency is set.
             */
            opts.maxConnections = opts.concurrency;
        }

        let agent = this._getAgent(opts);

        const REQ_ENTITY = this._.requireEntity(opts.method);

        if (REQ_ENTITY) {

            /**
             * Here will validate the type of entity.
             */
            this._preprocessEntity(opts);
        }

        if (opts.connectionOptions.remoteHost) {

            if (!opts.headers['host']) {
                opts.headers['host'] = opts.url.hostname;
            }
        }

        let h1Opts: $H1.RequestOptions = {
            host: opts.connectionOptions.remoteHost ?? opts.url.hostname,
            port: opts.url.port,
            method: opts.method,
            path: this._.buildPath(opts.url),
            headers: opts.headers,
            agent
        };

        if (opts.timeout) {

            h1Opts.timeout = opts.timeout;
        }

        if (opts.localAddress) {

            h1Opts.localAddress = opts.localAddress;
        }

        return this._processRequest(
            $H1.request({
                ...h1Opts,
                ...opts.connectionOptions,
                ...opts.requestOptions
            }),
            opts,
            REQ_ENTITY
        );
    }

    public getAuthorityKey(opts: C.IRequestOptions): string {

        return `${this._.getAuthroity(opts.url)}/rh:${opts.connectionOptions.remoteHost ?? opts.url.hostname}/la:${opts.localAddress}/conns:${opts.maxConnections}`;
    }
}
