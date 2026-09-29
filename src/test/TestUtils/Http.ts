import { Readable } from 'node:stream';
import * as Http from '../../lib';

export function createTestClient(): Http.IClient {

    return Http.createHttpClient();
}

export async function getResponseBody(
    response: Http.IResponse
): Promise<string> {

    return (await response.getBuffer()).toString();
}

export async function readStream(stream: Readable): Promise<string> {

    const chunks: Buffer[] = [];

    for await (const chunk of stream) {

        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString();
}
