/* eslint-disable */

import * as NodeAssert from 'node:assert';
import * as NodeHttp from 'node:http';
import * as NodeHttp2 from 'node:http2';
import * as NodeNet from 'node:net';
import { Readable } from 'node:stream';
import * as NodeTest from 'node:test';
import * as Http from '../lib';
import {
    addTrackedResource,
    createResourceTracker,
    removeTrackedResource,
    TestServer,
    TEST_TIMEOUT as REQUEST_TIMEOUT,
    waitForResourceCount
} from './TestServer';

const ABORT_CYCLES = 5;
const CONNECTION_LIMIT = 2;
const REQUESTS_PER_CYCLE = CONNECTION_LIMIT * 3;
const PROBE_BODY = 'ok';

interface IAbortBatch {

    bodies: PendingBody[];

    controllers: AbortController[];

    settled: Promise<PromiseSettledResult<Http.IResponse>[]>;
}

interface IErrorWithCause extends Error {

    cause?: unknown;
}

class PendingBody extends Readable {

    private _sent = false;

    public override _read(): void {

        if (this._sent) {

            return;
        }

        this._sent = true;
        this.push(Buffer.from('partial body'));
    }
}

function waitForHttp1Requests(
    server: NodeHttp.Server,
    expected: number
): Promise<void> {

    return new Promise((resolve) => {

        let received = 0;

        const onRequest = (request: NodeHttp.IncomingMessage): void => {

            if (!request.url?.startsWith('/hold') || ++received !== expected) {

                return;
            }

            server.removeListener('request', onRequest);
            resolve();
        };

        server.on('request', onRequest);
    });
}

function waitForHttp2Streams(
    server: NodeHttp2.Http2Server,
    expected: number
): Promise<void> {

    return new Promise((resolve) => {

        let received = 0;

        const onStream = (
            _stream: NodeHttp2.ServerHttp2Stream,
            headers: NodeHttp2.IncomingHttpHeaders
        ): void => {

            const path = headers[NodeHttp2.constants.HTTP2_HEADER_PATH];

            if (typeof path !== 'string' || !path.startsWith('/hold') ||
                ++received !== expected) {

                return;
            }

            server.removeListener('stream', onStream);
            resolve();
        };

        server.on('stream', onStream);
    });
}

function createAbortBatch(
    client: Http.IClient,
    url: string,
    version: Http.EVersion,
    concurrency: number
): IAbortBatch {

    const controllers = Array.from(
        { 'length': REQUESTS_PER_CYCLE },
        () => new AbortController()
    );
    const bodies = controllers.map(() => new PendingBody());
    const requests = controllers.map((controller, index) => {

        const opts: Http.IRequestOptionsInput = {
            'method': 'POST',
            url,
            version,
            'headers': {
                [Http.Headers.CONTENT_LENGTH_H1]: 64
            },
            'data': bodies[index],
            'maxConnections': CONNECTION_LIMIT,
            concurrency,
            'timeout': REQUEST_TIMEOUT
        };

        if (index) {

            opts.signal = controller.signal;
        }
        else {

            opts.requestOptions = {
                'signal': controller.signal
            };
        }

        return client.request(opts);
    });

    return {
        bodies,
        controllers,
        'settled': Promise.allSettled(requests)
    };
}

function abortBatch(batch: IAbortBatch, cycle: number): void {

    for (const controller of batch.controllers) {

        controller.abort(new Error(`Abort cycle ${cycle}.`));
    }
}

function assertAborted(
    batch: IAbortBatch,
    results: PromiseSettledResult<Http.IResponse>[]
): void {

    NodeAssert.strictEqual(results.length, REQUESTS_PER_CYCLE);

    for (let index = 0; index < results.length; index++) {

        const result = results[index];

        NodeAssert.strictEqual(result.status, 'rejected');

        if (result.status === 'rejected') {

            const error = result.reason;
            const abortReason = batch.controllers[index].signal.reason;

            NodeAssert.ok(error instanceof Http.E_ABORTED);
            NodeAssert.ok(error.origin instanceof Error);

            if (error.origin.name === 'AbortError') {

                NodeAssert.strictEqual(
                    (error.origin as IErrorWithCause).cause,
                    abortReason
                );
            }
            else {

                NodeAssert.strictEqual(error.origin, abortReason);
            }
        }
    }

    for (const body of batch.bodies) {

        NodeAssert.strictEqual(body.destroyed, true);
    }
}

async function assertProbe(
    client: Http.IClient,
    url: string,
    version: Http.EVersion,
    concurrency: number
): Promise<void> {

    const response = await client.request({
        'method': 'GET',
        url,
        version,
        'maxConnections': CONNECTION_LIMIT,
        concurrency,
        'timeout': REQUEST_TIMEOUT
    });

    NodeAssert.strictEqual(
        response.statusCode,
        NodeHttp2.constants.HTTP_STATUS_OK
    );
    NodeAssert.strictEqual(
        (await response.getBuffer()).toString(),
        PROBE_BODY
    );
}

