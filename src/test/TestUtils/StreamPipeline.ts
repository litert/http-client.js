import * as NodeHttp from 'node:http';
import * as NodeHttp2 from 'node:http2';
import { PassThrough, Readable, Writable } from 'node:stream';
import * as Http from '../../lib';
import { AbstractHttp1Client } from '../../lib/Internal/AbstractHttp1Client';
import { AbstractHttp2Client } from '../../lib/Internal/AbstractHttp2Client';
import { HttpHelper } from '../../lib/Internal/Helper';
import { LOOPBACK_ADDRESS } from './Server';

export const PIPELINE_REQUEST_TIMEOUT = 1_000;

export interface IFakeConnection {

    concurrency: number;

    connection: NodeHttp2.ClientHttp2Session;
}

export class ObservedRequest extends Writable {

    public timeoutConfigured = false;

    public timeoutConfiguredAtFirstWrite: boolean | null = null;

    private _responseEmitted = false;

    private _timeoutCallback?: () => void;

    public constructor(
        private readonly _protocol: Http.EVersion,
        private readonly _emitEarlyResponse: boolean,
        private readonly _triggerTimeout: boolean = false
    ) {

        super();
    }

    public setTimeout(_timeout: number, callback?: () => void): this {

        this.timeoutConfigured = true;
        this._timeoutCallback = callback;

        return this;
    }

    public override _write(
        _chunk: Buffer,
        _encoding: BufferEncoding,
        callback: (error?: Error | null) => void
    ): void {

        this.timeoutConfiguredAtFirstWrite ??= this.timeoutConfigured;

        if (this._triggerTimeout) {

            this._timeoutCallback?.();

            // Request destruction, rather than write completion, settles pipeline.
            return;
        }

        if (this._emitEarlyResponse && !this._responseEmitted) {

            this._responseEmitted = true;

            if (this._protocol === Http.EVersion.HTTP_1_1) {

                const response = new Readable({
                    read(): void {

                        this.push(null);
                    }
                }) as NodeHttp.IncomingMessage;

                response.headers = {};
                response.statusCode = NodeHttp2.constants.HTTP_STATUS_OK;
                response.setTimeout = (): NodeHttp.IncomingMessage => response;

                this.emit('response', response);
            }
            else {

                this.emit('response', {
                    [NodeHttp2.constants.HTTP2_HEADER_STATUS]:
                        NodeHttp2.constants.HTTP_STATUS_OK
                });
            }
        }

        callback();
    }
}

export class TestHttp1Client extends AbstractHttp1Client {

    public process(
        request: ObservedRequest,
        opts: Http.IRequestOptions
    ): Promise<import('../../lib/Internal/Abstract').IRequestResult> {

        return this._processRequest(
            request as unknown as NodeHttp.ClientRequest,
            opts,
            true
        );
    }
}

export class TestHttp2Client extends AbstractHttp2Client {

    public getAuthorityKey(_opts: Http.IRequestOptions): string {

        return 'test-connection';
    }

    protected _prepareOptions(
        _opts: Http.IRequestOptions
    ): NodeHttp2.ClientSessionOptions {

        return {};
    }

    public process(
        opts: Http.IRequestOptions
    ): Promise<import('../../lib/Internal/Abstract').IRequestResult> {

        return this._processRequest(opts);
    }
}

export function createFailingBody(error: Error): Readable {

    async function* generate(): AsyncGenerator<Buffer> {

        yield Buffer.from('partial body');
        throw error;
    }

    return Readable.from(generate());
}

export function createUnfinishedBody(): PassThrough {

    const body = new PassThrough();

    body.write('request body');

    return body;
}

export function createPipelineOptions(
    body: Readable,
    version: Http.EVersion
): Http.IRequestOptions {

    return {
        'method': 'POST',
        'url': {
            'protocol': 'http',
            'hostname': LOOPBACK_ADDRESS,
            'pathname': '/',
            'port': Http.DEFAULT_HTTP_PORT
        },
        'headers': {
            [Http.Headers.CONTENT_LENGTH_H1]: 64
        },
        'localAddress': '',
        'authentication': {
            'type': 'none'
        },
        'minTLSVersion': Http.ETlsVersion.TLS_V1_2,
        'data': body,
        version,
        'gzip': false,
        'deflate': false,
        'maxConnections': 1,
        'concurrency': 1,
        'keepAlive': false,
        'keepAliveTimeout': PIPELINE_REQUEST_TIMEOUT,
        'ca': '',
        'requestOptions': {},
        'connectionOptions': {},
        'timeout': PIPELINE_REQUEST_TIMEOUT
    };
}

export function installFakeHttp2Connection(
    client: TestHttp2Client,
    request: ObservedRequest
): IFakeConnection {

    const connection = {
        'concurrency': 1,
        'connection': {
            'closed': false,
            'request': (): NodeHttp2.ClientHttp2Stream => (
                request as unknown as NodeHttp2.ClientHttp2Stream
            )
        } as NodeHttp2.ClientHttp2Session
    };

    Object.defineProperty(client, '_getConnection', {
        'value': async (): Promise<[string, IFakeConnection]> => [
            'test-connection-id',
            connection
        ]
    });

    return connection;
}

export function createTestHttp1Client(): TestHttp1Client {

    return new TestHttp1Client(new HttpHelper());
}

export function createTestHttp2Client(): TestHttp2Client {

    return new TestHttp2Client(new HttpHelper());
}
