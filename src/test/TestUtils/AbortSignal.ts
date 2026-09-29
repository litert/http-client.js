import * as NodeAssert from 'node:assert';
import * as NodeHttp from 'node:http';
import * as NodeHttp2 from 'node:http2';
import { Readable } from 'node:stream';
import * as Http from '../../lib';
import { TEST_TIMEOUT as REQUEST_TIMEOUT } from './Server';

export const ABORT_CYCLES = 5;
export const CONNECTION_LIMIT = 2;
export const REQUESTS_PER_CYCLE = CONNECTION_LIMIT * 3;
export const PROBE_BODY = 'ok';

export interface IAbortBatch {

    bodies: PendingBody[];

    controllers: AbortController[];

    settled: Promise<PromiseSettledResult<Http.IResponse>[]>;
}

interface IErrorWithCause extends Error {

    cause?: unknown;
}

export class PendingBody extends Readable {

    private _sent = false;

    public override _read(): void {

        if (this._sent) {

            return;
        }

        this._sent = true;
        this.push(Buffer.from('partial body'));
    }
}

export function waitForHttp1Requests(
    server: NodeHttp.Server,
    expected: number
): Promise<void> {

    return new Promise((resolve) => {

        let received = 0;

        const onRequest = (request: NodeHttp.IncomingMessage): void => {

            if (!request.url?.startsWith('/hold') || ++received !== expected) {

                return;
            }

            server.removeListener('request', onRequest);
            resolve();
        };

        server.on('request', onRequest);
    });
}

export function waitForHttp2Streams(
    server: NodeHttp2.Http2Server,
    expected: number
): Promise<void> {

    return new Promise((resolve) => {

        let received = 0;

        const onStream = (
            _stream: NodeHttp2.ServerHttp2Stream,
            headers: NodeHttp2.IncomingHttpHeaders
        ): void => {

            const path = headers[NodeHttp2.constants.HTTP2_HEADER_PATH];

            if (typeof path !== 'string' || !path.startsWith('/hold') ||
                ++received !== expected) {

                return;
            }

            server.removeListener('stream', onStream);
            resolve();
        };

        server.on('stream', onStream);
    });
}

export function createAbortBatch(
    client: Http.IClient,
    url: string,
    version: Http.EVersion,
    concurrency: number
): IAbortBatch {

    const controllers = Array.from(
        { 'length': REQUESTS_PER_CYCLE },
        () => new AbortController()
    );
    const bodies = controllers.map(() => new PendingBody());
    const requests = controllers.map((controller, index) => {

        const opts: Http.IRequestOptionsInput = {
            'method': 'POST',
            url,
            version,
            'headers': {
                [Http.Headers.CONTENT_LENGTH_H1]: 64
            },
            'data': bodies[index],
            'maxConnections': CONNECTION_LIMIT,
            concurrency,
            'timeout': REQUEST_TIMEOUT
        };

        if (index) {

            opts.signal = controller.signal;
        }
        else {

            opts.requestOptions = {
                'signal': controller.signal
            };
        }

        return client.request(opts);
    });

    return {
        bodies,
        controllers,
        'settled': Promise.allSettled(requests)
    };
}

export function abortBatch(batch: IAbortBatch, cycle: number): void {

    for (const controller of batch.controllers) {

        controller.abort(new Error(`Abort cycle ${cycle}.`));
    }
}

export function assertAborted(
    batch: IAbortBatch,
    results: PromiseSettledResult<Http.IResponse>[]
): void {

    NodeAssert.strictEqual(results.length, REQUESTS_PER_CYCLE);

    for (let index = 0; index < results.length; index++) {

        const result = results[index];

        NodeAssert.strictEqual(result.status, 'rejected');

        if (result.status === 'rejected') {

            const error = result.reason;
            const abortReason = batch.controllers[index].signal.reason;

            NodeAssert.ok(error instanceof Http.E_ABORTED);
            NodeAssert.ok(error.origin instanceof Error);

            if (error.origin.name === 'AbortError') {

                NodeAssert.strictEqual(
                    (error.origin as IErrorWithCause).cause,
                    abortReason
                );
            }
            else {

                NodeAssert.strictEqual(error.origin, abortReason);
            }
        }
    }

    for (const body of batch.bodies) {

        NodeAssert.strictEqual(body.destroyed, true);
    }
}

export async function assertProbe(
    client: Http.IClient,
    url: string,
    version: Http.EVersion,
    concurrency: number
): Promise<void> {

    const response = await client.request({
        'method': 'GET',
        url,
        version,
        'maxConnections': CONNECTION_LIMIT,
        concurrency,
        'timeout': REQUEST_TIMEOUT
    });

    NodeAssert.strictEqual(
        response.statusCode,
        NodeHttp2.constants.HTTP_STATUS_OK
    );
    NodeAssert.strictEqual(
        (await response.getBuffer()).toString(),
        PROBE_BODY
    );
}
