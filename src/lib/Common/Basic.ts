/**
 * Copyright 2026 Angus.Fenying <fenying@litert.org>
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
 * A core HTTP request method supported by the client.
 *
 * The method names are uppercase because they are written to the request as
 * provided.
 *
 * @example
 * ```ts
 * import type { THttpMethod } from '@litert/http-client';
 *
 * const method: THttpMethod = 'GET';
 * ```
 */
export type THttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'TRACE' | 'DELETE' | 'OPTIONS';

/**
 * A request method used by WebDAV or a related HTTP extension.
 *
 * @example
 * ```ts
 * import type { TWebDAVMethod } from '@litert/http-client';
 *
 * const method: TWebDAVMethod = 'PROPFIND';
 * ```
 */
export type TWebDAVMethod = 'PATCH' | 'COPY' | 'LOCK' | 'UNLOCK' |
                            'MOVE' | 'MKCOL' | 'PROPFIND' | 'PROPPATCH' |
                            'REPORT' | 'MKACTIVITY' | 'CHECKOUT' | 'MERGE' |
                            'M-SEARCH' | 'NOTIFY' | 'SUBSCRIBE' | 'UNSUBSCRIBE';

/**
 * Any request method accepted by `IRequestOptions`.
 *
 * @example
 * ```ts
 * import type { TMethod } from '@litert/http-client';
 *
 * const method: TMethod = 'PATCH';
 * ```
 */
export type TMethod = THttpMethod | TWebDAVMethod;

/**
 * A response-header map returned by `IResponse.headers`.
 *
 * Header values can be scalar values or arrays when a field occurs more than
 * once in the response.
 *
 * @example
 * ```ts
 * import { Headers, type TResponseHeaders } from '@litert/http-client';
 *
 * const headers: TResponseHeaders = {
 *     [Headers.CONTENT_TYPE]: 'application/json',
 *     'set-cookie': ['session=abc', 'theme=dark'],
 * };
 * ```
 */
export type TResponseHeaders = Record<string, string | number | Array<string | number>>;

/**
 * Selects required and optional properties from a complete options type.
 *
 * Only keys listed by `TRequired` or `TOptional` are included. Required keys
 * remain mandatory, while optional keys may be omitted.
 *
 * @typeParam T The complete source object type.
 * @typeParam TRequired Keys from `T` that must be present in the result.
 * @typeParam TOptional Keys from `T` that may be omitted from the result.
 *
 * @example
 * ```ts
 * import type { CreateInputOptions } from '@litert/http-client';
 *
 * interface ICompleteOptions {
 *     id: string;
 *     label: string;
 *     enabled: boolean;
 * }
 *
 * type IInputOptions = CreateInputOptions<
 *     ICompleteOptions,
 *     'id',
 *     'label' | 'enabled'
 * >;
 *
 * const input: IInputOptions = { id: 'example' };
 * ```
 */
export type CreateInputOptions<T, TRequired extends keyof T, TOptional extends keyof T> = {

    [P in TRequired]-?: T[P];
} & {

    [P in TOptional]?: T[P];
};

/**
 * Selects the HTTP protocol used for a request.
 *
 * When the request option is omitted, the client uses
 * {@link EVersion.HTTP_1_1}. Automatic protocol negotiation applies to HTTPS;
 * plain HTTP requests using {@link EVersion.ALPN} use HTTP/1.1.
 *
 * @example
 * ```ts
 * import {
 *     EVersion,
 *     type IRequestOptionsInput,
 * } from '@litert/http-client';
 *
 * const options: IRequestOptionsInput = {
 *     method: 'GET',
 *     url: 'https://example.com/',
 *     version: EVersion.ALPN,
 * };
 * ```
 */
export enum EVersion {
    /**
     * Send the request using HTTP/1.1.
     */
    HTTP_1_1 = 1.1,

    /**
     * Send the request using HTTP/2.
     */
    HTTP_2 = 2,

    /**
     * Negotiate HTTP/1.1 or HTTP/2 for HTTPS requests.
     *
     * @deprecated Use `EVersion.ALPN` instead.
     */
    AUTO = 0,

    /**
     * Negotiate HTTP/1.1 or HTTP/2 by ALPN for HTTPS requests.
     *
     * Plain HTTP requests use HTTP/1.1 because ALPN is a TLS extension.
     */
    ALPN = 0,
}
