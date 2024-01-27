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
 * The base class of all HttpClient errors.
 */
export abstract class AbstractHttpClientError extends Error {

    /**
     * The unique identifier of the exception.
     */
    public static id: string = 'unknown';

    /**
     * The description message of the exception.
     */
    public static message: string = 'unknown';

    /**
     * The context of the exception.
     */
    public static context?: Record<string, unknown>;

    public constructor(
        public context: Record<string, unknown> = {},
        public readonly origin: unknown = null
    ) {

        super();

        this.name = (this as any).constructor.id;
        this.message = (this as any).constructor.message;

        if ((this as any).constructor.context) {

            this.context = {
                ...(this as any).constructor.context,
                ...context,
            };
        }
    }
}

export const E_EMPTY_AUTH_CREDENTIALS = class extends AbstractHttpClientError {

    public static override id = 'empty_auth_credentials';

    public static override message = 'The authentication credential is empty.';
};

export const E_UNKNOWN_AUTH_TYPE = class extends AbstractHttpClientError {

    public static override id = 'unknown_auth_type';

    public static override message = 'The type of authentication is not recognizable.';
};

export const E_NO_CONTENT_LENGTH = class extends AbstractHttpClientError {

    public static override id = 'no_content_length';

    public static override message = 'The header content-length is not specific.';
};

export const E_PROTOCOL_NOT_SUPPORTED = class extends AbstractHttpClientError {

    public static override id = 'protocol_not_supported';

    public static override message = 'The protocol is not supported.';
};

export const E_TOO_LARGE_RESPONSE_ENTITY = class extends AbstractHttpClientError {

    public static override id = 'too_large_response_entity';

    public static override message = 'The entity of response is too large.';
};

export const E_NO_RESPONSE_ENTITY = class extends AbstractHttpClientError {

    public static override id = 'no_response_entity';

    public static override message = 'The response entity is empty.';
};
