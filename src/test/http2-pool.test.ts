/* eslint-disable */

import * as NodeAssert from 'node:assert';
import * as NodeNet from 'node:net';
import * as NodeTest from 'node:test';
import * as Http from '../lib';
import { reserveUnusedPort } from './TestUtils/Dispatch';
import { createTestClient, getResponseBody } from './TestUtils/Http';
import {
    HTTP2_OK_BODY,
    Http2PoolTestServer,
    SATURATED_REQUEST_COUNT
} from './TestUtils/Http2Pool';
import {
    LOOPBACK_ADDRESS,
    sendHttp2Response,
    startHttp2Server,
    startTcpServer,
    TEST_TIMEOUT,
    TLS_CA,
    TLS_HOSTNAME
} from './TestUtils/Server';

NodeTest.describe('HTTP/2 connection pool', {
    'concurrency': false,
    'timeout': 30_000
}, () => {

    NodeTest.it(
        'B-M-00001: Should reuse one session for sequential requests',
        async () => {

            const server = await Http2PoolTestServer.start();
            const client = createTestClient();
            const limits = { 'concurrency': 2, 'maxConnections': 2 };

            try {

                NodeAssert.strictEqual(
                    await getResponseBody(await server.request(
                        client,
                        '/ok',
                        limits
                    )),
                    HTTP2_OK_BODY
                );
                NodeAssert.strictEqual(
                    await getResponseBody(await server.request(
                        client,
                        '/ok',
                        limits
                    )),
                    HTTP2_OK_BODY
                );
                NodeAssert.strictEqual(server.sessionsCreated, 1);
                NodeAssert.strictEqual(server.sessions.active.size, 1);
            }
            finally {

                await server.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-E-00001: Should enforce connection and stream concurrency limits',
        async () => {

            const server = await Http2PoolTestServer.start();
            const client = createTestClient();
            const limits = { 'concurrency': 2, 'maxConnections': 2 };

            try {

                const pending = Array.from(
                    { 'length': SATURATED_REQUEST_COUNT },
                    (_, index) => server.request(
                        client,
                        `/hold/${index}`,
                        limits
                    )
                );

                await server.waitForHoldRequests(
                    limits.concurrency * limits.maxConnections
                );
                NodeAssert.strictEqual(server.heldStreams.size, 4);
                NodeAssert.strictEqual(server.sessions.active.size, 2);
                NodeAssert.ok(server.streams.peak <= 4);

                server.releaseHeldStreams();
                const completed = await Promise.all(
                    pending.slice(0, 4).map(async (response) => (
                        getResponseBody(await response)
                    ))
                );

                await server.waitForHoldRequests(SATURATED_REQUEST_COUNT);
                server.releaseHeldStreams();

                NodeAssert.deepStrictEqual(
                    [
                        ...completed,
                        ...await Promise.all(
                            pending.slice(4).map(async (response) => (
                                getResponseBody(await response)
                            ))
                        )
                    ],
                    Array(SATURATED_REQUEST_COUNT).fill(HTTP2_OK_BODY)
                );
                await server.waitForStreamCount(0);
                NodeAssert.ok(
                    server.sessions.peak <= limits.maxConnections
                );
            }
            finally {

                await server.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-E-00002: Should isolate pools that use different limits',
        async () => {

            const server = await Http2PoolTestServer.start();
            const client = createTestClient();

            try {

                const first = server.request(client, '/hold/first', {
                    'concurrency': 1,
                    'maxConnections': 1
                });

                await server.waitForHoldRequests(1);

                const second = server.request(client, '/hold/second', {
                    'concurrency': 1,
                    'maxConnections': 2
                });

                await server.waitForHoldRequests(2);
                NodeAssert.strictEqual(server.sessions.active.size, 2);

                server.releaseHeldStreams();
                NodeAssert.deepStrictEqual(
                    await Promise.all([first, second].map(async (response) => (
                        getResponseBody(await response)
                    ))),
                    [HTTP2_OK_BODY, HTTP2_OK_BODY]
                );
            }
            finally {

                await server.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-E-00003: Should normalize non-positive pool limits to one',
        async () => {

            const server = await Http2PoolTestServer.start();
            const client = createTestClient();
            const limits = { 'concurrency': 0, 'maxConnections': 0 };

            try {

                const first = server.request(client, '/hold/first', limits);
                const second = server.request(client, '/hold/second', limits);

                await server.waitForHoldRequests(1);
                NodeAssert.strictEqual(server.sessions.active.size, 1);
                NodeAssert.strictEqual(server.heldStreams.size, 1);

                server.releaseHeldStreams();
                const firstBody = await getResponseBody(await first);

                await server.waitForHoldRequests(2);
                server.releaseHeldStreams();

                NodeAssert.deepStrictEqual(
                    [firstBody, await getResponseBody(await second)],
                    [HTTP2_OK_BODY, HTTP2_OK_BODY]
                );
            }
            finally {

                await server.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-F-00001: Should reject a pre-aborted request without opening a session',
        async () => {

            const server = await Http2PoolTestServer.start();
            const client = createTestClient();
            const controller = new AbortController();
            const reason = new Error('Already canceled.');

            controller.abort(reason);

            try {

                await NodeAssert.rejects(client.request({
                    'method': 'GET',
                    'url': server.url('/ok'),
                    'version': Http.EVersion.HTTP_2,
                    'signal': controller.signal
                }), (error: unknown): boolean => {

                    NodeAssert.ok(error instanceof Http.E_ABORTED);
                    NodeAssert.strictEqual(error.origin, reason);
                    return true;
                });

                NodeAssert.strictEqual(server.sessionsCreated, 0);
            }
            finally {

                await server.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-F-00002: Should abort a request while its TLS connection is pending',
        async () => {

            let acceptedSocket: NodeNet.Socket | undefined;
            let acceptConnection: (() => void) | undefined;
            let confirmClosed: (() => void) | undefined;
            const accepted = new Promise<void>((resolve) => {

                acceptConnection = resolve;
            });
            const closed = new Promise<void>((resolve) => {

                confirmClosed = resolve;
            });
            const server = await startTcpServer((socket) => {

                acceptedSocket = socket;
                socket.once('close', () => confirmClosed?.());
                socket.resume();
                acceptConnection?.();
            });
            const client = createTestClient();
            const controller = new AbortController();
            const reason = new Error('Cancel TLS setup.');

            try {

                const result = client.request({
                    'method': 'GET',
                    'url': server.url('https', '/', TLS_HOSTNAME),
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
                NodeAssert.strictEqual(acceptedSocket?.destroyed, true);
            }
            finally {

                await server.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-F-00003: Should release capacity after a stream error',
        async () => {

            const server = await Http2PoolTestServer.start();
            const client = createTestClient();
            const limits = { 'concurrency': 1, 'maxConnections': 1 };

            try {

                await NodeAssert.rejects(server.request(
                    client,
                    '/reset',
                    limits
                ));
                NodeAssert.strictEqual(
                    await getResponseBody(await server.request(
                        client,
                        '/ok',
                        limits
                    )),
                    HTTP2_OK_BODY
                );
            }
            finally {

                await server.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-F-00004: Should replace closed or failed sessions and recover',
        async () => {

            const server = await Http2PoolTestServer.start();
            const client = createTestClient();
            const limits = { 'concurrency': 1, 'maxConnections': 1 };

            try {

                await NodeAssert.rejects(server.request(
                    client,
                    '/close-session',
                    limits
                ));
                await server.waitForSessionCount(0);

                NodeAssert.strictEqual(
                    await getResponseBody(await server.request(
                        client,
                        '/ok',
                        limits
                    )),
                    HTTP2_OK_BODY
                );
                NodeAssert.strictEqual(server.sessionsCreated, 2);

                await NodeAssert.rejects(server.request(
                    client,
                    '/session-error',
                    limits
                ));
                await server.waitForSessionCount(0);

                NodeAssert.strictEqual(
                    await getResponseBody(await server.request(
                        client,
                        '/ok',
                        limits
                    )),
                    HTTP2_OK_BODY
                );
                NodeAssert.strictEqual(server.sessionsCreated, 3);
            }
            finally {

                await server.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-F-00005: Should recover after connection establishment fails',
        async () => {

            const port = await reserveUnusedPort();
            const client = createTestClient();
            const requestOptions: Http.IRequestOptionsInput = {
                'method': 'GET',
                'url': `http://${LOOPBACK_ADDRESS}:${port}/ok`,
                'version': Http.EVersion.HTTP_2,
                'concurrency': 1,
                'maxConnections': 1,
                'timeout': TEST_TIMEOUT
            };
            let recoveryServer: Awaited<ReturnType<typeof startHttp2Server>> |
                undefined;

            try {

                await NodeAssert.rejects(client.request(requestOptions));

                recoveryServer = await startHttp2Server(
                    (stream) => sendHttp2Response(stream, HTTP2_OK_BODY),
                    port
                );

                NodeAssert.strictEqual(
                    await getResponseBody(await client.request(requestOptions)),
                    HTTP2_OK_BODY
                );
            }
            finally {

                await recoveryServer?.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-M-00002: Should destroy every pooled session when the client closes',
        async () => {

            const server = await Http2PoolTestServer.start();
            const client = createTestClient();

            try {

                await getResponseBody(await server.request(client, '/ok', {
                    'concurrency': 1,
                    'maxConnections': 1
                }));
                await getResponseBody(await server.request(client, '/ok', {
                    'concurrency': 1,
                    'maxConnections': 2
                }));
                NodeAssert.strictEqual(server.sessions.active.size, 2);

                client.close();
                await server.waitForSessionCount(0);

                NodeAssert.strictEqual(server.activeSockets, 0);
            }
            finally {

                await server.close();
                client.close();
            }
        }
    );
});
