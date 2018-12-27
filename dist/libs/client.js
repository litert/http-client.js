"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const stream_1 = require("stream");
const http = require("http");
const https = require("https");
const core_1 = require("@litert/core");
const $zlib = require("zlib");
const $qs = require("querystring");
const $Events = require("events");
const Error = require("./Errors");
class HttpClient extends $Events.EventEmitter {
    constructor(ca, secureProtocol, crl, version = 1.1) {
        super();
        this.ca = ca;
        this.secureProtocol = secureProtocol;
        this.crl = crl;
        this.version = version;
    }
    get(options) {
        return this._request(options, "GET");
    }
    post(options) {
        return this._request(options, "POST");
    }
    put(options) {
        return this._request(options, "PUT");
    }
    patch(options) {
        return this._request(options, "PATCH");
    }
    delete(options) {
        return this._request(options, "DELETE");
    }
    trace(options) {
        return this._request(options, "TRACE");
    }
    options(options) {
        return this._request(options, "OPTIONS");
    }
    head(options) {
        options.headerOnly = true;
        return this._request(options, "HEAD");
    }
    /**
     * fetch the protocol for http or https
     * @param url
     */
    _fetchProtocol(url) {
        let protocol;
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
    _buildRequestOptions(url, method, headers) {
        let requestOptions;
        if (typeof url === "string") {
            requestOptions = url;
        }
        else {
            requestOptions = {
                "host": url.host,
                "path": url.path,
                "method": method,
                "port": url.port,
                "headers": headers
            };
            if (typeof url.secure === "object") {
                requestOptions.ca = url.secure.ca ? url.secure.ca : this.ca;
                requestOptions.crl = url.secure.crl ? url.secure.crl : this.crl;
                requestOptions.secureProtocol = url.secure.secureProtocol
                    ? url.secure.secureProtocol : this.secureProtocol;
            }
            else if (url.secure === true) {
                requestOptions.ca = this.ca;
                requestOptions.crl = this.crl;
                requestOptions.secureProtocol = this.secureProtocol;
            }
        }
        return requestOptions;
    }
    /**
     * transfer body into string
     * set the content-length
     * @param headers
     * @param body
     */
    _restructBody(headers, body) {
        if (!body) {
            return body;
        }
        if (typeof body === "object"
            && "encoding" in body
            && "data" in body) {
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
        if (body instanceof stream_1.Readable) {
            if (undefined === headers["content-length"]) {
                return Promise.reject(new Error.E_REQUIRE_CONTENT_LENGTH());
            }
            return body;
        }
        headers["content-length"] = Buffer.byteLength(body);
        return body;
    }
    _request(options, method) {
        this.emit("pre_request", options);
        let ret = new core_1.RawPromise();
        let returnStream = options.returnStream === true ? true : false;
        let url = options.url;
        let responseBuffer;
        if (!options.headers) {
            options.headers = {};
        }
        let headers = {};
        for (let k in options.headers) {
            headers[k.toLowerCase()] = options.headers[k];
        }
        let protocol = this._fetchProtocol(url);
        let body = this._restructBody(options.headers, options.body);
        let requestOptions = this._buildRequestOptions(url, method, options.headers);
        let request = protocol.request(requestOptions, (response) => {
            this.emit("response", response);
            let stream;
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
                stream = response;
            }
            if (returnStream === true) {
                return ret.resolve({
                    "content": stream,
                    "headers": response.headers,
                    "statusCode": response.statusCode
                });
            }
            else {
                /**
                 * return a buffer.
                 */
                stream.on("data", function (buf) {
                    if (responseBuffer) {
                        responseBuffer = Buffer.concat([responseBuffer, buf]);
                    }
                    else {
                        responseBuffer = buf;
                    }
                });
                stream.once("end", function () {
                    return ret.resolve({
                        "content": responseBuffer,
                        "headers": response.headers,
                        "statusCode": response.statusCode
                    });
                });
                stream.once("error", (err) => {
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
                request.setTimeout(TIMEOUT, function () {
                    request.destroy(new Error.E_REQUEST_TIMEOUT());
                });
            }
            else {
                if (TIMEOUT_CONN) {
                    /**
                     * Set the timeout for connecting.
                     */
                    request.setTimeout(TIMEOUT_CONN, function () {
                        request.destroy(new Error.E_CONNECT_TIMEOUT());
                    });
                }
                if (TIMEOUT_SEND) {
                    request.on("socket", function () {
                        this.socket.on("connect", function () {
                            this.setTimeout(TIMEOUT_SEND, () => {
                                ret.reject(new Error.E_SEND_TIMEOUT());
                            });
                        });
                    });
                }
                if (TIMEOUT_HEAD) {
                    request.on("finish", function () {
                        this.setTimeout(TIMEOUT_HEAD, () => {
                            ret.reject(new Error.E_RESPONSE_TIMEOUT());
                        });
                    });
                }
                if (TIMEOUT_RECV) {
                    request.on("response", function () {
                        this.setTimeout(TIMEOUT_RECV, () => {
                            ret.reject(new Error.E_RECEIVE_TIMEOUT());
                        });
                    });
                }
            }
        }
        if (body) {
            if (typeof body === "string" ||
                body instanceof Buffer) {
                request.write(body);
                request.end();
            }
            else if ("pipe" in body) {
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
function createHttpClient(version = 1.1, ca, secureProtocol, crl) {
    return new HttpClient(ca, secureProtocol, crl, version);
}
exports.createHttpClient = createHttpClient;
//# sourceMappingURL=client.js.map