/* eslint-disable */

import * as NodeAssert from 'node:assert';
import * as NodeEvents from 'node:events';
import * as NodeHttp from 'node:http';
import * as NodeHttp2 from 'node:http2';
import { Readable, Writable } from 'node:stream';
import * as NodeTest from 'node:test';
import * as Http from '../lib';
import { AbstractHttp1Client } from '../lib/Internal/AbstractHttp1Client';
import { AbstractHttp2Client } from '../lib/Internal/AbstractHttp2Client';
import { HttpHelper } from '../lib/Internal/Helper';

const LOOPBACK_ADDRESS = '127.0.0.1';
const REQUEST_TIMEOUT = 1_000;

type ITestServer = NodeHttp.Server | NodeHttp2.Http2Server;

interface IFakeConnection {

    concurrency: number;

    connection: NodeHttp2.ClientHttp2Session;
}

class ObservedRequest extends Writable {

    public timeoutConfigured = false;

    public timeoutConfiguredAtFirstWrite: boolean | null = null;

    private _responseEmitted = false;

    public constructor(
        private readonly _protocol: Http.EVersion,
        private readonly _emitEarlyResponse: boolean
    ) {

        super();
    }

    public setTimeout(_timeout: number, _callback?: () => void): this {

        this.timeoutConfigured = true;

        return this;
    }

    public override _write(
        _chunk: Buffer,
        _encoding: BufferEncoding,
        callback: (error?: Error | null) => void
    ): void {

        this.timeoutConfiguredAtFirstWrite ??= this.timeoutConfigured;

        if (this._emitEarlyResponse && !this._responseEmitted) {

            this._responseEmitted = true;

            if (this._protocol === Http.EVersion.HTTP_1_1) {

                const response = new Readable({
                    read(): void {

                        this.push(null);
                    }
                }) as NodeHttp.IncomingMessage;

                response.headers = {};
                response.statusCode = NodeHttp2.constants.HTTP_STATUS_OK;
                response.setTimeout = (): NodeHttp.IncomingMessage => response;

                this.emit('response', response);
            }
            else {

                this.emit('response', {
                    [NodeHttp2.constants.HTTP2_HEADER_STATUS]: NodeHttp2.constants.HTTP_STATUS_OK
                });
            }
        }

        callback();
    }
}

class TestHttp1Client extends AbstractHttp1Client {

    public process(
        request: ObservedRequest,
        opts: Http.IRequestOptions
    ): Promise<import('../lib/Internal/Abstract').IRequestResult> {

        return this._processRequest(
            request as unknown as NodeHttp.ClientRequest,
            opts,
            true
        );
    }
}

class TestHttp2Client extends AbstractHttp2Client {

    public getAuthorityKey(_opts: Http.IRequestOptions): string {

        return 'test-connection';
    }

    protected _prepareOptions(
        _opts: Http.IRequestOptions
    ): NodeHttp2.ClientSessionOptions {

        return {};
    }

    public process(
        opts: Http.IRequestOptions
    ): Promise<import('../lib/Internal/Abstract').IRequestResult> {

        return this._processRequest(opts);
    }
}

function createFailingBody(error: Error): Readable {

    async function* generate(): AsyncGenerator<Buffer> {

        yield Buffer.from('partial body');
        throw error;
    }

    return Readable.from(generate());
}

function createInternalOptions(
    data: Readable,
    version: Http.EVersion
): Http.IRequestOptions {

    return {
        'method': 'POST',
        'url': {
            'protocol': 'http',
            'hostname': LOOPBACK_ADDRESS,
            'pathname': '/',
            'port': Http.DEFAULT_HTTP_PORT
        },
        'headers': {
            [Http.Headers.CONTENT_LENGTH_H1]: 64
        },
        'localAddress': '',
        'authentication': {
            'type': 'none'
        },
        'minTLSVersion': Http.ETlsVersion.TLS_V1_2,
        data,
        version,
        'gzip': false,
        'deflate': false,
        'maxConnections': 1,
        'concurrency': 1,
        'keepAlive': false,
        'keepAliveTimeout': REQUEST_TIMEOUT,
        'ca': '',
        'requestOptions': {},
        'connectionOptions': {},
        'timeout': REQUEST_TIMEOUT
    };
}

async function listen(server: ITestServer): Promise<number> {

    const listening = NodeEvents.once(server, 'listening');

    server.listen(0, LOOPBACK_ADDRESS);
    await listening;

    const address = server.address();

    NodeAssert.ok(address && typeof address !== 'string');

    return address.port;
}

async function closeServer(server: ITestServer): Promise<void> {

    const closed = NodeEvents.once(server, 'close');

    server.close();
    await closed;
}

function attachHttp1ServerGuards(server: NodeHttp.Server): void {

    server.on('request', (request) => {

        request.on('error', () => undefined);
        request.resume();
    });

    server.on('clientError', (_error, socket) => socket.destroy());
}

function attachHttp2ServerGuards(server: NodeHttp2.Http2Server): void {

    server.on('session', (session) => session.on('error', () => undefined));
    server.on('stream', (stream) => {

        stream.on('error', () => undefined);
        stream.resume();
    });
}

function installFakeHttp2Connection(
    client: TestHttp2Client,
    request: ObservedRequest
): IFakeConnection {

    const connection = {
        'concurrency': 1,
        'connection': {
            'closed': false,
            'request': (): NodeHttp2.ClientHttp2Stream => (
                request as unknown as NodeHttp2.ClientHttp2Stream
            )
        } as NodeHttp2.ClientHttp2Session
    };

    Object.defineProperty(client, '_getConnection', {
        'value': async (): Promise<[string, IFakeConnection]> => [
            'test-connection-id',
            connection
        ]
    });

    return connection;
}

