/**
 * Copyright 2024 Angus.Fenying <fenying@litert.org>
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

/**
 * The request methods defined in HTTP/1.1 standard.
 */
export type THttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'TRACE' | 'DELETE' | 'OPTIONS';

/* eslint-disable @typescript-eslint/indent */
/**
 * The request methods defined in WebDAV standard.
 */
export type TWebDAVMethod = 'PATCH' | 'COPY' | 'LOCK' | 'UNLOCK' |
                            'MOVE' | 'MKCOL' | 'PROPFIND' | 'PROPPATCH' |
                            'REPORT' | 'MKACTIVITY' | 'CHECKOUT' | 'MERGE' |
                            'M-SEARCH' | 'NOTIFY' | 'SUBSCRIBE' | 'UNSUBSCRIBE';
/* eslint-enable @typescript-eslint/indent */

/**
 * The type of available request methods.
 */
export type TMethod = THttpMethod | TWebDAVMethod;

/**
 * The type of HTTP header.
 */
export type TResponseHeaders = Record<string, string | number | Array<string | number>>;

export type CreateInputOptions<T, TRequired extends keyof T, TOptional extends keyof T> = {

    [P in TRequired]-?: T[P];
} & {

    [P in TOptional]?: T[P];
};

/**
 * The version of protocol for request.
 */
export enum EVersion {
    HTTP_1_1 = 1.1,
    HTTP_2 = 2,
    AUTO = 0
}