NodeTest.describe('AbortSignal connection pool recovery', {
    'concurrency': false,
    'timeout': 30_000
}, () => {

    NodeTest.it(
        'B-F-00001: [BUG] Should repeatedly abort a saturated HTTP/1.1 pool and recover',
        async (testContext) => {

            const sockets = createResourceTracker<NodeNet.Socket>();
            const server = NodeHttp.createServer((request, response) => {

                request.on('error', () => undefined);
                request.resume();

                if (request.url?.startsWith('/probe')) {

                    response.writeHead(NodeHttp2.constants.HTTP_STATUS_OK, {
                        'content-length': Buffer.byteLength(PROBE_BODY)
                    });
                    response.end(PROBE_BODY);
                }
            });
            const client = Http.createHttpClient();

            server.on('connection', (socket) => {

                addTrackedResource(sockets, socket);
                socket.once('close', () => removeTrackedResource(sockets, socket));
            });
            server.on('clientError', (_error, socket) => socket.destroy());

            const testServer = await new TestServer(server).listen();

            testContext.after(async () => {

                client.close();
                await testServer.close();
            });

            for (let cycle = 0; cycle < ABORT_CYCLES; cycle++) {

                const filled = waitForHttp1Requests(server, CONNECTION_LIMIT);
                const batch = createAbortBatch(
                    client,
                    testServer.url('http', '/hold'),
                    Http.EVersion.HTTP_1_1,
                    CONNECTION_LIMIT
                );

                await filled;
                abortBatch(batch, cycle);
                assertAborted(batch, await batch.settled);

                await assertProbe(
                    client,
                    testServer.url('http', '/probe'),
                    Http.EVersion.HTTP_1_1,
                    CONNECTION_LIMIT
                );
            }

            const waiting = waitForHttp1Requests(server, 1);
            const controller = new AbortController();
            const pending = client.request({
                'method': 'GET',
                'url': testServer.url('http', '/hold'),
                'version': Http.EVersion.HTTP_1_1,
                'maxConnections': CONNECTION_LIMIT,
                'concurrency': CONNECTION_LIMIT,
                'signal': controller.signal
            });

            await waiting;
            controller.abort(new Error('Cancel while waiting for HTTP/1.1.'));
            await NodeAssert.rejects(
                pending,
                (error: unknown): boolean => error instanceof Http.E_ABORTED
            );

            client.close();
            await waitForResourceCount(sockets, 0);
            NodeAssert.strictEqual(sockets.active.size, 0);
        }
    );

    NodeTest.it(
        'B-F-00002: [BUG] Should repeatedly abort a saturated HTTP/2 pool and recover',
        async (testContext) => {

            const sessions = createResourceTracker<NodeHttp2.ServerHttp2Session>();
            const streams = createResourceTracker<NodeHttp2.ServerHttp2Stream>();
            const server = NodeHttp2.createServer();
            const client = Http.createHttpClient();

            server.on('session', (session) => {

                addTrackedResource(sessions, session);
                session.on('error', () => undefined);
                session.once('close', () => removeTrackedResource(sessions, session));
            });
            server.on('stream', (stream, headers) => {

                const serverStream = stream as NodeHttp2.ServerHttp2Stream;
                const path = headers[NodeHttp2.constants.HTTP2_HEADER_PATH];

                addTrackedResource(streams, serverStream);
                serverStream.on('error', () => undefined);
                serverStream.resume();
                serverStream.once('close', () => {

                    removeTrackedResource(streams, serverStream);
                });

                if (typeof path === 'string' && path.startsWith('/probe')) {

                    serverStream.respond({
                        [NodeHttp2.constants.HTTP2_HEADER_STATUS]:
                            NodeHttp2.constants.HTTP_STATUS_OK,
                        [NodeHttp2.constants.HTTP2_HEADER_CONTENT_LENGTH]:
                            Buffer.byteLength(PROBE_BODY)
                    });
                    serverStream.end(PROBE_BODY);
                }
            });

            const testServer = await new TestServer(server).listen();

            testContext.after(async () => {

                client.close();
                await testServer.close();
            });

            for (let cycle = 0; cycle < ABORT_CYCLES; cycle++) {

                const filled = waitForHttp2Streams(server, CONNECTION_LIMIT);
                const batch = createAbortBatch(
                    client,
                    testServer.url('http', '/hold'),
                    Http.EVersion.HTTP_2,
                    1
                );

                await filled;
                abortBatch(batch, cycle);
                assertAborted(batch, await batch.settled);
                await waitForResourceCount(streams, 0);

                await assertProbe(
                    client,
                    testServer.url('http', '/probe'),
                    Http.EVersion.HTTP_2,
                    1
                );
                await waitForResourceCount(streams, 0);
            }

            const waiting = waitForHttp2Streams(server, 1);
            const controller = new AbortController();
            const pending = client.request({
                'method': 'GET',
                'url': testServer.url('http', '/hold'),
                'version': Http.EVersion.HTTP_2,
                'maxConnections': CONNECTION_LIMIT,
                'concurrency': 1,
                'signal': controller.signal
            });

            await waiting;
            controller.abort(new Error('Cancel while waiting for HTTP/2.'));
            await NodeAssert.rejects(
                pending,
                (error: unknown): boolean => error instanceof Http.E_ABORTED
            );
            await waitForResourceCount(streams, 0);

            NodeAssert.ok(sessions.peak <= CONNECTION_LIMIT);
            NodeAssert.ok(streams.peak <= CONNECTION_LIMIT);

            client.close();
            await waitForResourceCount(sessions, 0);
        }
    );
});