NodeTest.describe('Request body stream pipeline regression', {
    'concurrency': false
}, () => {

    NodeTest.it(
        'B-F-00001: [BUG] Should report an HTTP/1.1 request body stream failure',
        async (testContext) => {

            const server = NodeHttp.createServer();
            const client = Http.createHttpClient();
            const sourceError = new Error('HTTP/1.1 body failed');

            attachHttp1ServerGuards(server);

            const port = await listen(server);

            testContext.after(async () => {

                client.close();
                await closeServer(server);
            });

            await NodeAssert.rejects(client.request({
                'method': 'POST',
                'url': `http://${LOOPBACK_ADDRESS}:${port}/`,
                'headers': {
                    [Http.Headers.CONTENT_LENGTH_H1]: 64
                },
                'data': createFailingBody(sourceError),
                'version': Http.EVersion.HTTP_1_1,
                'timeout': REQUEST_TIMEOUT
            }), (error: unknown): boolean => {

                NodeAssert.ok(error instanceof Http.E_NETWORK_FAILED);
                NodeAssert.strictEqual(error.origin, sourceError);

                return true;
            });
        }
    );

    NodeTest.it(
        'B-F-00002: [BUG] Should report an HTTP/2 request body stream failure',
        async (testContext) => {

            const server = NodeHttp2.createServer();
            const client = Http.createHttpClient();
            const sourceError = new Error('HTTP/2 body failed');

            attachHttp2ServerGuards(server);

            const port = await listen(server);

            testContext.after(async () => {

                client.close();
                await closeServer(server);
            });

            await NodeAssert.rejects(client.request({
                'method': 'POST',
                'url': `http://${LOOPBACK_ADDRESS}:${port}/`,
                'headers': {
                    [Http.Headers.CONTENT_LENGTH_H1]: 64
                },
                'data': createFailingBody(sourceError),
                'version': Http.EVersion.HTTP_2,
                'timeout': REQUEST_TIMEOUT
            }), (error: unknown): boolean => {

                NodeAssert.ok(error instanceof Http.E_NETWORK_FAILED);
                NodeAssert.strictEqual(error.origin, sourceError);

                return true;
            });
        }
    );

    NodeTest.it(
        'W-F-00001: [BUG] Should destroy the HTTP/1.1 request when its body stream fails',
        async () => {

            const sourceError = new Error('HTTP/1.1 body failed');
            const request = new ObservedRequest(Http.EVersion.HTTP_1_1, false);
            const client = new TestHttp1Client(new HttpHelper());

            await NodeAssert.rejects(client.process(
                request,
                createInternalOptions(
                    createFailingBody(sourceError),
                    Http.EVersion.HTTP_1_1
                )
            ), (error: unknown): boolean => {

                NodeAssert.ok(error instanceof Http.E_NETWORK_FAILED);
                NodeAssert.strictEqual(error.origin, sourceError);

                return true;
            });

            NodeAssert.strictEqual(request.destroyed, true);
        }
    );

    NodeTest.it(
        'W-F-00002: [BUG] Should destroy the HTTP/2 request and release its connection once',
        async () => {

            const sourceError = new Error('HTTP/2 body failed');
            const request = new ObservedRequest(Http.EVersion.HTTP_2, false);
            const client = new TestHttp2Client(new HttpHelper());
            const connection = installFakeHttp2Connection(client, request);

            await NodeAssert.rejects(client.process(createInternalOptions(
                createFailingBody(sourceError),
                Http.EVersion.HTTP_2
            )), (error: unknown): boolean => {

                NodeAssert.ok(error instanceof Http.E_NETWORK_FAILED);
                NodeAssert.strictEqual(error.origin, sourceError);

                return true;
            });

            NodeAssert.strictEqual(request.destroyed, true);
            NodeAssert.strictEqual(connection.concurrency, 0);
        }
    );

    NodeTest.it(
        'W-E-00001: Should retain an early HTTP/1.1 response and configure timeout before upload',
        async () => {

            const request = new ObservedRequest(Http.EVersion.HTTP_1_1, true);
            const client = new TestHttp1Client(new HttpHelper());
            const response = await client.process(
                request,
                createInternalOptions(
                    Readable.from(['request body']),
                    Http.EVersion.HTTP_1_1
                )
            );

            NodeAssert.strictEqual(
                response.statusCode,
                NodeHttp2.constants.HTTP_STATUS_OK
            );
            NodeAssert.strictEqual(request.timeoutConfiguredAtFirstWrite, true);
        }
    );

    NodeTest.it(
        'W-E-00002: Should retain an early HTTP/2 response and configure timeout before upload',
        async () => {

            const request = new ObservedRequest(Http.EVersion.HTTP_2, true);
            const client = new TestHttp2Client(new HttpHelper());
            const connection = installFakeHttp2Connection(client, request);
            const response = await client.process(createInternalOptions(
                Readable.from(['request body']),
                Http.EVersion.HTTP_2
            ));

            NodeAssert.strictEqual(
                response.statusCode,
                NodeHttp2.constants.HTTP_STATUS_OK
            );
            NodeAssert.strictEqual(request.timeoutConfiguredAtFirstWrite, true);

            request.emit('close');
            NodeAssert.strictEqual(connection.concurrency, 0);
        }
    );
});
