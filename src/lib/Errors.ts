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
 * Base class for errors defined by the HTTP client.
 *
 * Each concrete error supplies a stable static identifier and message. The
 * constructor copies them to the instance's `name` and `message`, merges any
 * static context with the instance context, and retains an optional underlying
 * cause in `origin`. Context should contain structured, non-sensitive values
 * that help a caller diagnose the failure.
 *
 * @example
 * ```ts
 * import {
 *     AbstractHttpClientError,
 *     E_INVALID_URL,
 *     createHttpClient
 * } from '@litert/http-client';
 *
 * const client = createHttpClient();
 *
 * try {
 *     await client.request({ method: 'GET', url: 'not-an-absolute-url' });
 * }
 * catch (error) {
 *     if (error instanceof E_INVALID_URL) {
 *         console.error(error.name, error.origin);
 *     }
 *     else if (error instanceof AbstractHttpClientError) {
 *         console.error(error.name, error.context);
 *     }
 * }
 * finally {
 *     client.close();
 * }
 * ```
 */
export abstract class AbstractHttpClientError extends Error {

    /**
     * Stable identifier copied to the instance's `name` property.
     *
     * Concrete error classes override this value.
     *
     * @default 'unknown'
     */
    public static id: string = 'unknown';

    /**
     * Human-readable description copied to the instance's `message` property.
     *
     * Concrete error classes override this value.
     *
     * @default 'unknown'
     */
    public static message: string = 'unknown';

    /**
     * Default structured context merged into each instance.
     *
     * Instance context takes precedence when both objects contain the same
     * property.
     *
     * @default undefined
     */
    public static context?: Record<string, unknown>;

    /**
     * Create an HTTP client error.
     *
     * @param context Structured diagnostic values for this occurrence. These
     * values override same-named entries in the concrete error's static
     * context.
     * @param origin The underlying value that caused this error, when one is
     * available. The value is retained unchanged.
     */
    public constructor(
        /**
         * Structured diagnostic context for this occurrence.
         *
         * Values here override same-named entries in the concrete error's
         * static context.
         *
         * @default {}
         */
        public context: Record<string, unknown> = {},
        /**
         * Underlying value that caused this error, retained unchanged.
         *
         * @default null
         */
        public readonly origin: unknown = null
    ) {

        super();

        const errorType = this.constructor as typeof AbstractHttpClientError;

        this.name = errorType.id;
        this.message = errorType.message;

        if (errorType.context) {

            this.context = {
                ...errorType.context,
                ...context,
            };
        }
    }
}

/**
 * Error reported when a Basic username or Bearer credential is empty.
 *
 * Authentication preprocessors create this error with empty context and a
 * `null` origin before dispatching the request.
 */
export const E_EMPTY_AUTH_CREDENTIALS = class extends AbstractHttpClientError {

    /**
     * Stable identifier assigned to the instance's `name` property:
     * `empty_auth_credentials`.
     */
    public static override id = 'empty_auth_credentials';

    /**
     * Human-readable message: `The authentication credential is empty.`
     */
    public static override message = 'The authentication credential is empty.';
};

/**
 * Error reported when a request's authentication cannot be resolved.
 *
 * This occurs when authentication is not `none` and no registered preprocessor
 * produced an authorization header. Client-created instances have empty
 * context and a `null` origin.
 */
export const E_UNKNOWN_AUTH_TYPE = class extends AbstractHttpClientError {

    /**
     * Stable identifier assigned to the instance's `name` property:
     * `unknown_auth_type`.
     */
    public static override id = 'unknown_auth_type';

    /**
     * Human-readable message: `The type of authentication is not
     * recognizable.`
     */
    public static override message = 'The type of authentication is not recognizable.';
};

/**
 * Error reported when a streamed request entity has no content length.
 *
 * Set a `content-length` request header before sending a `Readable` body.
 * Client-created instances have empty context and a `null` origin.
 */
