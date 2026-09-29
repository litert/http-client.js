import * as Http from '../../lib';
import { startTcpServer, TLS_HOSTNAME } from './Server';

export async function reserveUnusedPort(): Promise<number> {

    const reservation = await startTcpServer();
    const port = reservation.port;

    await reservation.close();

    return port;
}

export function createDispatchOptions(
    remoteHost: string,
    concurrency: number = 1
): Http.IRequestOptions {

    return {
        'authentication': { 'type': 'none' },
        'ca': '',
        concurrency,
        'connectionOptions': { remoteHost },
        'data': '',
        'deflate': true,
        'gzip': true,
        'headers': {},
        'keepAlive': true,
        'keepAliveTimeout': 1_000,
        'localAddress': '',
        'maxConnections': 2,
        'method': 'GET',
        'minTLSVersion': Http.ETlsVersion.TLS_V1_2,
        'requestOptions': {},
        'timeout': 1_000,
        'url': {
            'protocol': 'https',
            'hostname': TLS_HOSTNAME,
            'pathname': '/',
            'port': 443
        },
        'version': Http.EVersion.HTTP_2
    };
}
