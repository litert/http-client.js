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

import * as Core from "@litert/core";
export const Errors = Core.createErrorHub("@litert/http-client");
export const E_REQUIRE_CONTENT_LENGTH = Errors.define(
    null,
    "E_REQUIRE_CONTENT_LENGTH",
    "require content length."
);

export const E_CONNECT_TIMEOUT = Errors.define(
    null,
    "E_CONNECT_TIMEOUT",
    "connect timeout"
);

export const E_SEND_TIMEOUT = Errors.define(
    null,
    "E_SEND_TIMEOUT",
    "send timeout"
);

export const E_RESPONSE_TIMEOUT = Errors.define(
    null,
    "E_RESPONSE_TIMEOUT",
    "response timeout"
);

export const E_RECEIVE_TIMEOUT = Errors.define(
    null,
    "E_RECEIVE_TIMEOUT",
    "receive timeout"
);

export const E_REQUEST_TIMEOUT = Errors.define(
    null,
    "E_REQUEST_TIMEOUT",
    "request timeout"
);
