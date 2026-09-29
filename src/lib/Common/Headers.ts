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

import * as $H2 from 'http2';

/**
 * The lowercase `accept` request-header name.
 *
 * Use this field to list the response media types accepted by the caller.
 */
export const ACCEPT = 'accept';

/**
 * The lowercase `accept-encoding` request-header name.
 *
 * The client sets this field from the `gzip` and `deflate` request options
 * after `pre_request` filters have run.
 */
export const ACCEPT_ENCODING = 'accept-encoding';

/**
 * The lowercase `accept-language` request-header name.
 *
 * Use this field to send the caller's preferred response languages.
 */
export const ACCEPT_LANGUAGE = 'accept-language';

/**
 * The HTTP/1.1 `content-length` header name.
 *
 * Use this alias in HTTP/1.1 request headers and as the client's canonical
 * request input key for either protocol. The client calculates and writes the
 * byte length for string and Buffer entities. A Readable entity has no
 * discoverable length, so its byte length must be supplied explicitly with
 * this header.
 */
export const CONTENT_LENGTH_H1 = 'content-length';

/**
 * The HTTP/2 `:status` response pseudo-header name.
 *
 * Normal client responses also expose the parsed value through
 * `IResponse.statusCode`.
 */
export const STATUS_CODE_H2 = $H2.constants.HTTP2_HEADER_STATUS;

/**
 * The HTTP/2 `:path` request pseudo-header name.
 *
 * The client derives this field from the request URL when sending HTTP/2.
 */
export const PATH_H2 = $H2.constants.HTTP2_HEADER_PATH;

/**
 * The HTTP/2 `content-length` header name.
 *
 * The client writes this field when sending HTTP/2 after processing the
 * canonical {@link CONTENT_LENGTH_H1} input header. String and Buffer entity
 * lengths are calculated automatically; a Readable entity requires an
 * explicit {@link CONTENT_LENGTH_H1} value.
 */
export const CONTENT_LENGTH_H2 = $H2.constants.HTTP2_HEADER_CONTENT_LENGTH;

/**
 * The lowercase `content-type` entity-header name.
 *
 * Use this field to identify the media type of a request or response entity.
 */
export const CONTENT_TYPE = 'content-type';

/**
 * The lowercase `content-encoding` entity-header name.
 *
 * The client inspects this response field when GZIP or deflate decoding is
 * enabled.
 */
export const CONTENT_ENCODING = 'content-encoding';
