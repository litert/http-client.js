/* eslint-disable */

import * as NodeAssert from 'node:assert';
import { EventEmitter } from 'node:events';
import * as NodeHttp2 from 'node:http2';
import { Readable } from 'node:stream';
import * as NodeTest from 'node:test';
import * as NodeZlib from 'node:zlib';
import * as Http from '../lib';
import { HttpHelper } from '../lib/Internal/Helper';
import { createResponsePromise } from '../lib/Internal/Http2Response';
import { createTestClient, getResponseBody, readStream } from './TestUtils/Http';
import {
    createResponseRequestOptions,
    createTestResponse,
    REQUEST_TIMEOUT,
    RESPONSE_BODY,
    TEST_GUARD_TIMEOUT
} from './TestUtils/ResponseLifecycle';
import {
    sendHttp2Response,
    startHttp1Server,
    startHttp2Server
} from './TestUtils/Server';

NodeTest.describe('Response and timeout lifecycle', {
    'concurrency': false,
    'timeout': 30_000
}, () => {

    NodeTest.it(
        'B-M-00001: [BUG] Should expose a TRACE response entity',
        async () => {

            const server = await startHttp1Server((_request, response) => {

                response.end(RESPONSE_BODY);
            });
            const client = createTestClient();

            try {

                const response = await client.request({
                    'method': 'TRACE',
                    'url': server.url('http')
                });

                NodeAssert.strictEqual(
                    await getResponseBody(response),
                    RESPONSE_BODY
                );
            }
            finally {

                await server.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-E-00001: [BUG] Should reject stream access for a 304 response',
        async () => {

            const server = await startHttp1Server((_request, response) => {

                response.writeHead(NodeHttp2.constants.HTTP_STATUS_NOT_MODIFIED);
                response.end();
            });
            const client = createTestClient();

            try {

                const response = await client.request({
                    'method': 'GET',
                    'url': server.url('http')
                });

                NodeAssert.throws(
                    () => response.getRawStream(),
                    Http.E_NO_RESPONSE_ENTITY
                );
                NodeAssert.strictEqual(
                    (await response.getBuffer()).byteLength,
                    0
                );
            }
            finally {

                await server.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'W-F-00001: [BUG] Should relinquish HTTP/2 error listener ownership after headers',
        async () => {

            const request = new EventEmitter() as
                NodeHttp2.ClientHttp2Stream;
            let releases = 0;

            const response = createResponsePromise({
                'clientOptions': createResponseRequestOptions(),
                'helper': new HttpHelper(),
                'releaseConnection': () => {

                    releases++;
                },
                request
            });

            request.emit('response', {
                [NodeHttp2.constants.HTTP2_HEADER_STATUS]:
                    NodeHttp2.constants.HTTP_STATUS_OK
            });

            await response;
            NodeAssert.strictEqual(request.listenerCount('error'), 0);

            request.emit('close');
            NodeAssert.strictEqual(releases, 1);
        }
    );

    NodeTest.it(
        'W-M-00001: Should expose metadata and classify every response range',
        () => {

            const cases = [
                [100, 'isContinue'],
                [101, 'isUpgrade'],
                [200, 'isSuccess'],
                [299, 'isSuccess'],
                [300, 'isRedirection'],
                [399, 'isRedirection'],
                [400, 'isClientError'],
                [499, 'isClientError'],
                [500, 'isServerError'],
                [599, 'isServerError']
            ] as const;

            for (const [statusCode, predicate] of cases) {

                const response = createTestResponse(statusCode);

                NodeAssert.strictEqual(response[predicate](), true);
                NodeAssert.strictEqual(response.statusCode, statusCode);
                NodeAssert.strictEqual(response.protocol, Http.EProtocol.HTTP_1);
                NodeAssert.strictEqual(
                    response.contentLength,
                    Buffer.byteLength(RESPONSE_BODY)
                );
            }

            const headers = { 'x-test': 'value' };
            const response = createTestResponse(
                700,
                Readable.from([RESPONSE_BODY]),
                headers
            );

            NodeAssert.strictEqual(response.headers, headers);
            NodeAssert.strictEqual(response.isSuccess(), false);
            NodeAssert.strictEqual(response.isRedirection(), false);
            NodeAssert.strictEqual(response.isClientError(), false);
            NodeAssert.strictEqual(response.isServerError(), false);
            NodeAssert.strictEqual(response.isContinue(), false);
            NodeAssert.strictEqual(response.isUpgrade(), false);
            NodeAssert.strictEqual(response.getRawStream() instanceof Readable, true);
        }
    );

    NodeTest.it(
        'W-F-00002: Should preserve a response stream error for every accessor',
        async () => {

            for (const accessor of ['buffer', 'stream', 'raw'] as const) {

                const stream = new Readable({
                    'read': () => undefined
                });
                const response = createTestResponse(200, stream);
                const expected = new Error(`Failed ${accessor}.`);

                stream.emit('error', expected);

                if (accessor === 'buffer') {

                    await NodeAssert.rejects(response.getBuffer(), (error) =>
                        error === expected);
                }
                else if (accessor === 'stream') {

                    NodeAssert.throws(() => response.getStream(), (error) =>
                        error === expected);
                }
                else {

                    NodeAssert.throws(() => response.getRawStream(), (error) =>
                        error === expected);
                }
            }
        }
    );

    NodeTest.it(
        'W-M-00002: Should decode gzip and deflate streams through getStream',
        async () => {

            const cases = [
                ['gzip', NodeZlib.gzipSync(RESPONSE_BODY)],
                ['deflate', NodeZlib.deflateSync(RESPONSE_BODY)]
            ] as const;

            for (const [encoding, body] of cases) {

                const response = createTestResponse(
                    200,
                    Readable.from([body]),
                    { 'content-encoding': encoding }
                );

                NodeAssert.strictEqual(
                    await readStream(response.getStream()),
                    RESPONSE_BODY
                );
            }
        }
    );

    NodeTest.it(
        'W-F-00003: Should reject errors and limits while buffering decoded data',
        async () => {

            const oversized = createTestResponse(
                200,
                Readable.from([NodeZlib.gzipSync(RESPONSE_BODY)]),
                { 'content-encoding': 'gzip' }
            );

            await NodeAssert.rejects(
                oversized.getBuffer(1),
                Http.E_TOO_LARGE_RESPONSE_ENTITY
            );

            const expected = new Error('Response stream failed.');
            const failing = createTestResponse(200, new Readable({
                'read': function(): void {

                    this.destroy(expected);
                }
            }));

            await NodeAssert.rejects(failing.getBuffer(), (error) =>
                error === expected);
        }
    );

    NodeTest.it(
        'B-F-00001: [BUG] Should time out and recover HTTP/1.1 capacity',
        async () => {

            const server = await startHttp1Server((request, response) => {

                request.on('error', () => undefined);

                if (request.url === '/ok') {

                    response.end(RESPONSE_BODY);
                }
            });
            const client = createTestClient();
            const common = {
                'method': 'GET' as const,
                'version': Http.EVersion.HTTP_1_1,
                'maxConnections': 1,
                'concurrency': 1,
                'timeout': REQUEST_TIMEOUT
            };

            try {

                await NodeAssert.rejects(client.request({
                    ...common,
                    'url': server.url('http', '/hold'),
                    'signal': AbortSignal.timeout(TEST_GUARD_TIMEOUT)
                }), Http.E_REQUEST_TIMEOUT);

                const response = await client.request({
                    ...common,
                    'url': server.url('http', '/ok'),
                    'timeout': TEST_GUARD_TIMEOUT
                });

                NodeAssert.strictEqual(
                    await getResponseBody(response),
                    RESPONSE_BODY
                );
            }
            finally {

                await server.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-F-00002: [BUG] Should time out and recover HTTP/2 capacity',
        async () => {

            const server = await startHttp2Server((stream, headers) => {

                stream.on('error', () => undefined);

                if (headers[NodeHttp2.constants.HTTP2_HEADER_PATH] === '/ok') {

                    sendHttp2Response(stream, RESPONSE_BODY);
                }
            });
            const client = createTestClient();
            const common = {
                'method': 'GET' as const,
                'version': Http.EVersion.HTTP_2,
                'maxConnections': 1,
                'concurrency': 1,
                'timeout': REQUEST_TIMEOUT
            };

            try {

                await NodeAssert.rejects(client.request({
                    ...common,
                    'url': server.url('http', '/hold'),
                    'signal': AbortSignal.timeout(TEST_GUARD_TIMEOUT)
                }), Http.E_REQUEST_TIMEOUT);

                const response = await client.request({
                    ...common,
                    'url': server.url('http', '/ok'),
                    'timeout': TEST_GUARD_TIMEOUT
                });

                NodeAssert.strictEqual(
                    await getResponseBody(response),
                    RESPONSE_BODY
                );
            }
            finally {

                await server.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-E-00002: [BUG] Should release HTTP/1.1 capacity after zero-byte read',
        async () => {

            const server = await startHttp1Server((request, response) => {

                request.on('error', () => undefined);

                if (request.url === '/slow') {

                    response.writeHead(NodeHttp2.constants.HTTP_STATUS_OK);
                    response.write('partial');
                }
                else {

                    response.end(RESPONSE_BODY);
                }
            });
            const client = createTestClient();
            const common = {
                'method': 'GET' as const,
                'version': Http.EVersion.HTTP_1_1,
                'maxConnections': 1,
                'concurrency': 1,
                'timeout': TEST_GUARD_TIMEOUT
            };

            try {

                const abandoned = await client.request({
                    ...common,
                    'url': server.url('http', '/slow')
                });

                NodeAssert.strictEqual(
                    (await abandoned.getBuffer(0)).byteLength,
                    0
                );

                const response = await client.request({
                    ...common,
                    'url': server.url('http', '/ok'),
                    'signal': AbortSignal.timeout(TEST_GUARD_TIMEOUT)
                });

                NodeAssert.strictEqual(
                    await getResponseBody(response),
                    RESPONSE_BODY
                );
            }
            finally {

                await server.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-E-00003: [BUG] Should release HTTP/2 capacity after zero-byte read',
        async () => {

            const server = await startHttp2Server((stream, headers) => {

                stream.on('error', () => undefined);

                if (headers[NodeHttp2.constants.HTTP2_HEADER_PATH] === '/slow') {

                    stream.respond({
                        [NodeHttp2.constants.HTTP2_HEADER_STATUS]:
                            NodeHttp2.constants.HTTP_STATUS_OK
                    });
                    stream.write('partial');
                }
                else {

                    sendHttp2Response(stream, RESPONSE_BODY);
                }
            });
            const client = createTestClient();
            const common = {
                'method': 'GET' as const,
                'version': Http.EVersion.HTTP_2,
                'maxConnections': 1,
                'concurrency': 1,
                'timeout': TEST_GUARD_TIMEOUT
            };

            try {

                const abandoned = await client.request({
                    ...common,
                    'url': server.url('http', '/slow')
                });

                NodeAssert.strictEqual(
                    (await abandoned.getBuffer(0)).byteLength,
                    0
                );

                const response = await client.request({
                    ...common,
                    'url': server.url('http', '/ok'),
                    'signal': AbortSignal.timeout(TEST_GUARD_TIMEOUT)
                });

                NodeAssert.strictEqual(
                    await getResponseBody(response),
                    RESPONSE_BODY
                );
            }
            finally {

                await server.close();
                client.close();
            }
        }
    );
});
