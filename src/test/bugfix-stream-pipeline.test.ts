/* eslint-disable */

import * as NodeAssert from 'node:assert';
import * as NodeHttp2 from 'node:http2';
import { Readable } from 'node:stream';
import * as NodeTest from 'node:test';
import * as Http from '../lib';
import {
    createFailingBody,
    createPipelineOptions,
    createTestHttp1Client,
    createTestHttp2Client,
    createUnfinishedBody,
    installFakeHttp2Connection,
    ObservedRequest,
    PIPELINE_REQUEST_TIMEOUT
} from './TestUtils/StreamPipeline';
import { createTestClient, getResponseBody } from './TestUtils/Http';
import {
    sendHttp2Response,
    startHttp1Server,
    startHttp2Server
} from './TestUtils/Server';

NodeTest.describe('Request body stream pipeline regression', {
    'concurrency': false
}, () => {

    NodeTest.it(
        'B-F-00001: [BUG] Should report an HTTP/1.1 request body stream failure',
        async () => {

            const testServer = await startHttp1Server((request) => {

                request.on('error', () => undefined);
                request.resume();
            });
            const client = createTestClient();
            const sourceError = new Error('HTTP/1.1 body failed');

            try {

                await NodeAssert.rejects(client.request({
                    'method': 'POST',
                    'url': testServer.url('http'),
                    'headers': {
                        [Http.Headers.CONTENT_LENGTH_H1]: 64
                    },
                    'data': createFailingBody(sourceError),
                    'version': Http.EVersion.HTTP_1_1,
                    'timeout': PIPELINE_REQUEST_TIMEOUT
                }), (error: unknown): boolean => {

                    NodeAssert.ok(error instanceof Http.E_NETWORK_FAILED);
                    NodeAssert.strictEqual(error.origin, sourceError);

                    return true;
                });
            }
            finally {

                await testServer.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-F-00002: [BUG] Should report an HTTP/2 request body stream failure',
        async () => {

            const testServer = await startHttp2Server((stream) => {

                stream.on('error', () => undefined);
                stream.resume();
            });
            const client = createTestClient();
            const sourceError = new Error('HTTP/2 body failed');

            try {

                await NodeAssert.rejects(client.request({
                    'method': 'POST',
                    'url': testServer.url('http'),
                    'headers': {
                        [Http.Headers.CONTENT_LENGTH_H1]: 64
                    },
                    'data': createFailingBody(sourceError),
                    'version': Http.EVersion.HTTP_2,
                    'timeout': PIPELINE_REQUEST_TIMEOUT
                }), (error: unknown): boolean => {

                    NodeAssert.ok(error instanceof Http.E_NETWORK_FAILED);
                    NodeAssert.strictEqual(error.origin, sourceError);

                    return true;
                });
            }
            finally {

                await testServer.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-F-00003: [BUG] Should clean up and recover after HTTP/1.1 reset',
        async () => {

            let shouldReset = true;
            const server = await startHttp1Server((request, response) => {

                request.on('error', () => undefined);

                if (shouldReset) {

                    shouldReset = false;
                    request.once('data', () => {

                        request.socket.resetAndDestroy();
                    });
                }
                else {

                    response.end('ok');
                }

                request.resume();
            });
            const client = createTestClient();
            const body = createUnfinishedBody();

            try {

                await NodeAssert.rejects(client.request({
                    'method': 'POST',
                    'url': server.url('http'),
                    'headers': {
                        [Http.Headers.CONTENT_LENGTH_H1]: 64
                    },
                    'data': body,
                    'version': Http.EVersion.HTTP_1_1,
                    'timeout': PIPELINE_REQUEST_TIMEOUT
                }), (error: unknown): boolean => {

                    NodeAssert.ok(error instanceof Http.E_NETWORK_FAILED);
                    NodeAssert.ok(error.origin instanceof Error);
                    NodeAssert.strictEqual(
                        (error.origin as NodeJS.ErrnoException).code,
                        'ECONNRESET'
                    );

                    return true;
                });

                NodeAssert.strictEqual(body.destroyed, true);
                NodeAssert.strictEqual(body.closed, true);

                const probe = await client.request({
                    'method': 'GET',
                    'url': server.url('http'),
                    'version': Http.EVersion.HTTP_1_1,
                    'timeout': PIPELINE_REQUEST_TIMEOUT
                });

                NodeAssert.strictEqual(await getResponseBody(probe), 'ok');
            }
            finally {

                await server.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-F-00004: [BUG] Should clean up and recover after HTTP/2 reset',
        async () => {

            let shouldReset = true;
            const server = await startHttp2Server((stream) => {

                stream.on('error', () => undefined);

                if (shouldReset) {

                    shouldReset = false;
                    stream.once('data', () => stream.close(
                        NodeHttp2.constants.NGHTTP2_INTERNAL_ERROR
                    ));
                }
                else {

                    sendHttp2Response(stream, 'ok');
                }

                stream.resume();
            });
            const client = createTestClient();
            const body = createUnfinishedBody();

            try {

                await NodeAssert.rejects(client.request({
                    'method': 'POST',
                    'url': server.url('http'),
                    'headers': {
                        [Http.Headers.CONTENT_LENGTH_H1]: 64
                    },
                    'data': body,
                    'version': Http.EVersion.HTTP_2,
                    'timeout': PIPELINE_REQUEST_TIMEOUT
                }), Http.E_NETWORK_FAILED);

                NodeAssert.strictEqual(body.destroyed, true);
                NodeAssert.strictEqual(body.closed, true);

                const probe = await client.request({
                    'method': 'GET',
                    'url': server.url('http'),
                    'version': Http.EVersion.HTTP_2,
                    'timeout': PIPELINE_REQUEST_TIMEOUT
                });

                NodeAssert.strictEqual(await getResponseBody(probe), 'ok');
            }
            finally {

                await server.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'W-F-00001: [BUG] Should destroy the HTTP/1.1 request when its body stream fails',
        async () => {

            const sourceError = new Error('HTTP/1.1 body failed');
            const body = createFailingBody(sourceError);
            const request = new ObservedRequest(Http.EVersion.HTTP_1_1, false);
            const client = createTestHttp1Client();

            await NodeAssert.rejects(client.process(
                request,
                createPipelineOptions(body, Http.EVersion.HTTP_1_1)
            ), (error: unknown): boolean => {

                NodeAssert.ok(error instanceof Http.E_NETWORK_FAILED);
                NodeAssert.strictEqual(error.origin, sourceError);

                return true;
            });

            NodeAssert.strictEqual(request.destroyed, true);
            NodeAssert.strictEqual(body.destroyed, true);
            NodeAssert.strictEqual(body.closed, true);
        }
    );

    NodeTest.it(
        'W-F-00002: [BUG] Should destroy the HTTP/2 request and release its connection once',
        async () => {

            const sourceError = new Error('HTTP/2 body failed');
            const body = createFailingBody(sourceError);
            const request = new ObservedRequest(Http.EVersion.HTTP_2, false);
            const client = createTestHttp2Client();
            const connection = installFakeHttp2Connection(client, request);

            await NodeAssert.rejects(client.process(createPipelineOptions(
                body,
                Http.EVersion.HTTP_2
            )), (error: unknown): boolean => {

                NodeAssert.ok(error instanceof Http.E_NETWORK_FAILED);
                NodeAssert.strictEqual(error.origin, sourceError);

                return true;
            });

            NodeAssert.strictEqual(request.destroyed, true);
            NodeAssert.strictEqual(body.destroyed, true);
            NodeAssert.strictEqual(body.closed, true);
            NodeAssert.strictEqual(connection.concurrency, 0);
        }
    );

    NodeTest.it(
        'W-E-00001: Should retain an early HTTP/1.1 response and configure timeout before upload',
        async () => {

            const request = new ObservedRequest(Http.EVersion.HTTP_1_1, true);
            const client = createTestHttp1Client();
            const response = await client.process(
                request,
                createPipelineOptions(
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
            const client = createTestHttp2Client();
            const connection = installFakeHttp2Connection(client, request);
            const response = await client.process(createPipelineOptions(
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

    NodeTest.it(
        'W-F-00003: [BUG] Should destroy HTTP/1.1 request streams on timeout',
        async () => {

            const request = new ObservedRequest(
                Http.EVersion.HTTP_1_1,
                false,
                true
            );
            const body = createUnfinishedBody();
            const client = createTestHttp1Client();

            await NodeAssert.rejects(client.process(
                request,
                createPipelineOptions(body, Http.EVersion.HTTP_1_1)
            ), Http.E_REQUEST_TIMEOUT);

            NodeAssert.strictEqual(request.destroyed, true);
            NodeAssert.strictEqual(body.destroyed, true);
            NodeAssert.strictEqual(body.closed, true);
        }
    );

    NodeTest.it(
        'W-F-00004: [BUG] Should destroy HTTP/2 request streams on timeout',
        async () => {

            const request = new ObservedRequest(
                Http.EVersion.HTTP_2,
                false,
                true
            );
            const body = createUnfinishedBody();
            const client = createTestHttp2Client();
            const connection = installFakeHttp2Connection(client, request);

            await NodeAssert.rejects(client.process(createPipelineOptions(
                body,
                Http.EVersion.HTTP_2
            )), Http.E_REQUEST_TIMEOUT);

            NodeAssert.strictEqual(request.destroyed, true);
            NodeAssert.strictEqual(body.destroyed, true);
            NodeAssert.strictEqual(body.closed, true);
            NodeAssert.strictEqual(connection.concurrency, 0);
        }
    );
});
