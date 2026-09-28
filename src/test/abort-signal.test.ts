/* eslint-disable */

import * as NodeAssert from 'node:assert';
import * as NodeEvents from 'node:events';
import * as NodeHttp from 'node:http';
import * as NodeHttp2 from 'node:http2';
import * as NodeNet from 'node:net';
import { Readable } from 'node:stream';
import * as NodeTest from 'node:test';
import * as Http from '../lib';

const ABORT_CYCLES = 5;
const CONNECTION_LIMIT = 2;
const REQUESTS_PER_CYCLE = CONNECTION_LIMIT * 3;
const REQUEST_TIMEOUT = 2_000;
const LOOPBACK_ADDRESS = '127.0.0.1';
const PROBE_BODY = 'ok';

type ITestServer = NodeHttp.Server | NodeHttp2.Http2Server;

interface IResourceTracker<T> {

    active: Set<T>;

    events: NodeEvents.EventEmitter;

    peak: number;
}

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

function createResourceTracker<T>(): IResourceTracker<T> {

    return {
        'active': new Set<T>(),
        'events': new NodeEvents.EventEmitter(),
        'peak': 0
    };
}

function addTrackedResource<T>(tracker: IResourceTracker<T>, resource: T): void {

    tracker.active.add(resource);
    tracker.peak = Math.max(tracker.peak, tracker.active.size);
}

function removeTrackedResource<T>(tracker: IResourceTracker<T>, resource: T): void {

    tracker.active.delete(resource);

    if (!tracker.active.size) {

        tracker.events.emit('empty');
    }
}

async function waitForEmpty<T>(tracker: IResourceTracker<T>): Promise<void> {

    if (!tracker.active.size) {

        return;
    }

    await NodeEvents.once(tracker.events, 'empty', {
        'signal': AbortSignal.timeout(REQUEST_TIMEOUT)
    });
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

    if (!server.listening) {

        return;
    }

    const closed = NodeEvents.once(server, 'close');

    server.close();
    await closed;
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

            const port = await listen(server);

            testContext.after(async () => {

                client.close();
                await closeServer(server);
            });

            for (let cycle = 0; cycle < ABORT_CYCLES; cycle++) {

                const filled = waitForHttp1Requests(server, CONNECTION_LIMIT);
                const batch = createAbortBatch(
                    client,
                    `http://${LOOPBACK_ADDRESS}:${port}/hold`,
                    Http.EVersion.HTTP_1_1,
                    CONNECTION_LIMIT
                );

                await filled;
                abortBatch(batch, cycle);
                assertAborted(batch, await batch.settled);

                await assertProbe(
                    client,
                    `http://${LOOPBACK_ADDRESS}:${port}/probe`,
                    Http.EVersion.HTTP_1_1,
                    CONNECTION_LIMIT
                );
            }

            client.close();
            await waitForEmpty(sockets);
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

            const port = await listen(server);

            testContext.after(async () => {

                client.close();
                await closeServer(server);
            });

            for (let cycle = 0; cycle < ABORT_CYCLES; cycle++) {

                const filled = waitForHttp2Streams(server, CONNECTION_LIMIT);
                const batch = createAbortBatch(
                    client,
                    `http://${LOOPBACK_ADDRESS}:${port}/hold`,
                    Http.EVersion.HTTP_2,
                    1
                );

                await filled;
                abortBatch(batch, cycle);
                assertAborted(batch, await batch.settled);
                await waitForEmpty(streams);

                await assertProbe(
                    client,
                    `http://${LOOPBACK_ADDRESS}:${port}/probe`,
                    Http.EVersion.HTTP_2,
                    1
                );
                await waitForEmpty(streams);
            }

            NodeAssert.ok(sessions.peak <= CONNECTION_LIMIT);
            NodeAssert.ok(streams.peak <= CONNECTION_LIMIT);

            client.close();
            await waitForEmpty(sessions);
        }
    );
});
