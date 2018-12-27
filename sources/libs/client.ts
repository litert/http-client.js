/**
 *  Copyright 2018 superxrb <superxrb@163.com>
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import * as A from "./Abstracts";
import { Readable, Duplex } from "stream";
import * as http from "http";
import * as https from "https";
import { RawPromise } from "@litert/core";
import * as $zlib from "zlib";
import * as $qs from "querystring";
import * as $Events from "events";
import * as Error from "./Errors";
import * as URL from "url";

export interface IHttpClient {

    ca?: Buffer | Buffer[] | string | string[];
    secureProtocol?: string;
    crl?: string | string[] | Buffer | Buffer[];
    version: A.TVersion;
    /**
     * 请求开始之前
     * @param ev
     * @param cb
     */
    on(ev: "pre_request", cb: (opts: A.IClientRequestOptions<boolean>) => void): this;
    /**
     * 得到响应之后
     * @param ev
     * @param cb
     */
    on(ev: "response", cb: (resp: http.IncomingMessage) => void): this;

    /**
     * get 方法
     * @param options
     */
    get<T extends boolean = false>(
        options: A.IClientRequestOptions<T>
    ): Promise<A.THttpResponse<T>>;
    /**
     * options方法
     * @param options
     */
    options<T extends boolean = false>(
        options: A.IClientRequestOptions<T>
    ): Promise<A.THttpResponse<T>>;
    /**
     * head方法
     * @param options
     */
    head<T extends boolean = false>(
        options: A.IClientRequestOptions<T>
    ): Promise<A.THttpResponse<T>>;
    /**
     * trace方法
     * @param options
     */
    trace<T extends boolean = false>(
        options: A.IClientRequestOptions<T>
    ): Promise<A.THttpResponse<T>>;

    /**
     * post方法
     * @param options
     */
    post<T extends boolean = false>(
        options: A.IClientRequestOptions<T>
    ): Promise<A.THttpResponse<T>>;
    /**
     * put方法
     * @param options
     */
    put<T extends boolean = false>(
        options: A.IClientRequestOptions<T>
    ): Promise<A.THttpResponse<T>>;
    /**
     * patch方法
     * @param options
     */
    patch<T extends boolean = false>(
        options: A.IClientRequestOptions<T>
    ): Promise<A.THttpResponse<T>>;
    /**
     * delete方法
     * @param options
     */
    delete<T extends boolean = false>(
        options: A.IClientRequestOptions<T>
    ): Promise<A.THttpResponse<T>>;

}

