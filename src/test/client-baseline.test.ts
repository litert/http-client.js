/* eslint-disable */

import * as NodeAssert from 'node:assert';
import * as NodeEvents from 'node:events';
import * as NodeHttp from 'node:http';
import * as NodeHttp2 from 'node:http2';
import * as NodeHttps from 'node:https';
import { Readable } from 'node:stream';
import * as NodeTest from 'node:test';
import * as NodeTls from 'node:tls';
import * as NodeZlib from 'node:zlib';
import * as Http from '../lib';
import {
    LOOPBACK_ADDRESS,
    TestServer,
    TEST_TIMEOUT,
    TLS_CA,
    TLS_CERT,
    TLS_HOSTNAME,
    TLS_KEY
} from './TestServer';

const BASELINE_BODY = 'hello world!';
const BASIC_PASSWORD = 'password';
const BASIC_USERNAME = 'angus';
const BEARER_CREDENTIALS = 'test-token';

type IRequest = NodeHttp.IncomingMessage | NodeHttp2.Http2ServerRequest;
type IResponse = NodeHttp.ServerResponse | NodeHttp2.Http2ServerResponse;

function handleRequest(request: IRequest, response: IResponse): void {

    request.on('error', () => undefined);

    const requestUrl = new URL(request.url ?? '/', 'http://localhost');
    const outgoing = response as unknown as NodeHttp.ServerResponse;

    outgoing.setHeader('x-request-host', request.headers.host ?? '');
    outgoing.setHeader(
        'x-request-authorization',
        request.headers.authorization ?? ''
    );
    outgoing.setHeader(
        'x-baseline-header',
        request.headers['x-baseline-header'] ?? ''
    );

    if (requestUrl.pathname.startsWith('/status/')) {

        outgoing.writeHead(Number(requestUrl.pathname.slice('/status/'.length)), {
            'content-length': 0
        });
        outgoing.end();
        return;
    }

    if (request.method === 'HEAD') {

        outgoing.writeHead(NodeHttp2.constants.HTTP_STATUS_OK, {
            'content-length': 0
        });
        outgoing.end();
        return;
    }

    if (requestUrl.pathname === '/empty') {

        outgoing.writeHead(NodeHttp2.constants.HTTP_STATUS_NO_CONTENT);
        outgoing.end();
        return;
    }

    if (requestUrl.pathname === '/echo') {

        outgoing.writeHead(NodeHttp2.constants.HTTP_STATUS_OK);
        request.pipe(outgoing);
        return;
    }

    if (requestUrl.pathname === '/gzip') {

        outgoing.writeHead(NodeHttp2.constants.HTTP_STATUS_OK, {
            'content-encoding': 'gzip'
        });
        Readable.from([BASELINE_BODY])
            .pipe(NodeZlib.createGzip())
            .pipe(outgoing);
        return;
    }

    if (requestUrl.pathname === '/deflate') {

        outgoing.writeHead(NodeHttp2.constants.HTTP_STATUS_OK, {
            'content-encoding': 'deflate'
        });
        Readable.from([BASELINE_BODY])
            .pipe(NodeZlib.createDeflate())
            .pipe(outgoing);
        return;
    }

    outgoing.writeHead(NodeHttp2.constants.HTTP_STATUS_OK, {
        'content-length': Buffer.byteLength(BASELINE_BODY),
        'content-type': 'text/plain'
    });
    outgoing.end(BASELINE_BODY);
}

