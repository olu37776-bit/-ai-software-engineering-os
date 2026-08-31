# P1-O06 authenticated loopback Control API

Status: `IMPLEMENTED` (independent verification remains required)

## Scope

P1-O06 implements the Phase 1 qualification slice from ADR-0009. It does not implement a
production Workflow runtime, durable Control Operation resource, authoritative event journal, or
remote transport.

The composition boundary is deliberately small:

- `@aseos/runtime` starts and owns the public `@aseos/platform` Control API lifecycle;
- `@aseos/cli` implements `start`, `version`, `doctor`, `status`, and `stop`;
- every CLI query and lifecycle mutation uses `createControlApiClient`; the CLI has no Kernel,
  persistence, SQLite, or database dependency;
- `start` only launches the Runtime executable and then proves readiness through the authenticated
  public client.

## Security and protocol controls

The qualification requires an OS-assigned port bound exclusively to `127.0.0.1`, a per-start
256-bit bearer token, user-only token ACLs, constant-time token verification, strict Host and Origin
handling, bounded request/response/authentication/idempotency/SSE state, and RFC 9457-style redacted
problem responses. Token values are absent from the descriptor, CLI output, errors, and Evidence.

`POST /v1/runtime/stop` is an idempotency-keyed local lifecycle request. Its accepted response does
not claim durable operation semantics: the Phase 1 qualification runtime flushes the response and
then exits. A future durable operation resource requires an authorized operation and Contract.

SSE is read-only projection metadata. Retained notifications support `Last-Event-ID`; a retention
gap is explicit and requires the client to re-query the resource. It is not an Event journal export
or Command transport.

## Executable qualification

- `tests/qualification/control-api/openapi-structure.test.mjs` checks the OpenAPI 3.1.1 public
  surface and global bearer authentication.
- `tests/qualification/control-api/p1-v07-control-api.test.mjs` covers loopback exposure, Host,
  Origin, bearer authentication, rate limits, token ACL/redaction/rotation, request limits,
  bounded idempotency, and SSE replay/gap behavior.
- `tests/acceptance/control-api/cli-public-api.acceptance.test.mjs` executes the built Runtime and
  CLI entrypoints in a data-root path containing spaces and Chinese characters.
- `scripts/qualification/control-api/qualify-control-api.mjs` emits the four Evidence result types
  required by `P1-V07-CONTROL-API` without including the token value.

Windows token creation is fail-closed: if `icacls.exe` cannot remove inheritance, grant the current
user full control, or verify a non-public ACL, Runtime startup fails before readiness and removes the
token file. Linux qualification requires no group/other permission bits (`0600`).
