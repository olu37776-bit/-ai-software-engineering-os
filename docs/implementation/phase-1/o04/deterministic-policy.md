# P1-O04 deterministic Policy implementation

Status: IMPLEMENTED — independent verification and protected-main merge are still required.

## Boundary

P1-O04 establishes the Phase 1 deterministic Policy compiler/evaluator skeleton in
`packages/policy`. It activates five JSON Schema 2020-12 Contracts and reuses the
existing `PolicyDecision` authority. It does not implement Kernel integration,
Workflow runtime semantics, an external policy engine, or dynamic evaluation I/O.

## Determinism and fail-closed behavior

The compiler accepts canonical PolicySet JSON or the bounded block-only authoring
subset of YAML. It rejects duplicate keys and set items, tags, anchors, aliases,
merge keys, flow collections, templates, environment substitution, unsafe
prototype keys, unbounded structures, invalid references, unknown operators, and
unsupported versions. Evaluation requires the exact input and snapshot schema
shape, bounded fields, RFC 3339 timestamps, SemVer metadata, and internally
consistent snapshot identities before any allow path.

Compiled rules remain canonical PolicySet values. Rule IDs and set-like fields are
sorted with explicit code-unit ordering independent of ambient locale, canonical
JSON is hashed with SHA-256, and the snapshot hash excludes the snapshot envelope
to avoid self-reference. I-JSON validation rejects lone surrogates in values and
property names. The evaluator consumes only captured
input, never reads I/O or system time, applies built-in hard invariants first,
uses deny-overrides and default-deny, and maps invalid or conflicting evaluation
states to `INDETERMINATE`.

## Qualification

The remediated qualified implementation is
`f5aa27e3b6e0378b231267d5d6bd08a897ceae8f` with tree
`0a5fbc1ada884504e98c387c85b5b81cd9ce9d0e`.

- M0 required `verify`: PASS.
- Linux and Windows frozen qualification: PASS.
- Root suite: 21 files / 141 tests.
- P1-V05 focused suite: 10 tests, including 20 property permutations and
  adversarial schema, locale, and I-JSON key regressions.
- Architecture regression: 9 tests.
- Contract registry: 36 entries; inventory: 20 active / 53 planned; type bindings: 24.
- Five Policy schemas each have direct valid and invalid Contract fixtures.
- Independent findings `P1-O04-IV-01`, `P1-O04-IV-02`, and
  `P1-O04-IV-03` are remediated with executable regressions; exact-head
  re-verification is still required.

The implementation Evidence is
`operations/phase-1/evidence/o04/p1-v05-policy.json`. Its status is
`IMPLEMENTED`; only an independent immutable-head verdict, exact merge, and
protected-main post-merge qualification may advance the operation to VERIFIED.
