/* eslint-disable */

import * as NodeAssert from 'node:assert';
import * as NodeTest from 'node:test';
import * as Http from '../lib';
import { createTestClient, readStream } from './TestUtils/Http';
import {
    startHttp1Server,
    startHttp2CompatibilityServer
} from './TestUtils/Server';

const RESPONSE_BODY = 'hello world!';

NodeTest.describe('HTTP client public features', {
    'concurrency': false,
    'timeout': 30_000
}, () => {

    NodeTest.it(
        'B-M-00001: Should expose response streams, limits, and empty entities',
        async () => {

            const server = await startHttp1Server((request, response) => {

                if (request.method === 'HEAD') {

                    response.end();
                    return;
                }

                response.end(RESPONSE_BODY);
            });
            const client = createTestClient();

            try {

                const streamResponse = await client.request({
                    'method': 'GET',
                    'url': server.url('http')
                });

                NodeAssert.strictEqual(
                    await readStream(streamResponse.getStream()),
                    RESPONSE_BODY
                );

                const limited = await client.request({
                    'method': 'GET',
                    'url': server.url('http')
                });

                await NodeAssert.rejects(
                    limited.getBuffer(RESPONSE_BODY.length - 1),
                    Http.E_TOO_LARGE_RESPONSE_ENTITY
                );

                const head = await client.request({
                    'method': 'HEAD',
                    'url': server.url('http')
                });

                NodeAssert.strictEqual((await head.getBuffer()).byteLength, 0);
                NodeAssert.throws(
                    () => head.getRawStream(),
                    Http.E_NO_RESPONSE_ENTITY
                );
            }
            finally {

                await server.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-M-00002: Should classify standard response status ranges',
        async () => {

            const server = await startHttp1Server((request, response) => {

                const statusCode = Number(request.url?.slice('/status/'.length));

                response.writeHead(statusCode, { 'content-length': 0 });
                response.end();
            });
            const client = createTestClient();
            const cases = [
                [200, 'isSuccess'],
                [302, 'isRedirection'],
                [404, 'isClientError'],
                [503, 'isServerError']
            ] as const;

            try {

                for (const [statusCode, method] of cases) {

                    const response = await client.request({
                        'method': 'GET',
                        'url': server.url('http', `/status/${statusCode}`)
                    });

                    NodeAssert.strictEqual(response.statusCode, statusCode);
                    NodeAssert.strictEqual(response[method](), true);
                }
            }
            finally {

                await server.close();
                client.close();
            }
        }
    );

    NodeTest.it(
        'B-M-00003: Should apply filters and authentication preprocessors',
        async () => {

            const server = await startHttp2CompatibilityServer(
                (request, response) => {

                    response.setHeader(
                        'x-request-authorization',
                        request.headers.authorization ?? ''
                    );
                    response.setHeader(
                        'x-baseline-header',
                        request.headers['x-baseline-header'] ?? ''
                    );

                    if (request.url === '/echo') {

                        request.pipe(response);
                        return;
                    }

                    response.end(RESPONSE_BODY);
                }
            );
            const client = createTestClient();
            const username = 'angus';
            const password = 'password';
            const bearerCredentials = 'test-token';

            try {

                client.filters.register({
                    'name': 'pre_args',
                    'key': 'baseline-version',
                    'callback': (opts) => ({
                        ...opts,
                        'version': Http.EVersion.HTTP_2
                    })
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
                    'callback': Http.createBasicPreprocessor()
                });
                client.filters.register({
                    'name': 'pre_request',
                    'key': 'bearer-authentication',
                    'callback': Http.createBearerPreprocessor()
                });

                const basic = await client.request({
                    'method': 'POST',
                    'url': server.url('http', '/echo'),
                    'data': RESPONSE_BODY,
                    'authentication': {
                        'type': 'Basic',
                        username,
                        password
                    } as Http.IBasicAuthentication
                });
                const bearer = await client.request({
                    'method': 'GET',
                    'url': server.url('http'),
                    'authentication': {
                        'type': 'Bearer',
                        'credentials': bearerCredentials
                    } as Http.IBearerAuthentication
                });

                NodeAssert.strictEqual(basic.protocol, Http.EProtocol.HTTP_2);
                NodeAssert.strictEqual(
                    basic.headers['x-baseline-header'],
                    'filtered'
                );
                NodeAssert.strictEqual(
                    basic.headers['x-request-authorization'],
                    `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
                );
                NodeAssert.strictEqual(
                    bearer.headers['x-request-authorization'],
                    `Bearer ${bearerCredentials}`
                );
                NodeAssert.strictEqual(
                    (await basic.getBuffer()).toString(),
                    RESPONSE_BODY
                );

                bearer.abort();
            }
            finally {

                await server.close();
                client.close();
            }
        }
    );
});
