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

import * as $Exceptions from '@litert/exception';

export const errorRegistry = $Exceptions.createExceptionRegistry({
    'module': 'http-client.litert.org',
    'types': {
        'public': {
            'index': $Exceptions.createIncreaseCodeIndex(1)
        }
    }
});

export const E_EMPTY_AUTH_CREDENTIALS = errorRegistry.register({
    name: 'empty_auth_credentials',
    message: 'The authentication credential is empty.',
    metadata: {},
    type: 'public'
});

export const E_UNKNOWN_AUTH_TYPE = errorRegistry.register({
    name: 'unknown_auth_type',
    message: 'The type of authentication is not recognizable.',
    metadata: {},
    type: 'public'
});

export const E_NO_CONTENT_LENGTH = errorRegistry.register({
    name: 'no_content_length',
    message: 'The header content-length is not specific.',
    metadata: {},
    type: 'public'
});

export const E_PROTOCOL_NOT_SUPPORTED = errorRegistry.register({
    name: 'protocol_not_supported',
    message: 'The protocol is not supported.',
    metadata: {},
    type: 'public'
});

export const E_TOO_LARGE_RESPONSE_ENTITY = errorRegistry.register({
    name: 'too_large_response_entity',
    message: 'The entity of response is too large.',
    metadata: {},
    type: 'public'
});

export const E_NO_RESPONSE_ENTITY = errorRegistry.register({
    name: 'no_response_entity',
    message: 'The response entity is empty.',
    metadata: {},
    type: 'public'
});
