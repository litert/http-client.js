/* eslint-disable */

import * as NodeAssert from 'node:assert';
import * as NodeEvents from 'node:events';
import * as NodeHttp2 from 'node:http2';
import * as NodeNet from 'node:net';
import * as NodeTest from 'node:test';
import * as Http from '../lib';
import {
    createTestClient,
    getResponseBody
} from './TestUtils/Http';
import {
    LOOPBACK_ADDRESS,
    sendHttp2Response,
    startHttp1Server,
    startHttp2Server,
    startSecureHttp2Server,
    startTcpServer,
    TEST_TIMEOUT,
    TLS_CA,
    TLS_CERT,
    TLS_HOSTNAME,
    TLS_KEY
} from './TestUtils/Server';

const ALTERNATE_LOOPBACK_ADDRESS = '127.0.0.2';
const RESPONSE_BODY = 'ok';

NodeTest.describe('HTTP client request normalization', {
    'concurrency': false,
    'timeout': 30_000
}, () => {

    NodeTest.it(
        'B-E-00001: [BUG] Should omit an empty query delimiter and include a non-default HTTP/1.1 port',
        async () => {

            let receivedHost = '';
            let receivedUrl = '';
            const testServer = await startHttp1Server((request, response) => {

                receivedHost = request.headers.host ?? '';
                receivedUrl = request.url ?? '';
                response.end(RESPONSE_BODY);
            });
            const client = createTestClient();

            try {

                const response = await client.request({
                    'method': 'GET',
                    'url': testServer.url('http', '/path')
                });

                NodeAssert.strictEqual(
                    await getResponseBody(response),
                    RESPONSE_BODY
                );
                NodeAssert.strictEqual(receivedUrl, '/path');
                NodeAssert.strictEqual(
                    receivedHost,
                    `${LOOPBACK_ADDRESS}:${testServer.port}`
                );
            }
            finally {

                await testServer.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-E-00002: [BUG] Should apply the default port to a structured URL without mutating it',
        async () => {

            const expected = new Error('Stop after normalization.');
            const client = createTestClient();
            const url: Http.IUrl = {
                'protocol': 'http',
                'hostname': 'example.test',
                'pathname': '/'
            };
            let normalizedPort: number | undefined;

            try {

                client.filters.register({
                    'name': 'pre_request',
                    'key': 'observe-default-port',
                    'callback': (opts) => {

                        normalizedPort = opts.url.port;
                        throw expected;
                    }
                });

                await NodeAssert.rejects(client.request({
                    'method': 'GET',
                    url
                }), (error: unknown): boolean => error === expected);

                NodeAssert.strictEqual(normalizedPort, Http.DEFAULT_HTTP_PORT);
                NodeAssert.strictEqual(url.port, undefined);
            }
            finally {

                client.close();
            }
        }
    );

    NodeTest.it(
        'B-F-00001: [BUG] Should reject a non-HTTP URL protocol',
        async () => {

            const client = createTestClient();

            try {

                await NodeAssert.rejects(client.request({
                    'method': 'GET',
                    'url': `ftp://${LOOPBACK_ADDRESS}/`
                }), Http.E_PROTOCOL_NOT_SUPPORTED);
            }
            finally {

                client.close();
            }
        }
    );

    NodeTest.it(
        'B-E-00003: [BUG] Should preserve caller-owned request options',
        async () => {

            const testServer = await startHttp2Server((stream) => {

                stream.resume();
                sendHttp2Response(stream, RESPONSE_BODY);
            });
            const client = createTestClient();
            const requestOptions: Http.IRequestOptionsInput = {
                'method': 'POST',
                'url': {
                    'protocol': 'http',
                    'hostname': 'virtual.test',
                    'pathname': '/',
                    'port': testServer.port
                },
                'version': Http.EVersion.HTTP_2,
                'connectionOptions': {
                    'remoteHost': LOOPBACK_ADDRESS
                }
            };
            const expected = structuredClone(requestOptions);

            try {

                const response = await client.request(requestOptions);

                NodeAssert.strictEqual(
                    await getResponseBody(response),
                    RESPONSE_BODY
                );
                NodeAssert.deepStrictEqual(requestOptions, expected);
            }
            finally {

                await testServer.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-M-00001: [BUG] Should include a non-default port in HTTP/2 authority',
        async () => {

            let receivedAuthority = '';
            const testServer = await startHttp2Server((stream, headers) => {

                receivedAuthority = String(
                    headers[NodeHttp2.constants.HTTP2_HEADER_AUTHORITY]
                );
                sendHttp2Response(stream, RESPONSE_BODY);
            });
            const client = createTestClient();

            try {

                const response = await client.request({
                    'method': 'GET',
                    'url': testServer.url('http'),
                    'version': Http.EVersion.HTTP_2
                });

                NodeAssert.strictEqual(
                    await getResponseBody(response),
                    RESPONSE_BODY
                );
                NodeAssert.strictEqual(
                    receivedAuthority,
                    `${LOOPBACK_ADDRESS}:${testServer.port}`
                );
            }
            finally {

                await testServer.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-F-00002: [BUG] Should isolate HTTP/2 pools by physical remote host',
        async () => {

            const serverA = await startHttp2Server((stream, headers) => {

                if (headers[NodeHttp2.constants.HTTP2_HEADER_PATH] === '/hold') {

                    stream.respond({
                        [NodeHttp2.constants.HTTP2_HEADER_STATUS]:
                            NodeHttp2.constants.HTTP_STATUS_OK
                    });
                    stream.write('held');
                    return;
                }

                sendHttp2Response(stream, 'server-a');
            });
            const serverB = await startHttp2Server(
                (stream) => sendHttp2Response(stream, 'server-b'),
                serverA.port,
                ALTERNATE_LOOPBACK_ADDRESS
            );
            const client = createTestClient();
            const url: Http.IUrl = {
                'protocol': 'http',
                'hostname': 'virtual.test',
                'pathname': '/hold',
                'port': serverA.port
            };

            try {

                const first = await client.request({
                    'method': 'GET',
                    url,
                    'version': Http.EVersion.HTTP_2,
                    'concurrency': 2,
                    'connectionOptions': {
                        'remoteHost': LOOPBACK_ADDRESS
                    }
                });
                const second = await client.request({
                    'method': 'GET',
                    'url': {
                        ...url,
                        'pathname': '/probe'
                    },
                    'version': Http.EVersion.HTTP_2,
                    'concurrency': 2,
                    'connectionOptions': {
                        'remoteHost': ALTERNATE_LOOPBACK_ADDRESS
                    }
                });

                NodeAssert.strictEqual(
                    await getResponseBody(second),
                    'server-b'
                );
                first.abort();
            }
            finally {

                await Promise.all([serverA.close(), serverB.close()]);
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-M-00002: [BUG] Should reuse the ALPN-negotiated socket for the first HTTP/2 request',
        async () => {

            let connections = 0;
            const testServer = await startSecureHttp2Server({
                'allowHTTP1': true,
                'cert': TLS_CERT,
                'key': TLS_KEY
            }, (stream) => sendHttp2Response(stream, RESPONSE_BODY));

            testServer.server.on('connection', (_socket: NodeNet.Socket) => {

                connections++;
            });
            const client = createTestClient();

            try {

                const response = await client.request({
                    'method': 'GET',
                    'url': testServer.url('https', '/', TLS_HOSTNAME),
                    'version': Http.EVersion.ALPN,
                    'ca': TLS_CA,
                    'connectionOptions': {
                        'remoteHost': LOOPBACK_ADDRESS
                    }
                });

                NodeAssert.strictEqual(
                    await getResponseBody(response),
                    RESPONSE_BODY
                );
                NodeAssert.strictEqual(connections, 1);
            }
            finally {

                await testServer.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-F-00003: [BUG] Should abort an ALPN request during TLS negotiation',
        async () => {

            let acceptedSocket: NodeNet.Socket | undefined;
            let acceptConnection: (() => void) | undefined;
            const accepted = new Promise<void>((resolve) => {

                acceptConnection = resolve;
            });
            const testServer = await startTcpServer((socket) => {

                acceptedSocket = socket;
                acceptConnection?.();
            });
            const client = createTestClient();
            const controller = new AbortController();
            const reason = new Error('Cancel ALPN negotiation.');

            try {

                const pending = client.request({
                    'method': 'GET',
                    'url': testServer.url('https', '/', TLS_HOSTNAME),
                    'version': Http.EVersion.ALPN,
                    'signal': controller.signal,
                    'connectionOptions': {
                        'remoteHost': LOOPBACK_ADDRESS
                    }
                });

                await accepted;
                controller.abort(reason);

                await NodeAssert.rejects(pending, (error: unknown): boolean => {

                    NodeAssert.ok(error instanceof Http.E_ABORTED);
                    NodeAssert.strictEqual(error.origin, reason);
                    return true;
                });

                await NodeEvents.once(acceptedSocket!, 'close', {
                    'signal': AbortSignal.timeout(TEST_TIMEOUT)
                });
            }
            finally {

                await testServer.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-M-00003: Should preserve repeated query values and encoding flags',
        async () => {

            const observed: Array<[string, string]> = [];
            const testServer = await startHttp1Server((request, response) => {

                observed.push([
                    request.url ?? '',
                    String(request.headers['accept-encoding'] ?? '')
                ]);
                response.end(RESPONSE_BODY);
            });
            const client = createTestClient();
            const cases = [
                [true, false, 'gzip'],
                [false, true, 'deflate'],
                [false, false, '']
            ] as const;

            try {

                for (const [gzip, deflate] of cases) {

                    const response = await client.request({
                        'method': 'GET',
                        'url': {
                            'protocol': 'http',
                            'hostname': LOOPBACK_ADDRESS,
                            'pathname': '/query',
                            'port': testServer.port,
                            'query': {
                                'tag': ['first value', 'second']
                            }
                        },
                        gzip,
                        deflate
                    });

                    NodeAssert.strictEqual(
                        await getResponseBody(response),
                        RESPONSE_BODY
                    );
                }

                for (let index = 0; index < cases.length; index++) {

                    NodeAssert.strictEqual(
                        observed[index][0],
                        '/query?tag=first%20value&tag=second'
                    );
                    NodeAssert.strictEqual(
                        observed[index][1],
                        cases[index][2]
                    );
                }
            }
            finally {

                await testServer.close();
                client.close();
            }
        }
    );
});
