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
import * as $H1S from 'https';
import * as $TLS from 'tls';
import * as A from './Abstract';
import { AbstractHttp1Client } from './AbstractHttp1Client';
import * as $Crypto from 'crypto';

export class H1SClient extends AbstractHttp1Client implements A.IProtocolClient {

    private _agents: Record<string, $H1S.Agent>;

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
    ): $H1S.Agent {

        if (this._agents[key]) {

            return this._agents[key];
        }

        return this._agents[key] = new $H1S.Agent({
            'maxSockets': this._getConnectionLimit(opts),
            'keepAlive': opts.keepAlive,
            'keepAliveMsecs': opts.keepAliveTimeout,
            ...opts.connectionOptions
        });
    }

    public async request(
        opts: C.IRequestOptions,
        tlsSocket?: $TLS.TLSSocket,
        key?: string
    ): Promise<A.IRequestResult> {

        const agent = this._getAgent(opts, key);

        const REQ_ENTITY = this._.requireEntity(opts.method);

        if (opts.connectionOptions.remoteHost) {

            opts.connectionOptions.servername = opts.url.hostname;
        }

        if (!opts.headers['host']) {
            opts.headers['host'] = this._.getRequestAuthority(opts.url);
        }

        const h1sOpts: $H1S.RequestOptions = {
            'host': opts.connectionOptions.remoteHost ?? opts.url.hostname,
            'port': opts.url.port,
            'method': opts.method,
            'path': this._.buildPath(opts.url),
            'headers': opts.headers,
            'agent': agent,
            'servername': opts.url.hostname,
            'minVersion': `TLSv${opts.minTLSVersion}` as $TLS.SecureVersion
        };

        if (opts.timeout) {

            h1sOpts.timeout = opts.timeout;
        }

        if (tlsSocket) {

            h1sOpts.createConnection = () => tlsSocket;
        }

        if (opts.localAddress) {

            h1sOpts.localAddress = opts.localAddress;
        }

        if (REQ_ENTITY) {

            /**
             * Here will validate the type of entity.
             */
            this._preprocessEntity(opts);
        }

        if (opts.ca) {

            h1sOpts.ca = opts.ca;
        }

        const req = $H1S.request({
            ...h1sOpts,
            ...opts.connectionOptions,
            ...opts.requestOptions,
            'signal': this._getAbortSignal(opts),
        });

        if (tlsSocket) {

            /**
             * The custom TLS socket will not delegated by HTTPS.Agent, so that it
             * must be released manually.
             */
            req.on('close', () => tlsSocket.destroy());
        }

        return this._processRequest(
            req,
            opts,
            REQ_ENTITY
        );
    }

    public getAuthorityKey(opts: C.IRequestOptions): string {

        const remoteHost = opts.connectionOptions.remoteHost ??
            opts.url.hostname;
        const identity = [
            `${this._.getAuthority(opts.url)}`,
            `rh:${remoteHost}`,
            `tls_v${opts.minTLSVersion}`,
            `la:${opts.localAddress}`,
            `conns:${this._getConnectionLimit(opts)}`,
            `ka:${opts.keepAlive}`,
            `kat:${opts.keepAliveTimeout}`
        ].join('/');

        if (opts.ca) {

            const hasher = $Crypto.createHash('md5');

            hasher.update(`${identity}/ca:`);

            hasher.end(opts.ca);

            return hasher.digest('base64');
        }

        return identity;
    }

    private _getConnectionLimit(opts: C.IRequestOptions): number {

        const limit = opts.concurrency === Infinity ? opts.maxConnections :
            opts.concurrency;

        return limit > 0 ? limit : 1;
    }
}
