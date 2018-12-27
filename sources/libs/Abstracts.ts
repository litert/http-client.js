/**
 *  Copyright 2018 superxrb <superxrb@163.com>
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import * as http from "http";
import { Readable } from "stream";

export interface THttpResponse<T extends boolean = false> {
    /**
     * http content, buffer or readable are ok.
     */
    "content": T extends false ? Buffer : Readable;
    /**
     * http header
     */
    "headers": http.IncomingHttpHeaders;
    /**
     * http response code
     */
    "statusCode" ?: number;
}

/**
 * http methods
 */
export type TMethod = "GET" | "POST" | "PUT" | "TRACE" |
                    "DELETE" | "OPTIONS" | "HEAD" | "PATCH" |
                    "COPY" | "LOCK" | "UNLOCK" | "MOVE" |
                    "MKCOL" | "PROPFIND" | "PROPPATCH" | "REPORT" |
                    "MKACTIVITY" | "CHECKOUT" | "MERGE" | "M-SEARCH" |
                    "NOTIFY" | "SUBSCRIBE" | "UNSUBSCRIBE";

/**
 * support http version
 */
export type TVersion = 1.1 | 2;

/**
 *
 */
export type TOutgoingHeaders = Record<string, string | number>;

/**
 * http timeout for connect send response receive.
 */
export interface IHttpRequstTimeout {

    /**
     * connect timeout: ms
     */
    "connect" ?: number;

    /**
     * send data timeout: ms
     */
    "send" ?: number;

    /**
     * response timeout: ms
     */
    "response" ?: number;

    /**
     * receive data timeout: ms
     */
    "receive" ?: number;
}

/**
 * body object
 */
export interface RawObject {

    [k: string]: string | boolean | number | null | RawObject;
}
export type TURL = string | {

    "host": string;

    "path"?: string;

    "port"?: number;

    /**
     * use http or https, default http
     * if want to use http , set secure as false
     */
    "secure" ?: boolean | {
        secureProtocol ?: string;
        ca?: string | string[] | Buffer | Buffer[];
        crl?: string | string[] | Buffer | Buffer[];
    };
};

/**
 * http body type
 */
export type Tbody = string | Buffer | Readable | {

    "encoding": "urlencode" | "json";

    "data": RawObject;
};

/**
 * http client request options
 */
export interface IClientRequestOptions<T extends boolean = false> {
    /**
     * support versions
     */
    "version" ?: TVersion;

    /**
     * url info
     */
    "url": TURL;

    /**
     * http header info
     * if upload a readable stream, content-length must been set.
     */
    "headers"?: Record<string, string | number>; // Host: www.baidu.com

    /**
     * http body
     */
    "body"?: Tbody;

    /**
     * the return data is or is not a readable stream.
     */
    "returnStream" ?: T;

    /**
     * hearder only, default false
     */
    "headerOnly" ?: boolean;

    /**
     * http request timeoout
     */
    "timeout" ?: number | IHttpRequstTimeout;

}
