# Changes Logs

## v1.0.4

- fix(client): HTTP/2 should use hostname in URL as host instead of `remoteHost`

## v1.0.3

- fix(client): Apply timeout for response stream.

## v1.0.2

- fix(client): skip releasing closed connection pools.

## v1.0.1

- fix(client): add `host` header in h1 request.
- fix(client): add `:authority` header in h2 request.
