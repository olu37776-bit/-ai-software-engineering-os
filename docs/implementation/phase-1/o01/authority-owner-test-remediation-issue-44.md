# Issue #44 Authority owner qualification remediation

Status: `IMPLEMENTED`

PR #43 exposed a stale P1-O01 qualification assertion. The test hard-coded that `packages/contracts/schema-registry.json` belonged only to P1-O02, so the independently authorized final P1-O04 ownership amendment made the test fail even though WRITE_SCOPE and Authority Lock validation accepted the exact three intended deltas.

The test now treats Authority Lock as the canonical owner declaration:

- every operation in the path's `allowedOperationIds` must pass both operation scope and Authority validation;
- an operation absent from that owner set must still fail with `AUTHORITY_OPERATION_DENIED`;
- no owner set is copied into the test.

This lets the current single-owner state and the separately authorized future two-owner state use the same fail-closed qualification without changing scope, Authority, verifier, workflow, timeout, package, Contract, ADR, or Runtime content.

## Immutable implementation

- Base: `9196de777663d4753fbb1b7001b9d150aedc08b4`
- Code commit: `bd11415ad0894d83f483d4334778df9a6591ef42`
- Code tree: `b369111109352cf81e5dad1b24d09a8b93a7cd32`
- PR: #45

The first code head used the wrong Authority Lock collection name and failed as `P1-O01-44-CI-01`. The qualified code head uses canonical `authorityFiles`; the failed head remains historical Evidence.

## Qualification

- WRITE_SCOPE preflight: `OPERATION_EXECUTION / P1-O01 / DENY_BY_DEFAULT / 0 violations`
- Preflight M0: run `33332668584`, job `99313949120`, PASS
- Required `verify`: run `33332827539`, job `99314380683`, PASS
- Quality: run `33332827506`, PASS
- Linux: job `99314401587`, PASS
- Windows: job `99314401744`, PASS
- Aggregator: job `99314832657`, PASS
- Root: 19 files / 125 tests
- Architecture: 9 tests
- Clean build/test: PASS

This is not a VERIFIED declaration. Immutable Evidence-head qualification, independent verification, exact merge, and protected-main post-merge qualification remain required. P1-O04 has not started.
