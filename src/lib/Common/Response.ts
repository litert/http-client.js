/**
 * Copyright 2020 Angus.Fenying <fenying@litert.org>
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

import { Readable } from 'stream';
import * as B from './Basic';

export enum EProtocol {

    HTTP_1,
    HTTPS_1,
    HTTP_2,
    HTTPS_2
}

export interface IResponse {

    /**
     * The protocol used in this request.
     */
    'protocol': EProtocol;

    /**
     * The headers of response.
     */
    'headers': B.TResponseHeaders;

    /**
     * The status code of response.
     */
    'statusCode': number;

    /**
     * The byte-length of the content.
     */
    'contentLength': number;

    /**
     * Abort the request transporting.
     *
     * If this is a HTTP/1.1 request, the connection will be destroyed and not reusable.
     */
    abort(): void;

    /**
     * Get the whole data of response entity after gunzip/inflate if enabled
     *
     * @param maxBytes  Limit the maximum bytes of data to be fetched into memory.
     */
    getBuffer(maxBytes?: number): Promise<Buffer>;

    /**
     * Get the raw stream of response entity from server-side.
     */
    getRawStream(): Readable;

    /**
     * Get the data stream of response entity after gunzip/inflate if enabled.
     */
    getStream(): Readable;

    /**
     * Check if the result of request is ok. (code between 200 and 299)
     */
    isSuccess(): boolean;

    /**
     * Check if the result of request is a redirection. (code between 300 and 399)
     */
    isRedirection(): boolean;

    /**
     * Check if the result of request is a client-side error. (code between 400 and 499)
     */
    isClientError(): boolean;

    /**
     * Check if the result of request is a server-side error. (code between 500 and 599)
     */
    isServerError(): boolean;

    /**
     * Check if the result of request is CONTINUE. (code 100)
     */
    isContinue(): boolean;

    /**
     * Check if the result of request is UPGRADE. (code 101)
     */
    isUpgrade(): boolean;
}
