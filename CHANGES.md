# Changes Logs

## v1.2.0

- chore: upgraded dev-dependencies
- fix(client): correctly process the input stream when failing to send request bodies.
- fix(client): support AbortSignal with E_ABORTED and enforce HTTP/2 connection pool limits.
- fix(client): report secure response protocols and cache both ALPN outcomes correctly.
- fix(client): reject early-closed HTTP/2 streams and exclude destroyed sessions from reuse.
- test(client): add shared loopback fixtures and protocol baseline coverage.
- fix(client): normalize URLs without mutating request input and format authorities with non-default ports.
- fix(client): use typed request timeouts and release HTTP/1.1 and HTTP/2 capacity after abandoned responses.
- fix(client): reuse ALPN-negotiated HTTP/2 sockets and support aborting protocol negotiation.
- fix(client): isolate transport pools by physical destination and compatible capacity settings.
- fix(filters): await promise-compatible callbacks and preserve symbol-based registrations.
- fix(cache): support prototype-like keys and immediate expiration safely.
- test(client): cover dispatch, normalization, timeouts, response lifecycles, filters, and cache behavior.

## v1.1.2

- fix(client): Fixed `IResponse.isServerError` method.

## v1.1.1

- fix(client): Catch the connection error between request and getBuffer/getStream.

## v1.1.0

- fix(client): HTTP/2 should ignore body of DELETE method.
- fix(client): Use HTTP/1.1 when ALPN is not supported by remote server.
- fix(client): Preventing from memory leak when `h2` is selected by ALPN.
- fix(client): Allow string-type content-length.
- fix(client): Renamed `EVersion.AUTO` to `EVersion.ALPN`.
- feat(client): Added filter hook `pre_args` to initialize request arguments, before processing it.
- build(deps): removed all runtime dependencies.

## v1.0.5

- fix(client): fixed timeout while sending request by HTTP/1.1.

## v1.0.4

- fix(client): HTTP/2 should use hostname in URL as host instead of `remoteHost`

## v1.0.3

- fix(client): Apply timeout for response stream.

## v1.0.2

- fix(client): skip releasing closed connection pools.

## v1.0.1

- fix(client): add `host` header in h1 request.
- fix(client): add `:authority` header in h2 request.
