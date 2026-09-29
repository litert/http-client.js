/* eslint-disable */

import * as NodeAssert from 'node:assert';
import * as NodeEvents from 'node:events';
import * as NodeHttp2 from 'node:http2';
import { Readable } from 'node:stream';
import * as NodeTest from 'node:test';
import * as NodeTls from 'node:tls';
import * as NodeZlib from 'node:zlib';
import * as Http from '../lib';
import { createTestClient, readStream } from './TestUtils/Http';
import {
    LOOPBACK_ADDRESS,
    startHttp1Server,
    startHttp2CompatibilityServer,
    startHttps1Server,
    startSecureHttp2CompatibilityServer,
    TEST_TIMEOUT,
    TLS_CA,
    TLS_CERT,
    TLS_HOSTNAME,
    TLS_KEY
} from './TestUtils/Server';

const BASELINE_BODY = 'hello world!';

NodeTest.describe('HTTP client public baseline', {
    'concurrency': false,
    'timeout': 30_000
}, () => {

    NodeTest.it(
        'B-M-00001: Should send HTTP/1.1 requests with structured URL and remoteHost',
        async () => {

            const server = await startHttp1Server((request, response) => {

                response.setHeader('x-request-host', request.headers.host ?? '');
                request.pipe(response);
            });
            const client = createTestClient();

            try {

                const response = await client.request({
                    'method': 'POST',
                    'url': {
                        'protocol': 'http',
                        'hostname': 'virtual.local',
                        'pathname': '/echo',
                        'port': server.port,
                        'query': { 'source': 'baseline' }
                    },
                    'data': BASELINE_BODY,
                    'connectionOptions': {
                        'remoteHost': LOOPBACK_ADDRESS
                    }
                });

                NodeAssert.strictEqual(response.protocol, Http.EProtocol.HTTP_1);
                NodeAssert.strictEqual(
                    response.headers['x-request-host'],
                    `virtual.local:${server.port}`
                );
                NodeAssert.strictEqual(
                    (await response.getBuffer()).toString(),
                    BASELINE_BODY
                );
            }
            finally {

                await server.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-M-00002: Should send cleartext HTTP/2 and decode gzip and deflate',
        async () => {

            const server = await startHttp2CompatibilityServer(
                (request, response) => {

                    const gzip = request.url === '/gzip';

                    response.writeHead(NodeHttp2.constants.HTTP_STATUS_OK, {
                        'content-encoding': gzip ? 'gzip' : 'deflate'
                    });
                    Readable.from([BASELINE_BODY])
                        .pipe(gzip ? NodeZlib.createGzip() :
                            NodeZlib.createDeflate())
                        .pipe(response);
                }
            );
            const client = createTestClient();

            try {

                for (const pathname of ['/gzip', '/deflate']) {

                    const response = await client.request({
                        'method': 'GET',
                        'url': server.url('http', pathname),
                        'version': Http.EVersion.HTTP_2
                    });

                    NodeAssert.strictEqual(
                        response.protocol,
                        Http.EProtocol.HTTP_2
                    );
                    NodeAssert.strictEqual(
                        (await response.getBuffer()).toString(),
                        BASELINE_BODY
                    );
                }
            }
            finally {

                await server.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-M-00003: Should send explicit HTTPS/1.1 and HTTPS/2 requests',
        async () => {

            const tls = { 'cert': TLS_CERT, 'key': TLS_KEY };
            const http1Server = await startHttps1Server(
                tls,
                (_request, response) => response.end(BASELINE_BODY)
            );
            const http2Server = await startSecureHttp2CompatibilityServer(
                { ...tls, 'allowHTTP1': true },
                (_request, response) => response.end(BASELINE_BODY)
            );
            const client = createTestClient();
            const common = {
                'method': 'GET' as const,
                'ca': TLS_CA,
                'connectionOptions': {
                    'remoteHost': LOOPBACK_ADDRESS
                }
            };

            try {

                const h1 = await client.request({
                    ...common,
                    'url': http1Server.url('https', '/', TLS_HOSTNAME),
                    'version': Http.EVersion.HTTP_1_1
                });
                const h2 = await client.request({
                    ...common,
                    'url': http2Server.url('https', '/', TLS_HOSTNAME),
                    'version': Http.EVersion.HTTP_2
                });

                NodeAssert.strictEqual(h1.protocol, Http.EProtocol.HTTPS_1);
                NodeAssert.strictEqual(h2.protocol, Http.EProtocol.HTTPS_2);
                NodeAssert.strictEqual(
                    (await h1.getBuffer()).toString(),
                    BASELINE_BODY
                );
                NodeAssert.strictEqual(
                    (await h2.getBuffer()).toString(),
                    BASELINE_BODY
                );
            }
            finally {

                await Promise.all([http1Server.close(), http2Server.close()]);
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-M-00004: Should auto-detect and cache HTTP/2 through ALPN',
        async () => {

            const server = await startSecureHttp2CompatibilityServer({
                'allowHTTP1': true,
                'cert': TLS_CERT,
                'key': TLS_KEY
            }, (_request, response) => response.end(BASELINE_BODY));
            const client = createTestClient();

            try {

                for (let attempt = 0; attempt < 2; attempt++) {

                    const response = await client.request({
                        'method': 'GET',
                        'url': server.url('https', '/', TLS_HOSTNAME),
                        'version': Http.EVersion.ALPN,
                        'ca': TLS_CA,
                        'connectionOptions': {
                            'remoteHost': LOOPBACK_ADDRESS
                        }
                    });

                    NodeAssert.strictEqual(
                        response.protocol,
                        Http.EProtocol.HTTPS_2
                    );
                    NodeAssert.strictEqual(
                        (await response.getBuffer()).toString(),
                        BASELINE_BODY
                    );
                }
            }
            finally {

                await server.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-M-00005: Should auto-detect and cache HTTP/1.1 through ALPN',
        async () => {

            const server = await startHttps1Server({
                'cert': TLS_CERT,
                'key': TLS_KEY
            }, (_request, response) => response.end(BASELINE_BODY));
            const values = new Map<string, unknown>();
            let writes = 0;
            const client = Http.createHttpClient({
                'kvCache': {
                    'get': (key) => values.get(key),
                    'remove': (key) => values.delete(key),
                    'set': (key, value) => {

                        writes++;
                        values.set(key, value);
                    }
                }
            });

            try {

                for (let attempt = 0; attempt < 2; attempt++) {

                    const response = await client.request({
                        'method': 'GET',
                        'url': server.url('https', '/', TLS_HOSTNAME),
                        'version': Http.EVersion.ALPN,
                        'ca': TLS_CA,
                        'connectionOptions': {
                            'remoteHost': LOOPBACK_ADDRESS
                        }
                    });

                    NodeAssert.strictEqual(
                        response.protocol,
                        Http.EProtocol.HTTPS_1
                    );
                    NodeAssert.strictEqual(
                        (await response.getBuffer()).toString(),
                        BASELINE_BODY
                    );
                }

                NodeAssert.strictEqual(writes, 1);
            }
            finally {

                await server.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-M-00006: Should hand a negotiated ALPN socket to an HTTP/2 session',
        async () => {

            const server = await startSecureHttp2CompatibilityServer({
                'allowHTTP1': true,
                'cert': TLS_CERT,
                'key': TLS_KEY
            }, (_request, response) => response.end(BASELINE_BODY));
            const socket = NodeTls.connect({
                'host': LOOPBACK_ADDRESS,
                'port': server.port,
                'servername': TLS_HOSTNAME,
                'ca': TLS_CA,
                'ALPNProtocols': ['h2']
            });
            let session: NodeHttp2.ClientHttp2Session | undefined;

            try {

                await NodeEvents.once(socket, 'secureConnect', {
                    'signal': AbortSignal.timeout(TEST_TIMEOUT)
                });
                NodeAssert.strictEqual(socket.alpnProtocol, 'h2');

                session = NodeHttp2.connect(
                    server.url('https', '/', TLS_HOSTNAME),
                    { 'createConnection': () => socket }
                );

                await NodeEvents.once(session, 'connect', {
                    'signal': AbortSignal.timeout(TEST_TIMEOUT)
                });

                const request = session.request({
                    [NodeHttp2.constants.HTTP2_HEADER_PATH]: '/'
                });

                request.end();
                NodeAssert.strictEqual(
                    await readStream(request),
                    BASELINE_BODY
                );
            }
            finally {

                session?.destroy();
                socket.destroy();
                await server.close();
            }
        }
    );
});
