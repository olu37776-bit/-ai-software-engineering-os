# P1-O04 deterministic Policy implementation

Status: IMPLEMENTED — independent verification and protected-main merge are still required.

## Boundary

P1-O04 establishes the Phase 1 deterministic Policy compiler/evaluator skeleton in
`packages/policy`. It activates five JSON Schema 2020-12 Contracts and reuses the
existing `PolicyDecision` authority. It does not implement Kernel integration,
Workflow runtime semantics, an external policy engine, or dynamic evaluation I/O.

## Determinism and fail-closed behavior

The compiler accepts canonical PolicySet JSON or the bounded block-only authoring
subset of YAML. It rejects duplicate keys, tags, anchors, aliases, merge keys,
flow collections, templates, environment substitution, unsafe prototype keys,
unbounded structures, invalid references, unknown operators, and unsupported
versions.

Compiled rules remain canonical PolicySet values. Rule IDs and set-like fields are
sorted, canonical JSON is hashed with SHA-256, and the snapshot hash excludes the
snapshot envelope to avoid self-reference. The evaluator consumes only captured
input, never reads I/O or system time, applies built-in hard invariants first,
uses deny-overrides and default-deny, and maps invalid or conflicting evaluation
states to `INDETERMINATE`.

## Qualification

The qualified implementation is
`a1bd6b3374b9a1b8e51ab6431b2b36892e05aef9` with tree
`0c84e148ebf6a17ea366ef9fb3cd7172343d6031`.

- M0 required `verify`: PASS.
- Linux and Windows frozen qualification: PASS.
- Root suite: 21 files / 139 tests.
- P1-V05 focused suite: 8 tests, including 20 property permutations.
- Architecture regression: 9 tests.
- Contract registry: 36 entries; inventory: 20 active / 53 planned; type bindings: 24.
- Five Policy schemas each have direct valid and invalid Contract fixtures.

The implementation Evidence is
`operations/phase-1/evidence/o04/p1-v05-policy.json`. Its status is
`IMPLEMENTED`; only an independent immutable-head verdict, exact merge, and
protected-main post-merge qualification may advance the operation to VERIFIED.
