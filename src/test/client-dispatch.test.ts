/* eslint-disable */

import * as NodeAssert from 'node:assert';
import * as NodeTest from 'node:test';
import * as Http from '../lib';
import { HttpHelper } from '../lib/Internal/Helper';
import { H1SClient } from '../lib/Internal/H1SClient';
import { H2Client } from '../lib/Internal/H2Client';
import { H2SClient } from '../lib/Internal/H2SClient';
import {
    createDispatchOptions,
    reserveUnusedPort
} from './TestUtils/Dispatch';
import { createTestClient } from './TestUtils/Http';
import {
    LOOPBACK_ADDRESS,
    TLS_HOSTNAME
} from './TestUtils/Server';

NodeTest.describe('Client dispatch and connection identity', {
    'concurrency': false,
    'timeout': 10_000
}, () => {

    NodeTest.it(
        'B-F-00001: [BUG] Should report malformed URL input as E_INVALID_URL',
        async () => {

            const client = createTestClient();

            try {

                await NodeAssert.rejects(client.request({
                    'method': 'GET',
                    'url': 'not an absolute URL'
                }), (error: unknown): boolean => {

                    NodeAssert.ok(error instanceof Http.E_INVALID_URL);
                    NodeAssert.ok(error.origin instanceof TypeError);
                    return true;
                });
            }
            finally {

                client.close();
            }
        }
    );

    NodeTest.it(
        'B-F-00002: Should reject unsupported versions before opening a connection',
        async () => {

            const client = createTestClient();

            try {

                for (const protocol of ['http', 'https'] as const) {

                    await NodeAssert.rejects(client.request({
                        'method': 'GET',
                        'url': {
                            protocol,
                            'hostname': LOOPBACK_ADDRESS,
                            'pathname': '/',
                            'port': protocol === 'https' ? 443 : 80
                        },
                        'version': 3 as Http.EVersion
                    }), Http.E_PROTOCOL_NOT_SUPPORTED);
                }
            }
            finally {

                client.close();
            }
        }
    );

    NodeTest.it(
        'B-F-00003: Should preserve an ALPN connection failure',
        async () => {

            const port = await reserveUnusedPort();
            const client = createTestClient();

            try {

                await NodeAssert.rejects(client.request({
                    'method': 'GET',
                    'url': `https://${TLS_HOSTNAME}:${port}/`,
                    'version': Http.EVersion.ALPN,
                    'connectionOptions': {
                        'remoteHost': LOOPBACK_ADDRESS
                    }
                }), (error: unknown): boolean => error instanceof Error &&
                    error.name !== 'aborted');
            }
            finally {

                client.close();
            }
        }
    );

    NodeTest.it(
        'B-F-00004: Should reject a pre-aborted ALPN request',
        async () => {

            const client = createTestClient();
            const controller = new AbortController();
            const reason = new Error('Already canceled.');

            controller.abort(reason);

            try {

                await NodeAssert.rejects(client.request({
                    'method': 'GET',
                    'url': `https://${TLS_HOSTNAME}:443/`,
                    'version': Http.EVersion.ALPN,
                    'signal': controller.signal,
                    'connectionOptions': {
                        'remoteHost': LOOPBACK_ADDRESS
                    }
                }), (error: unknown): boolean => {

                    NodeAssert.ok(error instanceof Http.E_ABORTED);
                    NodeAssert.strictEqual(error.origin, reason);
                    return true;
                });
            }
            finally {

                client.close();
            }
        }
    );

    NodeTest.it(
        'W-E-00001: [BUG] Should isolate connection keys by target and capacity',
        () => {

            const helper = new HttpHelper();
            const h1s = new H1SClient(helper);
            const h2 = new H2Client(helper);
            const h2s = new H2SClient(helper);
            const first = createDispatchOptions(LOOPBACK_ADDRESS, 1);
            const otherHost = createDispatchOptions('127.0.0.2', 1);
            const otherCapacity = createDispatchOptions(LOOPBACK_ADDRESS, 2);

            NodeAssert.notStrictEqual(
                h1s.getAuthorityKey(first),
                h1s.getAuthorityKey(otherHost)
            );
            NodeAssert.notStrictEqual(
                h1s.getAuthorityKey(first),
                h1s.getAuthorityKey(otherCapacity)
            );
            NodeAssert.notStrictEqual(
                h2.getAuthorityKey(first),
                h2.getAuthorityKey(otherHost)
            );
            NodeAssert.notStrictEqual(
                h2s.getAuthorityKey(first),
                h2s.getAuthorityKey(otherHost)
            );
        }
    );
});
