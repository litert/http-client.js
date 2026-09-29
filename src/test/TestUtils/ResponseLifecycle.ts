import { Readable } from 'node:stream';
import * as Http from '../../lib';
import { HttpClientResponse } from '../../lib/Internal/Response';

export const RESPONSE_BODY = 'response body';
export const REQUEST_TIMEOUT = 40;
export const TEST_GUARD_TIMEOUT = 1_000;

export function createTestResponse(
    statusCode: number,
    stream: Readable = Readable.from([RESPONSE_BODY]),
    headers: Http.TResponseHeaders = {},
    gzip: boolean = true,
    deflate: boolean = true
): HttpClientResponse {

    return new HttpClientResponse(
        Http.EProtocol.HTTP_1,
        stream,
        Buffer.byteLength(RESPONSE_BODY),
        headers,
        statusCode,
        gzip,
        deflate
    );
}

export function createResponseRequestOptions(): Http.IRequestOptions {

    return {
        'authentication': { 'type': 'none' },
        'ca': '',
        'concurrency': 1,
        'connectionOptions': {},
        'data': '',
        'deflate': true,
        'gzip': true,
        'headers': {},
        'keepAlive': true,
        'keepAliveTimeout': 1_000,
        'localAddress': '',
        'maxConnections': 1,
        'method': 'GET',
        'minTLSVersion': Http.ETlsVersion.TLS_V1,
        'requestOptions': {},
        'timeout': REQUEST_TIMEOUT,
        'url': {
            'protocol': 'http',
            'hostname': 'localhost',
            'pathname': '/',
            'port': 80
        },
        'version': Http.EVersion.HTTP_2
    };
}