export const E_NO_CONTENT_LENGTH = class extends AbstractHttpClientError {

    /**
     * Stable identifier assigned to the instance's `name` property:
     * `no_content_length`.
     */
    public static override id = 'no_content_length';

    /**
     * Human-readable message: `The header content-length is not specific.`
     */
    public static override message = 'The header content-length is not specific.';
};

/**
 * Error reported when the requested or negotiated protocol is unsupported.
 *
 * This includes unsupported URL protocols, HTTP versions, and ALPN results.
 * Client-created instances have empty context and a `null` origin.
 */
export const E_PROTOCOL_NOT_SUPPORTED = class extends AbstractHttpClientError {

    /**
     * Stable identifier assigned to the instance's `name` property:
     * `protocol_not_supported`.
     */
    public static override id = 'protocol_not_supported';

    /** Human-readable message: `The protocol is not supported.` */
    public static override message = 'The protocol is not supported.';
};

/**
 * Error reported when a request URL string is not a valid absolute URL.
 *
 * Client-created instances use empty context so the potentially sensitive URL
 * is not retained. The `origin` contains the native URL parser error.
 */
export const E_INVALID_URL = class extends AbstractHttpClientError {

    /**
     * Stable identifier assigned to the instance's `name` property:
     * `invalid_url`.
     */
    public static override id = 'invalid_url';

    /** Human-readable message: `The request URL is invalid.` */
    public static override message = 'The request URL is invalid.';
};

/**
 * Error reported when buffering a response would exceed the caller's limit.
 *
 * The limit applies to bytes emitted after configured gzip or deflate
 * decoding. The context contains `maxBytes`, and the client uses a `null`
 * origin.
 */
export const E_TOO_LARGE_RESPONSE_ENTITY = class extends AbstractHttpClientError {

    /**
     * Stable identifier assigned to the instance's `name` property:
     * `too_large_response_entity`.
     */
    public static override id = 'too_large_response_entity';

    /**
     * Human-readable message: `The entity of response is too large.`
     */
    public static override message = 'The entity of response is too large.';
};

/**
 * Error reported when a caller requests a stream for a response without an
 * entity.
 *
 * `HEAD`, `204`, and `304` responses have no stream entity. Client-created
 * instances have empty context and a `null` origin.
 */
export const E_NO_RESPONSE_ENTITY = class extends AbstractHttpClientError {

    /**
     * Stable identifier assigned to the instance's `name` property:
     * `no_response_entity`.
     */
    public static override id = 'no_response_entity';

    /** Human-readable message: `The response entity is empty.` */
    public static override message = 'The response entity is empty.';
};

/**
 * Error reported when an `AbortSignal` cancels a request.
 *
 * Client-created instances have empty context. The `origin` retains the
 * signal's reason or the native abort error when available.
 */
export const E_ABORTED = class extends AbstractHttpClientError {

    /**
     * Stable identifier assigned to the instance's `name` property:
     * `aborted`.
     */
    public static override id = 'aborted';

    /** Human-readable message: `The request was aborted.` */
    public static override message = 'The request was aborted.';
};

/**
 * Error reported when a request exceeds its inactivity timeout.
 *
 * The context contains a `phase` value such as `request` or `receiving` to
 * identify where inactivity was observed. Client-created instances use a
 * `null` origin.
 */
export const E_REQUEST_TIMEOUT = class extends AbstractHttpClientError {

    /**
     * Stable identifier assigned to the instance's `name` property:
     * `request_timeout`.
     */
    public static override id = 'request_timeout';

    /** Human-readable message: `The request timed out.` */
    public static override message = 'The request timed out.';
};

/**
 * Error reported for a request-stream or transport lifecycle failure.
 *
 * Request-body pipeline failures retain the underlying error in `origin`.
 * HTTP/2 streams that close before response headers use a `reason` entry in
 * `context` and a `null` origin.
 */
export const E_NETWORK_FAILED = class extends AbstractHttpClientError {

    /**
     * Stable identifier assigned to the instance's `name` property:
     * `network_failed`.
     */
    public static override id = 'network_failed';

    /** Human-readable message: `Failed due to network error.` */
    public static override message = 'Failed due to network error.';
};
