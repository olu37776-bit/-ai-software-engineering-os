# P1-O03 Architecture Enforcement

Status: `IMPLEMENTED`  
Gate: `P1-V04-ARCHITECTURE`  
Authorized base: `bd0efb007728aae65d46f4f776b090150e06193f`

## Implemented boundary

P1-O03 adds one architecture authority rather than a parallel build or runtime system. The root
`@aseos/repository` package is the real Phase 1 consumer of the existing `@aseos/contracts` public
entry. Its exact `workspace:*` edge is recorded in `package.json` and by a four-line importer entry
in the existing frozen lockfile. No future package was created.

`tests/architecture/architecture-policy.json` is the deterministic package-direction policy.
`scripts/architecture/architecture-policy.mjs` loads live package manifests, delegates module graph
extraction to the frozen `dependency-cruiser 18.2.0`, and fails closed on:

- missing governed packages or public entries;
- public subpath exports and `@aseos/*` deep imports;
- unresolved internal imports or unknown workspace imports;
- package/module cycles;
- dependency inversions and non-canonical workspace ranges;
- missing required package and source import edges; and
- duplicate Contract identities, canonical names, or authority paths.

The live semantic-owner check imports only `@aseos/contracts` and calls its public
`loadContractRegistry` and `validateContractInventory` APIs. JSON Schema registry/inventory
validation remains the Contract authority; the architecture layer only verifies the resulting
canonical ownership declarations.

## Downstream fail-closed behavior

The source root is `packages`, so newly added Phase 1 package source is automatically cruised. The
policy contains fixed optional entries for the Phase 1 packages that P1-O03 WRITE_SCOPE names:
kernel, policy, persistence, platform, observability, and the Windows process-restricted adapter.
Absence is allowed and creates no placeholder package. Once one exists, its manifest, public entry,
workspace edges, source imports, cycles, and direction are enforced without a P1-O03 config edit.

Executable fixtures prove that a future `policy -> contracts` import is accepted while a
`policy -> windows-process-restricted` inversion is rejected. This does not authorize package
creation or root topology changes for later operations; their own WRITE_SCOPE still applies.

## Executable qualification

`pnpm run architecture:qualify` builds the existing contracts public entry and emits all P1-V04
results. Root `pnpm run test` executes both the existing toolchain/Contract suite and the dedicated
architecture Vitest config. Root `pnpm run quality` runs P1-V04 in addition to the existing P1-V03,
build, configuration, version, and frozen-install gates.

The negative suite invokes the real verifier paths:

| Boundary         | Executed subject                                           | Expected decision                    |
| ---------------- | ---------------------------------------------------------- | ------------------------------------ |
| Deep import      | dependency-cruiser over `@aseos/contracts/src/registry.js` | reject                               |
| Module cycle     | dependency-cruiser over two mutually importing modules     | reject                               |
| Inversion        | dependency-cruiser over contracts importing root           | reject                               |
| Future direction | dependency-cruiser over policy imports                     | contracts accepted; adapter rejected |
| Package cycle    | package manifest graph evaluator                           | reject                               |
| Semantic owner   | duplicate inventory declaration fixture                    | reject                               |

## P1-O03-CI-01 deterministic scheduling remediation

The immutable implementation head `52451049c5069a4f5e932f98ed648c2dd9aa6cc3` produced two
Windows clean-rebuild attempts that passed the complete quality baseline and then timed out in the
second root test run. The first attempt timed out in the existing example-suite fixture test; the
unchanged rerun timed out in a different existing registry-integrity fixture. Both attempts kept
all assertions intact, while both Linux attempts, M0 and P1-V04 passed. This isolates the finding to
cross-platform high-I/O fixture scheduling rather than Contract or architecture semantics.

The root test command now fixes Vitest at one worker. The 10 second per-test boundary, all 82 root
tests, all seven architecture tests, the separate architecture Vitest invocation, and the duplicate
clean/build/test qualification remain unchanged. No Contract test, Vitest config, workflow,
toolchain script or timeout threshold was modified. Two direct repeated root runs, full quality,
P1-V04, a clean build/test rerun, frozen offline install, M0 14/14 and final WRITE_SCOPE all pass on
qualified implementation commit `6200fc4cef958b0bf35f89825e0eb75ae1b8e93a` (tree
`9075b22842436201ace3a3958276b61e8dbb2e7c`).

Implementation Evidence is recorded in
`operations/phase-1/evidence/o03/p1-v04-architecture.json`. The implementation claim remains
`IMPLEMENTED`; independent verification, GitHub Linux/Windows qualification, protected-main merge,
and post-merge verification are orchestrator responsibilities.
