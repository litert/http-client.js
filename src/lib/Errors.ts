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

import * as L from '@litert/core';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ErrorHub = L.createErrorHub('@litert/http-client');

export const E_EMPTY_AUTH_CREDENTIALS = ErrorHub.define(
    null,
    'E_EMPTY_AUTH_CREDENTIALS',
    'The authentication credential is empty.',
    {}
);

export const E_UNKNOWN_AUTH_TYPE = ErrorHub.define(
    null,
    'E_UNKNOWN_AUTH_TYPE',
    'The type of authentication is not recognizable.',
    {}
);

export const E_NO_CONTENT_LENGTH = ErrorHub.define(
    null,
    'E_NO_CONTENT_LENGTH',
    'The header content-length is not specific.',
    {}
);

export const E_PROTOCOL_NOT_SUPPORTED = ErrorHub.define(
    null,
    'E_PROTOCOL_NOT_SUPPORTED',
    'The protocol is not supported.',
    {}
);

export const E_TOO_LARGE_RESPONSE_ENTITY = ErrorHub.define(
    null,
    'E_TOO_LARGE_RESPONSE_ENTITY',
    'The entity of response is too large.',
    {}
);

export const E_NO_RESPONSE_ENTITY = ErrorHub.define(
    null,
    'E_NO_RESPONSE_ENTITY',
    'The response entity is empty.',
    {}
);
