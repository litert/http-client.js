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
/// <reference types="node" />
import * as A from "./Abstracts";
import * as http from "http";
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
    get<T extends boolean = false>(options: A.IClientRequestOptions<T>): Promise<A.THttpResponse<T>>;
    /**
     * options方法
     * @param options
     */
    options<T extends boolean = false>(options: A.IClientRequestOptions<T>): Promise<A.THttpResponse<T>>;
    /**
     * head方法
     * @param options
     */
    head<T extends boolean = false>(options: A.IClientRequestOptions<T>): Promise<A.THttpResponse<T>>;
    /**
     * trace方法
     * @param options
     */
    trace<T extends boolean = false>(options: A.IClientRequestOptions<T>): Promise<A.THttpResponse<T>>;
    /**
     * post方法
     * @param options
     */
    post<T extends boolean = false>(options: A.IClientRequestOptions<T>): Promise<A.THttpResponse<T>>;
    /**
     * put方法
     * @param options
     */
    put<T extends boolean = false>(options: A.IClientRequestOptions<T>): Promise<A.THttpResponse<T>>;
    /**
     * patch方法
     * @param options
     */
    patch<T extends boolean = false>(options: A.IClientRequestOptions<T>): Promise<A.THttpResponse<T>>;
    /**
     * delete方法
     * @param options
     */
    delete<T extends boolean = false>(options: A.IClientRequestOptions<T>): Promise<A.THttpResponse<T>>;
}
export declare function createHttpClient(version?: A.TVersion, ca?: Buffer | Buffer[] | string | string[], secureProtocol?: string, crl?: string | string[] | Buffer | Buffer[]): IHttpClient;
//# sourceMappingURL=client.d.ts.map