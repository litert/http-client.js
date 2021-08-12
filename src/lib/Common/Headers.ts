/**
 * Copyright 2021 Angus.Fenying <fenying@litert.org>
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

export const ACCEPT = 'accept';

export const ACCEPT_ENCODING = 'accept-encoding';

export const ACCEPT_LANGUAGE = 'accept-language';

export const CONTENT_LENGTH_H1 = 'content-length';

export const STATUS_CODE_H2 = $H2.constants.HTTP2_HEADER_STATUS;

export const PATH_H2 = $H2.constants.HTTP2_HEADER_PATH;

export const CONTENT_LENGTH_H2 = $H2.constants.HTTP2_HEADER_CONTENT_LENGTH;

export const CONTENT_TYPE = 'content-type';

export const CONTENT_ENCODING = 'content-encoding';
