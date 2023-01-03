/**
 * Copyright 2023 Angus.Fenying <fenying@litert.org>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as C from '../Common';
import * as E from '../Errors';
import { Readable } from 'stream';
import * as $zlib from 'zlib';

const HTTP_STATUS_CODE_SUCCESS_MIN = 200;
const HTTP_STATUS_CODE_SUCCESS_MAX = 299;

const HTTP_STATUS_CODE_REDIRECT_MIN = 300;
const HTTP_STATUS_CODE_REDIRECT_MAX = 399;

const HTTP_STATUS_CODE_CLIENT_ERROR_MIN = 400;
const HTTP_STATUS_CODE_CLIENT_ERROR_MAX = 499;

const HTTP_STATUS_CODE_SERVER_ERROR_MIN = 400;
const HTTP_STATUS_CODE_SERVER_ERROR_MAX = 499;

const HTTP_STATUS_CODE_CONTINUE = 100;
const HTTP_STATUS_CODE_UPGRADE = 101;

const EMPTY_BUFFER = Buffer.allocUnsafe(0);

export class HttpClientResponse implements C.IResponse {

    public constructor(
        private readonly _protocol: C.EProtocol,
        private readonly _stream: Readable,
        private readonly _contentLength: number,
        private readonly _headers: C.TResponseHeaders,
        private readonly _statusCode: number,
        private readonly _gzip?: boolean,
        private readonly _deflate?: boolean,
        private readonly _noEntity?: boolean
    ) {

    }

    public abort(): void {

        const s = this._stream as any;

        if (s.close) {

            s.close();
        }
        else {

            s.destroy();
        }
    }

    public get headers(): C.TResponseHeaders {

        return this._headers;
    }

    public get statusCode(): number {

        return this._statusCode;
    }

    public get contentLength(): number {

        return this._contentLength;
    }

    public get protocol(): C.EProtocol {

        return this._protocol;
    }

    public getBuffer(maxLength: number = Infinity): Promise<Buffer> {

        if (maxLength <= 0 || this.contentLength <= 0 || this._noEntity) {

            return Promise.resolve(EMPTY_BUFFER);
        }

        return new Promise<Buffer>((resolve, reject) => {

            const resp = this._stream;

            const data: Buffer[] = [];

            let stream: Readable = resp;

            if (this._gzip && this._headers['content-encoding'] === 'gzip') {

                stream = resp.pipe($zlib.createGunzip());
            }
            else if (this._deflate && this._headers['content-encoding'] === 'deflate') {

                stream = resp.pipe($zlib.createInflate());
            }

            stream.on('data', (maxLength && maxLength !== Infinity) ? (function() {

                let length = 0;

                return function(chunk: Buffer): void {

                    length += chunk.byteLength;

                    if (length > maxLength) {

                        stream.removeAllListeners('error');
                        stream.removeAllListeners('data');
                        stream.removeAllListeners('end');

                        if (stream !== resp) {

                            resp.removeAllListeners('error');
                        }

                        resp.destroy();

                        reject(new E.E_TOO_LARGE_RESPONSE_ENTITY()); return;
                    }

                    data.push(chunk);
                };

            })() : function(chunk: Buffer): void {

                data.push(chunk);

            }).on('end', function() {

                resolve(Buffer.concat(data));

            }).once('error', reject);

            if (stream !== resp) {

                resp.once('error', reject);
            }
        });
    }

    public getStream(): Readable {

        if (this._noEntity || this._statusCode === 204) {

            throw new E.E_NO_RESPONSE_ENTITY();
        }

        const resp = this._stream;

        if (this._gzip && this._headers['content-encoding'] === 'gzip') {

            return resp.pipe($zlib.createGunzip());
        }
        else if (this._deflate && this._headers['content-encoding'] === 'deflate') {

            return resp.pipe($zlib.createInflate());
        }

        return resp;
    }

    public getRawStream(): Readable {

        if (this._noEntity || this._statusCode === 204) {

            throw new E.E_NO_RESPONSE_ENTITY();
        }

        return this._stream;
    }

    public isSuccess(): boolean {

        return this._statusCode >= HTTP_STATUS_CODE_SUCCESS_MIN &&
               this._statusCode <= HTTP_STATUS_CODE_SUCCESS_MAX;
    }

    public isRedirection(): boolean {

        return this._statusCode >= HTTP_STATUS_CODE_REDIRECT_MIN &&
               this._statusCode <= HTTP_STATUS_CODE_REDIRECT_MAX;
    }

    public isClientError(): boolean {

        return this._statusCode >= HTTP_STATUS_CODE_CLIENT_ERROR_MIN &&
               this._statusCode <= HTTP_STATUS_CODE_CLIENT_ERROR_MAX;
    }

    public isServerError(): boolean {

        return this._statusCode >= HTTP_STATUS_CODE_SERVER_ERROR_MIN &&
               this._statusCode <= HTTP_STATUS_CODE_SERVER_ERROR_MAX;
    }

    public isContinue(): boolean {

        return this._statusCode === HTTP_STATUS_CODE_CONTINUE;
    }

    public isUpgrade(): boolean {

        return this._statusCode === HTTP_STATUS_CODE_UPGRADE;
    }

}
