# P1-O02 Machine-readable Contract foundation

状态：`IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`

## Authority and boundaries

`packages/contracts/schema-registry.json` remains the only executable registry and every registry entry resolves to one repository-contained authority file with an exact SHA-256. JSON Schema Draft 2020-12 remains runtime authority; generated TypeScript types are a drift detector and public developer surface only.

The package contains no Workflow, Node Runtime, Router, Scheduler, persistence, Policy evaluation, Verification System or other production runtime behavior. It only loads and validates canonical Contract assets already present in the repository.

## Root integration

- `packages/contracts` is an ESM-only pnpm workspace package.
- Its strict composite NodeNext project is referenced exactly once by `tsconfig.build.json`.
- The package public entry is `@aseos/contracts` and exports the validator, registry/inventory/example/compatibility APIs and generated readonly Contract types.
- Root Vitest includes `tests/contract/**`; quality checks generated-type drift and runs P1-V03 qualification.
- The frozen lockfile adds only the `packages/contracts` importer using the already frozen Ajv `8.20.0` dependency.

## Fail-closed validation

Registry loading validates Draft 2020-12 meta-schema conformance, unique identities and paths, exact file hashes, `$id`/version consistency, safe repository-relative paths, repository containment and all references. Runtime callers provide both canonical schema identity and version; unknown identity, unsupported version and mismatched pairs return structured failures. Validators are compiled and cached only after registry validation.

Inventory qualification validates active and planned inventory meta-schemas, linkage, active registry resolution, version/path/hash consistency, and unique contract ID/name/path ownership across all 73 declared semantics.

The first-slice suite runs the real validator for 38 bound cases. Invalid fixtures must be rejected with their declared keyword and instance path; validity is never inferred from filenames. Semantic checks validate nested payload schemas, RFC 8785-compatible canonical payload hashes, SchemaRef hashes and ArtifactRef bytes.

## Type and compatibility consistency

`scripts/contracts/generate-contract-types.mjs` deterministically derives readonly public declarations from the canonical schemas. `schema-type-consistency.mjs` uses the TypeScript compiler on independently generated expected and committed actual modules, plus AST readonly inspection. Mutation tests prove that required-field deletion, primitive drift, enum drift and mutable fields fail.

The compatibility harness accepts the same registered identity/version and fails closed for unknown identity, future version and identity/version mismatch. It deliberately does not introduce a migration framework.

## Qualification entry

Run:

```bash
pnpm run contracts:qualify
```

The JSON output contains the four P1-V03 Evidence result types:

- `SchemaMetaValidationResult`
- `SchemaRegistryValidationResult`
- `ExampleSuiteResult`
- `SchemaTypeConsistencyResult`

Implementation Evidence is recorded in `operations/phase-1/evidence/o02/p1-v03-contracts.json`. Independent verification against an immutable head is still required before any `VERIFIED` claim.
