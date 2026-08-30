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

Implementation Evidence is recorded in
`operations/phase-1/evidence/o03/p1-v04-architecture.json`. The implementation claim remains
`IMPLEMENTED`; independent verification, GitHub Linux/Windows qualification, protected-main merge,
and post-merge verification are orchestrator responsibilities.
