# Changes Logs

## v1.1.0

- fix(client): HTTP/2 should ignore body of DELETE method.
- fix(client): Use HTTP/1.1 when ALPN is not supported by remote server.
- fix(client): Preventing from memory leak when `h2` is selected by ALPN.
- fix(client): Allow string-type content-length.
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
