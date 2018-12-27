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
const Core = require("@litert/core");
exports.Errors = Core.createErrorHub("@litert/http-client");
exports.E_REQUIRE_CONTENT_LENGTH = exports.Errors.define(null, "E_REQUIRE_CONTENT_LENGTH", "require content length.");
exports.E_CONNECT_TIMEOUT = exports.Errors.define(null, "E_CONNECT_TIMEOUT", "connect timeout");
exports.E_SEND_TIMEOUT = exports.Errors.define(null, "E_SEND_TIMEOUT", "send timeout");
exports.E_RESPONSE_TIMEOUT = exports.Errors.define(null, "E_RESPONSE_TIMEOUT", "response timeout");
exports.E_RECEIVE_TIMEOUT = exports.Errors.define(null, "E_RECEIVE_TIMEOUT", "receive timeout");
exports.E_REQUEST_TIMEOUT = exports.Errors.define(null, "E_REQUEST_TIMEOUT", "request timeout");
//# sourceMappingURL=Errors.js.map