async function readStream(stream: Readable): Promise<string> {

    const chunks: Buffer[] = [];

    for await (const chunk of stream) {

        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString();
}

function createClient(testContext: NodeTest.TestContext): Http.IClient {

    const client = Http.createHttpClient();

    testContext.after(() => client.close());

    return client;
}

NodeTest.describe('HTTP client public baseline', {
    'concurrency': false,
    'timeout': 30_000
}, () => {

    let http1Server: TestServer<NodeHttp.Server>;
    let http2Server: TestServer<NodeHttp2.Http2Server>;
    let https1Server: TestServer<NodeHttps.Server>;
    let https2Server: TestServer<NodeHttp2.Http2SecureServer>;

    NodeTest.before(async () => {

        http1Server = new TestServer(NodeHttp.createServer(handleRequest));
        http2Server = new TestServer(NodeHttp2.createServer(handleRequest));
        https1Server = new TestServer(NodeHttps.createServer({
            'cert': TLS_CERT,
            'key': TLS_KEY
        }, handleRequest));
        https2Server = new TestServer(NodeHttp2.createSecureServer({
            'allowHTTP1': true,
            'cert': TLS_CERT,
            'key': TLS_KEY
        }, handleRequest));

        await Promise.all([
            http1Server.listen(),
            http2Server.listen(),
            https1Server.listen(),
            https2Server.listen()
        ]);
    });

    NodeTest.after(async () => {

        await Promise.all([
            http1Server.close(),
            http2Server.close(),
            https1Server.close(),
            https2Server.close()
        ]);
    });

    NodeTest.it(
        'B-M-00001: Should send HTTP/1.1 requests with structured URL and remoteHost',
        async (testContext) => {

            const client = createClient(testContext);
            const response = await client.request({
                'method': 'POST',
                'url': {
                    'protocol': 'http',
                    'hostname': 'virtual.local',
                    'pathname': '/echo',
                    'port': http1Server.port,
                    'query': { 'source': 'baseline' }
                },
                'data': BASELINE_BODY,
                'connectionOptions': {
                    'remoteHost': LOOPBACK_ADDRESS
                }
            });

            NodeAssert.strictEqual(response.protocol, Http.EProtocol.HTTP_1);
            NodeAssert.strictEqual(response.headers['x-request-host'], 'virtual.local');
            NodeAssert.strictEqual((await response.getBuffer()).toString(), BASELINE_BODY);
        }
    );

    NodeTest.it(
        'B-M-00002: Should send cleartext HTTP/2 and decode gzip and deflate',
        async (testContext) => {

            const client = createClient(testContext);

            for (const pathname of ['/gzip', '/deflate']) {

                const response = await client.request({
                    'method': 'GET',
                    'url': http2Server.url('http', pathname),
                    'version': Http.EVersion.HTTP_2
                });

                NodeAssert.strictEqual(response.protocol, Http.EProtocol.HTTP_2);
                NodeAssert.strictEqual(
                    (await response.getBuffer()).toString(),
                    BASELINE_BODY
                );
            }
        }
    );

    NodeTest.it(
        'B-M-00003: Should send explicit HTTPS/1.1 and HTTPS/2 requests',
        async (testContext) => {

            const client = createClient(testContext);
            const common = {
                'method': 'GET' as const,
                'ca': TLS_CA,
                'connectionOptions': {
                    'remoteHost': LOOPBACK_ADDRESS
                }
            };
            const h1 = await client.request({
                ...common,
                'url': https1Server.url('https', '/', TLS_HOSTNAME),
                'version': Http.EVersion.HTTP_1_1
            });
            const h2 = await client.request({
                ...common,
                'url': https2Server.url('https', '/', TLS_HOSTNAME),
                'version': Http.EVersion.HTTP_2
            });

            NodeAssert.strictEqual(h1.protocol, Http.EProtocol.HTTPS_1);
            NodeAssert.strictEqual(h2.protocol, Http.EProtocol.HTTPS_2);
            NodeAssert.strictEqual((await h1.getBuffer()).toString(), BASELINE_BODY);
            NodeAssert.strictEqual((await h2.getBuffer()).toString(), BASELINE_BODY);
        }
    );

    NodeTest.it(
        'B-M-00004: Should auto-detect and cache HTTP/2 through ALPN',
        async (testContext) => {

            const client = createClient(testContext);

            for (let attempt = 0; attempt < 2; attempt++) {

                const response = await client.request({
                    'method': 'GET',
                    'url': https2Server.url('https', '/', TLS_HOSTNAME),
                    'version': Http.EVersion.ALPN,
                    'ca': TLS_CA,
                    'connectionOptions': {
                        'remoteHost': LOOPBACK_ADDRESS
                    }
                });

                NodeAssert.strictEqual(response.protocol, Http.EProtocol.HTTPS_2);
                NodeAssert.strictEqual(
                    (await response.getBuffer()).toString(),
                    BASELINE_BODY
                );
            }
        }
    );

    NodeTest.it(
        'B-M-00005: Should auto-detect and cache HTTP/1.1 through ALPN',
        async (testContext) => {

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

            testContext.after(() => client.close());

            for (let attempt = 0; attempt < 2; attempt++) {

                const response = await client.request({
                    'method': 'GET',
                    'url': https1Server.url('https', '/', TLS_HOSTNAME),
                    'version': Http.EVersion.ALPN,
                    'ca': TLS_CA,
                    'connectionOptions': {
                        'remoteHost': LOOPBACK_ADDRESS
                    }
                });

                NodeAssert.strictEqual(response.protocol, Http.EProtocol.HTTPS_1);
                NodeAssert.strictEqual(
                    (await response.getBuffer()).toString(),
                    BASELINE_BODY
                );
            }

            NodeAssert.strictEqual(writes, 1);
        }
    );

    NodeTest.it(
        'B-M-00006: Should hand a negotiated ALPN socket to an HTTP/2 session',
        async () => {

            const socket = NodeTls.connect({
                'host': LOOPBACK_ADDRESS,
                'port': https2Server.port,
                'servername': TLS_HOSTNAME,
                'ca': TLS_CA,
                'ALPNProtocols': ['h2']
            });

            await NodeEvents.once(socket, 'secureConnect', {
                'signal': AbortSignal.timeout(TEST_TIMEOUT)
            });
            NodeAssert.strictEqual(socket.alpnProtocol, 'h2');

            const session = NodeHttp2.connect(
                https2Server.url('https', '/', TLS_HOSTNAME),
                { 'createConnection': () => socket }
            );

            try {

                await NodeEvents.once(session, 'connect', {
                    'signal': AbortSignal.timeout(TEST_TIMEOUT)
                });

                const request = session.request({
                    [NodeHttp2.constants.HTTP2_HEADER_PATH]: '/'
                });

                request.end();
                NodeAssert.strictEqual(await readStream(request), BASELINE_BODY);
            }
            finally {

                session.destroy();
            }
        }
    );

    NodeTest.it(
        'B-M-00007: Should expose response streams, limits, and empty entities',
        async (testContext) => {

            const client = createClient(testContext);
            const streamResponse = await client.request({
                'method': 'GET',
                'url': http1Server.url('http')
            });

            NodeAssert.strictEqual(
                await readStream(streamResponse.getStream()),
                BASELINE_BODY
            );

            const limited = await client.request({
                'method': 'GET',
                'url': http1Server.url('http')
            });

            await NodeAssert.rejects(
                limited.getBuffer(BASELINE_BODY.length - 1),
                Http.E_TOO_LARGE_RESPONSE_ENTITY
            );

            const head = await client.request({
                'method': 'HEAD',
                'url': http1Server.url('http')
            });

            NodeAssert.strictEqual((await head.getBuffer()).byteLength, 0);
            NodeAssert.throws(() => head.getRawStream(), Http.E_NO_RESPONSE_ENTITY);
        }
    );

    NodeTest.it(
        'B-M-00008: Should classify standard response status ranges',
        async (testContext) => {

            const client = createClient(testContext);
            const cases = [
                [200, 'isSuccess'],
                [302, 'isRedirection'],
                [404, 'isClientError'],
                [503, 'isServerError']
            ] as const;

            for (const [statusCode, method] of cases) {

                const response = await client.request({
                    'method': 'GET',
                    'url': http1Server.url('http', `/status/${statusCode}`)
                });

                NodeAssert.strictEqual(response.statusCode, statusCode);
                NodeAssert.strictEqual(response[method](), true);
            }
        }
    );

    NodeTest.it(
        'B-M-00009: Should apply request filters and authentication preprocessors',
        async (testContext) => {

            const client = createClient(testContext);

            client.filters.register({
                'name': 'pre_args',
                'key': 'baseline-version',
                'callback': (opts) => ({ ...opts, 'version': Http.EVersion.HTTP_2 })
            });
            client.filters.register({
                'name': 'pre_request',
                'key': 'baseline-header',
                'callback': (opts) => {

                    opts.headers['x-baseline-header'] = 'filtered';
                    return opts;
                }
            });
            client.filters.register({
                'name': 'pre_request',
                'key': 'basic-authentication',
                'callback': Http.createBasicPreprocessor() as unknown as
                    Http.IFilters['pre_request']
            });
            client.filters.register({
                'name': 'pre_request',
                'key': 'bearer-authentication',
                'callback': Http.createBearerPreprocessor() as unknown as
                    Http.IFilters['pre_request']
            });

            const basic = await client.request({
                'method': 'POST',
                'url': http2Server.url('http', '/echo'),
                'data': BASELINE_BODY,
                'authentication': {
                    'type': 'Basic',
                    'username': BASIC_USERNAME,
                    'password': BASIC_PASSWORD
                } as Http.IBasicAuthentication
            });
            const bearer = await client.request({
                'method': 'GET',
                'url': http2Server.url('http'),
                'authentication': {
                    'type': 'Bearer',
                    'credentials': BEARER_CREDENTIALS
                } as Http.IBearerAuthentication
            });

            NodeAssert.strictEqual(basic.protocol, Http.EProtocol.HTTP_2);
            NodeAssert.strictEqual(basic.headers['x-baseline-header'], 'filtered');
            NodeAssert.strictEqual(
                basic.headers['x-request-authorization'],
                `Basic ${Buffer.from(`${BASIC_USERNAME}:${BASIC_PASSWORD}`).toString('base64')}`
            );
            NodeAssert.strictEqual(
                bearer.headers['x-request-authorization'],
                `Bearer ${BEARER_CREDENTIALS}`
            );
            NodeAssert.strictEqual((await basic.getBuffer()).toString(), BASELINE_BODY);

            bearer.abort();
        }
    );
});
