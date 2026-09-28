/* eslint-disable */

import * as NodeAssert from 'node:assert';
import * as NodeEvents from 'node:events';
import * as NodeHttp2 from 'node:http2';
import * as NodeNet from 'node:net';
import * as NodeTest from 'node:test';
import * as Http from '../lib';
import {
    addTrackedResource,
    createResourceTracker,
    LOOPBACK_ADDRESS,
    removeTrackedResource,
    TestServer,
    TEST_TIMEOUT,
    TLS_CA,
    TLS_HOSTNAME,
    waitForResourceCount
} from './TestServer';

const OK_BODY = 'ok';
const SATURATED_REQUEST_COUNT = 6;

interface IRequestLimits {

    concurrency: number;

    maxConnections: number;
}

async function getBody(response: Http.IResponse): Promise<string> {

    return (await response.getBuffer()).toString();
}

NodeTest.describe('HTTP/2 connection pool', {
    'concurrency': false,
    'timeout': 30_000
}, () => {

    const sessions = createResourceTracker<NodeHttp2.ServerHttp2Session>();
    const streams = createResourceTracker<NodeHttp2.ServerHttp2Stream>();
    const heldStreams = new Set<NodeHttp2.ServerHttp2Stream>();
    const holdEvents = new NodeEvents.EventEmitter();
    let holdRequests = 0;
    let sessionsCreated = 0;
    let server: TestServer<NodeHttp2.Http2Server>;

    function releaseStream(stream: NodeHttp2.ServerHttp2Stream): void {

        if (stream.closed || stream.destroyed) {

            return;
        }

        stream.respond({
            [NodeHttp2.constants.HTTP2_HEADER_STATUS]:
                NodeHttp2.constants.HTTP_STATUS_OK,
            [NodeHttp2.constants.HTTP2_HEADER_CONTENT_LENGTH]:
                Buffer.byteLength(OK_BODY)
        });
        stream.end(OK_BODY);
    }

    function releaseHeldStreams(): void {

        for (const stream of heldStreams) {

            releaseStream(stream);
        }
    }

    async function waitForHoldRequests(expected: number): Promise<void> {

        while (holdRequests < expected) {

            await NodeEvents.once(holdEvents, 'request', {
                'signal': AbortSignal.timeout(TEST_TIMEOUT)
            });
        }
    }

    function createClient(testContext: NodeTest.TestContext): Http.IClient {

        const client = Http.createHttpClient();

        testContext.after(async () => {

            client.close();
            await waitForResourceCount(sessions, 0);
        });

        return client;
    }

    function request(
        client: Http.IClient,
        pathname: string,
        limits: IRequestLimits
    ): Promise<Http.IResponse> {

        return client.request({
            'method': 'GET',
            'url': server.url('http', pathname),
            'version': Http.EVersion.HTTP_2,
            'concurrency': limits.concurrency,
            'maxConnections': limits.maxConnections,
            'timeout': TEST_TIMEOUT
        });
    }

    NodeTest.before(async () => {

        const nativeServer = NodeHttp2.createServer();

        nativeServer.on('session', (session) => {

            sessionsCreated++;
            addTrackedResource(sessions, session);
            session.on('error', () => undefined);
            session.once('close', () => removeTrackedResource(sessions, session));
        });
        nativeServer.on('stream', (stream, headers) => {

            const serverStream = stream as NodeHttp2.ServerHttp2Stream;
            const pathname = headers[NodeHttp2.constants.HTTP2_HEADER_PATH];

            addTrackedResource(streams, serverStream);
            serverStream.on('error', () => undefined);
            serverStream.resume();
            serverStream.once('close', () => {

                heldStreams.delete(serverStream);
                removeTrackedResource(streams, serverStream);
            });

            if (typeof pathname === 'string' && pathname.startsWith('/hold')) {

                holdRequests++;
                heldStreams.add(serverStream);
                holdEvents.emit('request');
                return;
            }

            if (typeof pathname === 'string' && pathname.startsWith('/reset')) {

                serverStream.close(NodeHttp2.constants.NGHTTP2_INTERNAL_ERROR);
                return;
            }

            if (typeof pathname === 'string' &&
                pathname.startsWith('/close-session')) {

                NodeAssert.ok(serverStream.session);
                serverStream.session.destroy();
                return;
            }

            if (typeof pathname === 'string' &&
                pathname.startsWith('/session-error')) {

                NodeAssert.ok(serverStream.session);
                serverStream.session.destroy(new Error('Forced session error.'));
                return;
            }

            releaseStream(serverStream);
        });

        server = await new TestServer(nativeServer).listen();
    });

    NodeTest.after(async () => {

        releaseHeldStreams();
        await server.close();
    });

    NodeTest.beforeEach(async () => {

        releaseHeldStreams();
        await waitForResourceCount(streams, 0);
        holdRequests = 0;
        sessions.peak = sessions.active.size;
        streams.peak = 0;
    });

    NodeTest.it(
        'B-M-00001: Should reuse one session for sequential requests',
        async (testContext) => {

            const client = createClient(testContext);
            const createdBefore = sessionsCreated;
            const limits = { 'concurrency': 2, 'maxConnections': 2 };

            NodeAssert.strictEqual(await getBody(await request(client, '/ok', limits)), OK_BODY);
            NodeAssert.strictEqual(await getBody(await request(client, '/ok', limits)), OK_BODY);
            NodeAssert.strictEqual(sessionsCreated - createdBefore, 1);
            NodeAssert.strictEqual(sessions.active.size, 1);
        }
    );

    NodeTest.it(
        'B-E-00001: Should enforce connection and stream concurrency limits',
        async (testContext) => {

            const client = createClient(testContext);
            const limits = { 'concurrency': 2, 'maxConnections': 2 };
            const pending = Array.from(
                { 'length': SATURATED_REQUEST_COUNT },
                (_, index) => request(client, `/hold/${index}`, limits)
            );

            await waitForHoldRequests(limits.concurrency * limits.maxConnections);
            NodeAssert.strictEqual(heldStreams.size, 4);
            NodeAssert.strictEqual(sessions.active.size, 2);
            NodeAssert.ok(streams.peak <= 4);

            releaseHeldStreams();
            const completed = await Promise.all(
                pending.slice(0, 4).map(async (result) => getBody(await result))
            );
            await waitForHoldRequests(SATURATED_REQUEST_COUNT);
            releaseHeldStreams();

            NodeAssert.deepStrictEqual(
                [
                    ...completed,
                    ...await Promise.all(
                        pending.slice(4).map(async (result) => getBody(await result))
                    )
                ],
                Array(SATURATED_REQUEST_COUNT).fill(OK_BODY)
            );
            await waitForResourceCount(streams, 0);
            NodeAssert.ok(sessions.peak <= limits.maxConnections);
        }
    );

    NodeTest.it(
        'B-E-00002: Should isolate pools that use different limits',
        async (testContext) => {

            const client = createClient(testContext);
            const first = request(client, '/hold/first', {
                'concurrency': 1,
                'maxConnections': 1
            });

            await waitForHoldRequests(1);

            const second = request(client, '/hold/second', {
                'concurrency': 1,
                'maxConnections': 2
            });

            await waitForHoldRequests(2);
            NodeAssert.strictEqual(sessions.active.size, 2);

            releaseHeldStreams();
            NodeAssert.deepStrictEqual(
                await Promise.all([first, second].map(async (result) => (
                    getBody(await result)
                ))),
                [OK_BODY, OK_BODY]
            );
        }
    );

    NodeTest.it(
        'B-E-00003: Should normalize non-positive pool limits to one',
        async (testContext) => {

            const client = createClient(testContext);
            const limits = { 'concurrency': 0, 'maxConnections': 0 };
            const first = request(client, '/hold/first', limits);
            const second = request(client, '/hold/second', limits);

            await waitForHoldRequests(1);
            NodeAssert.strictEqual(sessions.active.size, 1);
            NodeAssert.strictEqual(heldStreams.size, 1);

            releaseHeldStreams();
            const firstBody = await getBody(await first);
            await waitForHoldRequests(2);
            releaseHeldStreams();

            NodeAssert.deepStrictEqual(
                [firstBody, await getBody(await second)],
                [OK_BODY, OK_BODY]
            );
        }
    );

    NodeTest.it(
        'B-F-00001: Should reject a pre-aborted request without opening a session',
        async (testContext) => {

            const client = createClient(testContext);
            const controller = new AbortController();
            const reason = new Error('Already canceled.');
            const createdBefore = sessionsCreated;

            controller.abort(reason);

            await NodeAssert.rejects(client.request({
                'method': 'GET',
                'url': server.url('http', '/ok'),
                'version': Http.EVersion.HTTP_2,
                'signal': controller.signal
            }), (error: unknown): boolean => {

                NodeAssert.ok(error instanceof Http.E_ABORTED);
                NodeAssert.strictEqual(error.origin, reason);
                return true;
            });

            NodeAssert.strictEqual(sessionsCreated, createdBefore);
        }
    );

    NodeTest.it(
        'B-F-00002: Should abort a request while its TLS connection is pending',
        async () => {

            let acceptedSocket: NodeNet.Socket | null = null;
            let resolveAccepted!: () => void;
            let resolveClosed!: () => void;
            const accepted = new Promise<void>((resolve) => resolveAccepted = resolve);
            const closed = new Promise<void>((resolve) => resolveClosed = resolve);
            const rawServer = await new TestServer(NodeNet.createServer((socket) => {

                acceptedSocket = socket;
                socket.once('close', resolveClosed);
                socket.resume();
                resolveAccepted();
            })).listen();
            const client = Http.createHttpClient();
            const controller = new AbortController();
            const reason = new Error('Cancel TLS setup.');

            try {

                const result = client.request({
                    'method': 'GET',
                    'url': rawServer.url('https', '/', TLS_HOSTNAME),
                    'version': Http.EVersion.HTTP_2,
                    'ca': TLS_CA,
                    'signal': controller.signal,
                    'connectionOptions': {
                        'remoteHost': LOOPBACK_ADDRESS
                    }
                });

                await accepted;
                controller.abort(reason);

                await NodeAssert.rejects(result, (error: unknown): boolean => {

                    NodeAssert.ok(error instanceof Http.E_ABORTED);
                    NodeAssert.strictEqual(error.origin, reason);
                    return true;
                });
                await closed;
                NodeAssert.strictEqual(acceptedSocket!.destroyed, true);
            }
            finally {

                client.close();
                await rawServer.close();
            }
        }
    );

    NodeTest.it(
        'B-F-00003: Should release capacity after a stream error',
        async (testContext) => {

            const client = createClient(testContext);
            const limits = { 'concurrency': 1, 'maxConnections': 1 };

            await NodeAssert.rejects(request(client, '/reset', limits));
            NodeAssert.strictEqual(
                await getBody(await request(client, '/ok', limits)),
                OK_BODY
            );
        }
    );

    NodeTest.it(
        'B-F-00004: Should replace closed or failed sessions and recover',
        async (testContext) => {

            const client = createClient(testContext);
            const limits = { 'concurrency': 1, 'maxConnections': 1 };
            const createdBefore = sessionsCreated;

            await NodeAssert.rejects(request(client, '/close-session', limits));
            await waitForResourceCount(sessions, 0);

            NodeAssert.strictEqual(
                await getBody(await request(client, '/ok', limits)),
                OK_BODY
            );
            NodeAssert.strictEqual(sessionsCreated - createdBefore, 2);

            await NodeAssert.rejects(request(client, '/session-error', limits));
            await waitForResourceCount(sessions, 0);

            NodeAssert.strictEqual(
                await getBody(await request(client, '/ok', limits)),
                OK_BODY
            );
            NodeAssert.strictEqual(sessionsCreated - createdBefore, 3);
        }
    );

    NodeTest.it(
        'B-F-00005: Should recover after connection establishment fails',
        async () => {

            const reservation = await new TestServer(NodeNet.createServer()).listen();
            const port = reservation.port;

            await reservation.close();

            const client = Http.createHttpClient();
            const requestOptions: Http.IRequestOptionsInput = {
                'method': 'GET',
                'url': `http://${LOOPBACK_ADDRESS}:${port}/ok`,
                'version': Http.EVersion.HTTP_2,
                'concurrency': 1,
                'maxConnections': 1,
                'timeout': TEST_TIMEOUT
            };

            await NodeAssert.rejects(client.request(requestOptions));

            const recoveryServer = NodeHttp2.createServer();

            recoveryServer.on('stream', (stream) => {

                const serverStream = stream as NodeHttp2.ServerHttp2Stream;

                serverStream.respond({
                    [NodeHttp2.constants.HTTP2_HEADER_STATUS]:
                        NodeHttp2.constants.HTTP_STATUS_OK,
                    [NodeHttp2.constants.HTTP2_HEADER_CONTENT_LENGTH]:
                        Buffer.byteLength(OK_BODY)
                });
                serverStream.end(OK_BODY);
            });

            const recovery = await new TestServer(recoveryServer).listen(port);

            try {

                NodeAssert.strictEqual(
                    await getBody(await client.request(requestOptions)),
                    OK_BODY
                );
            }
            finally {

                client.close();
                await recovery.close();
            }
        }
    );

    NodeTest.it(
        'B-M-00002: Should destroy every pooled session when the client closes',
        async () => {

            const client = Http.createHttpClient();

            try {

                await getBody(await request(client, '/ok', {
                    'concurrency': 1,
                    'maxConnections': 1
                }));
                await getBody(await request(client, '/ok', {
                    'concurrency': 1,
                    'maxConnections': 2
                }));
                NodeAssert.strictEqual(sessions.active.size, 2);
            }
            finally {

                client.close();
            }

            await waitForResourceCount(sessions, 0);
            NodeAssert.strictEqual(server.activeSockets, 0);
        }
    );
});