class HttpClient
extends $Events.EventEmitter
implements IHttpClient {

    public constructor(
        public ca?: Buffer | Buffer[] | string | string[],
        public secureProtocol?: string,
        public crl?: string | string[] | Buffer | Buffer[],
        public version: A.TVersion = 1.1
    ) {

        super();
    }
    public get<T extends boolean = false>(
        options: A.IClientRequestOptions<T>
    ): Promise<A.THttpResponse<T>> {

        return this._request(options, "GET");
    }

    public post<T extends boolean = false>(
        options: A.IClientRequestOptions<T>
    ): Promise<A.THttpResponse<T>> {

        return this._request(options, "POST");
    }
    public put<T extends boolean = false>(
        options: A.IClientRequestOptions<T>
    ): Promise<A.THttpResponse<T>> {

        return this._request(options, "PUT");
    }
    public patch<T extends boolean = false>(
        options: A.IClientRequestOptions<T>
    ): Promise<A.THttpResponse<T>> {

        return this._request(options, "PATCH");
    }
    public delete<T extends boolean = false>(
        options: A.IClientRequestOptions<T>
    ): Promise<A.THttpResponse<T>> {

        return this._request(options, "DELETE");
    }
    public trace<T extends boolean = false>(
        options: A.IClientRequestOptions<T>
    ): Promise<A.THttpResponse<T>> {

        return this._request(options, "TRACE");
    }

    public options<T extends boolean = false>(
        options: A.IClientRequestOptions<T>
    ): Promise<A.THttpResponse<T>> {

        return this._request(options, "OPTIONS");
    }
    public head<T extends boolean = false>(
        options: A.IClientRequestOptions<T>
    ): Promise<A.THttpResponse<T>> {

        options.headerOnly = true;
        return this._request(options, "HEAD");
    }

    /**
     * fetch the protocol for http or https
     * @param url
     */
    private _fetchProtocol(
        url: A.TURL,
    ) {

        let protocol: typeof http | typeof https;

        if (typeof url === "string") {

            protocol = url.startsWith("http:") ? http : https;
        }
        else {

            protocol = url.secure ? https : http;
        }

        return protocol;
    }

    /**
     * build the request options
     * @param url
     * @param method
     * @param headers
     */
    private _buildRequestOptions<T extends boolean = false>(
        options: A.IClientRequestOptions<T>,
        method: string,
    ) {
        let requestOptions: {
            "host" ?: string,
            "method" ?: string,
            "path" ?: string,
            "port" ?: number,
            "headers" ?: http.OutgoingHttpHeaders,
            "ca" ?: Buffer | Buffer[] | string | string[],
            "crl" ?: string | string[] | Buffer | Buffer[],
            "secureProtocol" ?: string;
        };

        if (typeof options.url === "string") {

            let url = URL.parse(options.url);
            requestOptions = {
                "host": url.host,
                "path": url.path,
                "port": url.port ? parseInt(url.port) : undefined,
                "headers": options.headers,
                "method": method,
            };

            /**
             * http ,return
             */
            if (options.url.startsWith("http:")) {

                return requestOptions;
            }

        }
        else {

            requestOptions = {
                "host": options.url.host,
                "path": options.url.path,
                "method": method,
                "port": options.url.port,
                "headers": options.headers
            };

             /**
              * http ,return
              */
            if (!options.url.secure) {

                return requestOptions;
            }
        }

        if (typeof options.ssl === "object") {

            requestOptions.ca = options.ssl.ca ? options.ssl.ca : this.ca;
            requestOptions.crl = options.ssl.crl ? options.ssl.crl : this.crl;
            requestOptions.secureProtocol = options.ssl.secureProtocol
                    ? options.ssl.secureProtocol : this.secureProtocol;
        }
        else {

            requestOptions.ca = this.ca;
            requestOptions.crl = this.crl;
            requestOptions.secureProtocol = this.secureProtocol;
        }

        return requestOptions;
    }

    /**
     * transfer body into string
     * set the content-length
     * @param headers
     * @param body
     */
    private _prepareBody(
        headers: A.TOutgoingHeaders,
        body?: A.TBody
    ) {
        if (!body) {
            return body;
        }

        if (typeof body === "object"
            && "encoding" in body
            && "data" in body
        ) {

            if (body.encoding === "urlencode") {

                body = $qs.stringify(body.data);
            }
            else {

                body = JSON.stringify(body.data);
            }
        }
        /**
         * set the content-length
         */
        if (body instanceof Readable) {

            if (undefined === headers["content-length"]) {

                return Promise.reject(new Error.E_REQUIRE_CONTENT_LENGTH());
            }

            return body;
        }

        headers["content-length"] = Buffer.byteLength(body as any);

        return body;
    }

    private _request<T extends boolean = false>(
        options: A.IClientRequestOptions<T>,
        method: A.TMethod
    ): Promise < A.THttpResponse < T >> {

        this.emit("pre_request", options);

        let ret = new RawPromise<A.THttpResponse<T>>();
        let url = options.url;
        let responseBuffer: Buffer;

        if (!options.headers) {

            options.headers = {};
        }

        let headers: A.TOutgoingHeaders = {};

        for (let k in options.headers) {

            headers[k.toLowerCase()] = options.headers[k];
        }

        let protocol = this._fetchProtocol(url);

        let body = this._prepareBody(options.headers, options.body);

        let requestOptions = this._buildRequestOptions(options, method);

        let request = protocol.request(
            requestOptions,
            (response: http.IncomingMessage) => {

                this.emit("response", response);

                let stream: Duplex;
                /**
                 * process the gzip and deflate stream
                 */
                if (response.headers["content-encoding"] === "gzip") {

                    stream = response.pipe($zlib.createGunzip());
                }
                else if (response.headers["content-encoding"] === "deflate") {

                    stream = response.pipe($zlib.createInflate());
                }
                else {

                    stream = response as any;
                }

                if (options.returnStream) {

                    return ret.resolve({
                        "content": stream as any,
                        "headers": response.headers,
                        "statusCode": response.statusCode
                    });
                }
                else {
                    /**
                     * return a buffer.
                     */
                    stream.on("data", function(buf: Buffer) {

                        if (responseBuffer) {

                            responseBuffer = Buffer.concat([responseBuffer, buf]);
                        }
                        else {

                            responseBuffer = buf;
                        }
                    });

                    stream.once("end", function() {

                        return ret.resolve({
                            "content": responseBuffer as any,
                            "headers": response.headers,
                            "statusCode": response.statusCode
                        });
                    });

                    stream.once("error", (err: Error) => {

                        return ret.reject(err);
                    });
                }
        });

        request.once("error", (err) => {

            return ret.reject(err);
        });

        /**
         * process the timeout
         */
        if (options.timeout) {

            const TIMEOUT = typeof options.timeout === "number" ? options.timeout : 0;
            const TIMEOUT_CONN = typeof options.timeout !== "number" ? options.timeout.connect || 0 : 0;
            const TIMEOUT_SEND = typeof options.timeout !== "number" ? options.timeout.send || 0 : 0;
            const TIMEOUT_HEAD = typeof options.timeout !== "number" ? options.timeout.response || 0 : 0;
            const TIMEOUT_RECV = typeof options.timeout !== "number" ? options.timeout.receive || 0 : 0;

            if (TIMEOUT) {

                request.setTimeout(TIMEOUT, function() {

                    request.destroy(new Error.E_REQUEST_TIMEOUT());
                });
            }
            else {

                if (TIMEOUT_CONN) {

                    /**
                     * Set the timeout for connecting.
                     */
                    request.setTimeout(TIMEOUT_CONN, function() {

                        request.destroy(new Error.E_CONNECT_TIMEOUT());
                    });
                }

                if (TIMEOUT_SEND) {

                    request.on("socket", function(this: typeof request): void {

                        this.socket.on(
                            "connect",
                            function(this: typeof request.socket): void {

                                this.setTimeout(TIMEOUT_SEND, () => {

                                    ret.reject(new Error.E_SEND_TIMEOUT());
                                });
                            }
                        );
                    });
                }

                if (TIMEOUT_HEAD) {

                    request.on("finish", function(this: typeof request): void {

                        this.setTimeout(TIMEOUT_HEAD, () => {

                            ret.reject(new Error.E_RESPONSE_TIMEOUT());
                         });
                    });
                }

                if (TIMEOUT_RECV) {

                    request.on("response", function(this: typeof request): void {

                        this.setTimeout(TIMEOUT_RECV, () => {

                            ret.reject(new Error.E_RECEIVE_TIMEOUT());
                         });
                    });
                }
            }
        }

        if (body) {

            if (typeof body === "string" ||
                body instanceof Buffer
            ) {

                request.write(body);
                request.end();
            }
            else if ( "pipe" in body) {

                body.pipe(request);
            }
            else {

                request.end();
            }
        }
        else {

            request.end();
        }

        return ret.promise;
    }

}

export function createHttpClient(
    version: A.TVersion = 1.1,
    ca?: Buffer | Buffer[] | string | string[],
    secureProtocol ?: string,
    crl?: string | string[] | Buffer | Buffer[]
): IHttpClient {

    return new HttpClient(ca, secureProtocol, crl, version);
}
