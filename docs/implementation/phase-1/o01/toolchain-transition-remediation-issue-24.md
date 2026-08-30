# Issue #24 toolchain transition remediation

Status: `IMPLEMENTED` (not independently `VERIFIED`)

Issue #24 closes two P1-O01-owned transition constraints discovered by a fail-closed P1-O02
preflight. It does not amend WRITE_SCOPE, change accepted ADRs, resume P1-O02, or implement any
Contract or Runtime capability.

## Lockfile authority

`pnpm-lock.yaml` remains the sole canonical package dependency identity. The toolchain manifest
continues to own exact Node.js, pnpm, TypeScript, build, package-manager policy, supply-chain and
workflow-action versions, but no longer stores the hash of the initial P1-O01 lockfile snapshot.

`verify-versions.mjs`, `verify-frozen-install.mjs`, and CI Evidence compute the current lockfile
SHA-256 directly from the live lockfile using `SHA256_UTF8_LF_NORMALIZED`. This keeps the hash
deterministic across LF and CRLF checkouts while allowing a later authorized operation to change
the canonical lockfile without also mutating toolchain-version authority. The frozen offline
install still compares the copied lockfile with the authority lockfile and now emits the derived
hash together with `lockfileUnchanged: true`.

The manifest schema rejects the removed `lockfileSha256` snapshot property. No compatibility
field, second lockfile identity file, or fallback acceptance path was introduced.

## Topology regression isolation

The historical empty-workspace regression is now a fully synthetic fixture with an explicit
empty workspace, mandatory toolchain project reference, and matching synthetic existence facts.
It no longer reads live workspace or root-build topology.

The separate `verify-config.mjs` test continues to validate the live repository against real
filesystem facts. Generic workspace-package and non-package TypeScript project fixtures, plus all
existing duplicate, malformed, unsafe, missing-project and missing-manifest fail-closed cases,
remain active. No P1-O02 or Contracts-specific exception was added.

## Claim boundary

This implementation may be declared only `IMPLEMENTED`. Issue #24 requires independent
verification, protected-main merge, post-merge qualification and a new independently verified
P1-O02 resume Gate before Contract implementation can resume.
