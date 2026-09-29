/* eslint-disable */

import * as NodeAssert from 'node:assert';
import * as NodeTest from 'node:test';
import * as Filters from '../lib/Filters';
import * as Http from '../lib';
import type { IStringFilters } from './TestUtils/Filters';

NodeTest.describe('Filter manager and simple cache', () => {

    NodeTest.it(
        'B-M-00001: [BUG] Should await promise-compatible filter results in priority order',
        async () => {

            const manager = Filters.createAsyncFilterManager<IStringFilters>();

            manager.register({
                'name': 'format',
                'key': 'last',
                'priority': 20,
                'callback': (value) => `${value}-last`
            });
            manager.register({
                'name': 'format',
                'key': 'thenable',
                'priority': 10,
                'callback': ((value: string) => ({
                    'then': (resolve: (result: string) => void) => {

                        resolve(`${value}-thenable`);
                    }
                })) as unknown as IStringFilters['format']
            });

            NodeAssert.strictEqual(
                await manager.filter('format', 'start'),
                'start-thenable-last'
            );
        }
    );

    NodeTest.it(
        'B-M-00002: Should support sync filters, priorities, and symbol keys',
        () => {

            const key = Symbol('prefix');
            const manager = Filters.createSyncFilterManager<IStringFilters>();

            manager.register({
                'name': 'format',
                key,
                'priority': -1,
                'callback': (value) => `prefix-${value}`
            });
            manager.register({
                'name': 'format',
                'key': 'suffix',
                'callback': (value) => `${value}-suffix`
            });

            NodeAssert.strictEqual(
                manager.filter('format', 'value'),
                'prefix-value-suffix'
            );

            manager.unregister('format', key);
            NodeAssert.strictEqual(manager.filter('format', 'value'), 'value-suffix');

            manager.unregister('format', 'missing');
            NodeAssert.strictEqual(manager.filter('format', 'value'), 'value-suffix');

            manager.unregister('format');
            NodeAssert.strictEqual(manager.filter('format', 'value'), 'value');
        }
    );

    NodeTest.it(
        'B-F-00001: Should reject duplicate filter keys without changing the chain',
        () => {

            const manager = Filters.createSyncFilterManager<IStringFilters>();
            const callback = (value: string): string => `${value}-once`;

            manager.register({
                'name': 'format',
                'key': 'duplicate',
                callback
            });

            NodeAssert.throws(() => manager.register({
                'name': 'format',
                'key': 'duplicate',
                callback
            }), Filters.E_DUP_FILTER_FUNCTION);
            NodeAssert.strictEqual(manager.filter('format', 'value'), 'value-once');
        }
    );

    NodeTest.it(
        'B-E-00001: [BUG] Should remove cache entries with prototype-like keys',
        () => {

            const cache = Http.createSimpleKVSCache(1_000);

            for (const key of ['__proto__', 'constructor', 'toString']) {

                cache.set(key, `value:${key}`);
                NodeAssert.strictEqual(cache.get(key), `value:${key}`);
                cache.remove(key);
                NodeAssert.strictEqual(cache.get(key), null);
            }
        }
    );

    NodeTest.it(
        'B-E-00002: [BUG] Should expire a zero-lifetime cache entry immediately',
        (testContext) => {

            testContext.mock.method(Date, 'now', () => 1_000);

            const cache = Http.createSimpleKVSCache(0);

            cache.set('key', 'value');
            NodeAssert.strictEqual(cache.get('key'), null);
        }
    );

    NodeTest.it(
        'B-F-00002: Should reject empty and unknown authentication credentials',
        async (testContext) => {

            const client = Http.createHttpClient();

            testContext.after(() => client.close());

            client.filters.register({
                'name': 'pre_request',
                'key': 'basic',
                'callback': Http.createBasicPreprocessor()
            });
            client.filters.register({
                'name': 'pre_request',
                'key': 'bearer',
                'callback': Http.createBearerPreprocessor()
            });

            await NodeAssert.rejects(client.request({
                'method': 'GET',
                'url': 'http://127.0.0.1/',
                'authentication': {
                    'type': 'Basic',
                    'username': '',
                    'password': 'password'
                } as Http.IBasicAuthentication
            }), Http.E_EMPTY_AUTH_CREDENTIALS);

            await NodeAssert.rejects(client.request({
                'method': 'GET',
                'url': 'http://127.0.0.1/',
                'authentication': {
                    'type': 'Bearer',
                    'credentials': ''
                } as Http.IBearerAuthentication
            }), Http.E_EMPTY_AUTH_CREDENTIALS);

            await NodeAssert.rejects(client.request({
                'method': 'GET',
                'url': 'http://127.0.0.1/',
                'authentication': {
                    'type': 'Unknown'
                }
            }), Http.E_UNKNOWN_AUTH_TYPE);
        }
    );
});
