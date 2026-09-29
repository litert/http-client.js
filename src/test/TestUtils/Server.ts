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

import * as NodeAssert from 'node:assert';
import * as NodeEvents from 'node:events';
import * as NodeFs from 'node:fs';
import * as NodeHttp from 'node:http';
import * as NodeHttp2 from 'node:http2';
import * as NodeHttps from 'node:https';
import * as NodeNet from 'node:net';
import * as NodePath from 'node:path';

export const LOOPBACK_ADDRESS = '127.0.0.1';
export const TEST_TIMEOUT = 2_000;

const TLS_FIXTURE_ROOT = NodePath.resolve('test-data');

export const TLS_CA = NodeFs.readFileSync(
    NodePath.join(TLS_FIXTURE_ROOT, 'ca/cert.pem')
);
export const TLS_CERT = NodeFs.readFileSync(
    NodePath.join(TLS_FIXTURE_ROOT, 'certs/b.local.org/cert.pem')
);
export const TLS_KEY = NodeFs.readFileSync(
    NodePath.join(TLS_FIXTURE_ROOT, 'certs/b.local.org/key.pem')
);
export const TLS_HOSTNAME = 'b.local.org';

export type ITestServer =
    NodeNet.Server |
    NodeHttp.Server |
    NodeHttps.Server |
    NodeHttp2.Http2Server |
    NodeHttp2.Http2SecureServer;

export type IHttp2RequestHandler = (
    request: NodeHttp2.Http2ServerRequest,
    response: NodeHttp2.Http2ServerResponse
) => void;

export type IHttp2StreamHandler = (
    stream: NodeHttp2.ServerHttp2Stream,
    headers: NodeHttp2.IncomingHttpHeaders
) => void;

export type ITcpConnectionHandler = (socket: NodeNet.Socket) => void;

export interface IResourceTracker<T> {

    readonly active: Set<T>;

    readonly events: NodeEvents.EventEmitter;

    peak: number;
}

export function createResourceTracker<T>(): IResourceTracker<T> {

    return {
        'active': new Set<T>(),
        'events': new NodeEvents.EventEmitter(),
        'peak': 0
    };
}

export function addTrackedResource<T>(
    tracker: IResourceTracker<T>,
    resource: T
): void {

    tracker.active.add(resource);
    tracker.peak = Math.max(tracker.peak, tracker.active.size);
    tracker.events.emit('change');
}

export function removeTrackedResource<T>(
    tracker: IResourceTracker<T>,
    resource: T
): void {

    tracker.active.delete(resource);
    tracker.events.emit('change');
}

export async function waitForResourceCount<T>(
    tracker: IResourceTracker<T>,
    expected: number
): Promise<void> {

    while (tracker.active.size !== expected) {

        await NodeEvents.once(tracker.events, 'change', {
            'signal': AbortSignal.timeout(TEST_TIMEOUT)
        });
    }
}

export class TestServer<TServer extends ITestServer> {

    private readonly _sockets = new Set<NodeNet.Socket>();

    private _port: number = 0;

    public constructor(public readonly server: TServer) {

        server.on('connection', (socket: NodeNet.Socket) => {

            this._sockets.add(socket);
            socket.once('close', () => this._sockets.delete(socket));
        });
    }

    public get activeSockets(): number {

        return this._sockets.size;
    }

    public get port(): number {

        NodeAssert.notStrictEqual(this._port, 0, 'The server is not listening.');

        return this._port;
    }

    public async listen(
        port: number = 0,
        address: string = LOOPBACK_ADDRESS
    ): Promise<this> {

        const listening = NodeEvents.once(this.server, 'listening', {
            'signal': AbortSignal.timeout(TEST_TIMEOUT)
        });

        this.server.listen(port, address);
        await listening;

        const boundAddress = this.server.address();

        NodeAssert.ok(boundAddress && typeof boundAddress !== 'string');
        this._port = boundAddress.port;

        return this;
    }

    public url(
        protocol: 'http' | 'https',
        pathname: string = '/',
        hostname: string = LOOPBACK_ADDRESS
    ): string {

        return `${protocol}://${hostname}:${this.port}${pathname}`;
    }

    public async close(): Promise<void> {

        for (const socket of this._sockets) {

            socket.destroy();
        }

        if (!this.server.listening) {

            return;
        }

        const closed = NodeEvents.once(this.server, 'close', {
            'signal': AbortSignal.timeout(TEST_TIMEOUT)
        });

        this.server.close();
        await closed;
    }
}

export async function startTcpServer(
    handler?: ITcpConnectionHandler
): Promise<TestServer<NodeNet.Server>> {

    return new TestServer(NodeNet.createServer(handler)).listen();
}

export async function startHttp1Server(
    handler?: NodeHttp.RequestListener
): Promise<TestServer<NodeHttp.Server>> {

    const server = NodeHttp.createServer(handler);

    server.on('clientError', (_error, socket) => socket.destroy());

    return new TestServer(server).listen();
}

export async function startHttps1Server(
    options: NodeHttps.ServerOptions,
    handler?: NodeHttp.RequestListener
): Promise<TestServer<NodeHttps.Server>> {

    const server = NodeHttps.createServer(options, handler);

    server.on('clientError', (_error, socket) => socket.destroy());

    return new TestServer(server).listen();
}

export async function startHttp2Server(
    handler?: IHttp2StreamHandler,
    port: number = 0,
    address: string = LOOPBACK_ADDRESS
): Promise<TestServer<NodeHttp2.Http2Server>> {

    const server = NodeHttp2.createServer();

    server.on('session', (session) => {

        session.on('error', () => undefined);
    });

    if (handler) {

        server.on('stream', handler);
    }

    return new TestServer(server).listen(port, address);
}

export async function startHttp2CompatibilityServer(
    handler: IHttp2RequestHandler
): Promise<TestServer<NodeHttp2.Http2Server>> {

    const server = NodeHttp2.createServer(handler);

    server.on('session', (session) => {

        session.on('error', () => undefined);
    });

    return new TestServer(server).listen();
}

export async function startSecureHttp2Server(
    options: NodeHttp2.SecureServerOptions,
    handler?: IHttp2StreamHandler
): Promise<TestServer<NodeHttp2.Http2SecureServer>> {

    const server = NodeHttp2.createSecureServer(options);

    server.on('session', (session) => {

        session.on('error', () => undefined);
    });

    if (handler) {

        server.on('stream', handler);
    }

    return new TestServer(server).listen();
}

export async function startSecureHttp2CompatibilityServer(
    options: NodeHttp2.SecureServerOptions,
    handler: IHttp2RequestHandler
): Promise<TestServer<NodeHttp2.Http2SecureServer>> {

    const server = NodeHttp2.createSecureServer(options, handler);

    server.on('session', (session) => {

        session.on('error', () => undefined);
    });

    return new TestServer(server).listen();
}

export function sendHttp2Response(
    stream: NodeHttp2.ServerHttp2Stream,
    body: string
): void {

    stream.respond({
        [NodeHttp2.constants.HTTP2_HEADER_STATUS]:
            NodeHttp2.constants.HTTP_STATUS_OK,
        [NodeHttp2.constants.HTTP2_HEADER_CONTENT_LENGTH]:
            Buffer.byteLength(body)
    });
    stream.end(body);
}
