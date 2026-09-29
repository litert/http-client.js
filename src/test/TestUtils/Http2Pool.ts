import * as NodeEvents from 'node:events';
import * as NodeHttp2 from 'node:http2';
import * as Http from '../../lib';
import {
    addTrackedResource,
    createResourceTracker,
    type IResourceTracker,
    removeTrackedResource,
    sendHttp2Response,
    startHttp2Server,
    type TestServer,
    TEST_TIMEOUT,
    waitForResourceCount
} from './Server';

export const HTTP2_OK_BODY = 'ok';
export const SATURATED_REQUEST_COUNT = 6;

export interface IRequestLimits {

    concurrency: number;

    maxConnections: number;
}

export class Http2PoolTestServer {

    public readonly sessions =
        createResourceTracker<NodeHttp2.ServerHttp2Session>();

    public readonly streams =
        createResourceTracker<NodeHttp2.ServerHttp2Stream>();

    public readonly heldStreams = new Set<NodeHttp2.ServerHttp2Stream>();

    public sessionsCreated = 0;

    private readonly _holdEvents = new NodeEvents.EventEmitter();

    private _holdRequests = 0;

    private constructor(
        private readonly _server: TestServer<NodeHttp2.Http2Server>
    ) {}

    public static async start(): Promise<Http2PoolTestServer> {

        let fixture: Http2PoolTestServer;
        const server = await startHttp2Server((stream, headers) => {

            fixture._handleStream(stream, headers);
        });

        fixture = new Http2PoolTestServer(server);
        fixture._trackSessions();

        return fixture;
    }

    public get activeSockets(): number {

        return this._server.activeSockets;
    }

    public request(
        client: Http.IClient,
        pathname: string,
        limits: IRequestLimits
    ): Promise<Http.IResponse> {

        return client.request({
            'method': 'GET',
            'url': this._server.url('http', pathname),
            'version': Http.EVersion.HTTP_2,
            'concurrency': limits.concurrency,
            'maxConnections': limits.maxConnections,
            'timeout': TEST_TIMEOUT
        });
    }

    public url(pathname: string): string {

        return this._server.url('http', pathname);
    }

    public releaseHeldStreams(): void {

        for (const stream of this.heldStreams) {

            if (!stream.closed && !stream.destroyed) {

                sendHttp2Response(stream, HTTP2_OK_BODY);
            }
        }
    }

    public async waitForHoldRequests(expected: number): Promise<void> {

        while (this._holdRequests < expected) {

            await NodeEvents.once(this._holdEvents, 'request', {
                'signal': AbortSignal.timeout(TEST_TIMEOUT)
            });
        }
    }

    public async waitForSessionCount(expected: number): Promise<void> {

        await waitForResourceCount(this.sessions, expected);
    }

    public async waitForStreamCount(expected: number): Promise<void> {

        await waitForResourceCount(this.streams, expected);
    }

    public async close(): Promise<void> {

        this.releaseHeldStreams();
        await this._server.close();
    }

    private _trackSessions(): void {

        this._server.server.on('session', (session) => {

            this.sessionsCreated++;
            addTrackedResource(this.sessions, session);
            session.once('close', () => {

                removeTrackedResource(this.sessions, session);
            });
        });
    }

    private _handleStream(
        stream: NodeHttp2.ServerHttp2Stream,
        headers: NodeHttp2.IncomingHttpHeaders
    ): void {

        const pathname = headers[NodeHttp2.constants.HTTP2_HEADER_PATH];

        addTrackedResource(this.streams, stream);
        stream.on('error', () => undefined);
        stream.resume();
        stream.once('close', () => {

            this.heldStreams.delete(stream);
            removeTrackedResource(this.streams, stream);
        });

        if (typeof pathname === 'string' && pathname.startsWith('/hold')) {

            this._holdRequests++;
            this.heldStreams.add(stream);
            this._holdEvents.emit('request');
            return;
        }

        if (typeof pathname === 'string' && pathname.startsWith('/reset')) {

            stream.close(NodeHttp2.constants.NGHTTP2_INTERNAL_ERROR);
            return;
        }

        if (typeof pathname === 'string' &&
            pathname.startsWith('/close-session')) {

            stream.session?.destroy();
            return;
        }

        if (typeof pathname === 'string' &&
            pathname.startsWith('/session-error')) {

            stream.session?.destroy(new Error('Forced session error.'));
            return;
        }

        sendHttp2Response(stream, HTTP2_OK_BODY);
    }
}

export function resetTrackerPeak<T>(tracker: IResourceTracker<T>): void {

    tracker.peak = tracker.active.size;
}
