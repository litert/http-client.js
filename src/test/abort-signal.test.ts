/* eslint-disable */

import * as NodeAssert from 'node:assert';
import * as NodeHttp2 from 'node:http2';
import * as NodeNet from 'node:net';
import * as NodeTest from 'node:test';
import * as Http from '../lib';
import {
    ABORT_CYCLES,
    abortBatch,
    assertAborted,
    assertProbe,
    CONNECTION_LIMIT,
    createAbortBatch,
    PROBE_BODY,
    waitForHttp1Requests,
    waitForHttp2Streams
} from './TestUtils/AbortSignal';
import { createTestClient } from './TestUtils/Http';
import {
    addTrackedResource,
    createResourceTracker,
    removeTrackedResource,
    startHttp1Server,
    startHttp2Server,
    waitForResourceCount
} from './TestUtils/Server';

NodeTest.describe('AbortSignal connection pool recovery', {
    'concurrency': false,
    'timeout': 30_000
}, () => {

    NodeTest.it(
        'B-F-00001: [BUG] Should repeatedly abort a saturated HTTP/1.1 pool and recover',
        async () => {

            const sockets = createResourceTracker<NodeNet.Socket>();
            const testServer = await startHttp1Server((request, response) => {

                request.on('error', () => undefined);
                request.resume();

                if (request.url?.startsWith('/probe')) {

                    response.writeHead(NodeHttp2.constants.HTTP_STATUS_OK, {
                        'content-length': Buffer.byteLength(PROBE_BODY)
                    });
                    response.end(PROBE_BODY);
                }
            });
            const client = createTestClient();

            testServer.server.on('connection', (socket) => {

                addTrackedResource(sockets, socket);
                socket.once('close', () => removeTrackedResource(sockets, socket));
            });

            try {

                for (let cycle = 0; cycle < ABORT_CYCLES; cycle++) {

                    const filled = waitForHttp1Requests(
                        testServer.server,
                        CONNECTION_LIMIT
                    );
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

                const waiting = waitForHttp1Requests(testServer.server, 1);
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
            finally {

                await testServer.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-F-00002: [BUG] Should repeatedly abort a saturated HTTP/2 pool and recover',
        async () => {

            const sessions = createResourceTracker<NodeHttp2.ServerHttp2Session>();
            const streams = createResourceTracker<NodeHttp2.ServerHttp2Stream>();
            const testServer = await startHttp2Server((serverStream, headers) => {
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
            const client = createTestClient();

            testServer.server.on('session', (session) => {

                addTrackedResource(sessions, session);
                session.once('close', () => {

                    removeTrackedResource(sessions, session);
                });
            });

            try {

                for (let cycle = 0; cycle < ABORT_CYCLES; cycle++) {

                    const filled = waitForHttp2Streams(
                        testServer.server,
                        CONNECTION_LIMIT
                    );
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

                const waiting = waitForHttp2Streams(testServer.server, 1);
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
            finally {

                await testServer.close();
                client.close();
            }
        }
    );
});
