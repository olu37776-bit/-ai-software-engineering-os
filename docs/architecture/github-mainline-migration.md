# GitHub Mainline Migration Baseline

Status: FROZEN BASELINE v1  
Date: 2026-08-26

## 1. Purpose

This document defines the migration boundary for rebuilding the AI Software Engineering OS Framework on GitHub and progressively replacing the existing local implementation.

The migration is intentionally asymmetric:

**GitHub -> Local only.**

The local environment cannot upload framework source, patches, runtime state, evidence, configuration, or other files back to GitHub. Therefore the architecture MUST NOT depend on bidirectional file synchronization.

GitHub becomes the authoritative engineering mainline. The local environment becomes a downstream installation, execution, compatibility, and acceptance environment.

## 2. Authority model

### GitHub owns

- architecture decisions and contracts;
- canonical framework source;
- Workflow / Node runtime semantics;
- operation semantic ownership;
- Verification System implementation;
- Learning & Feedback implementation;
- automated tests and architecture checks;
- release manifests and migration logic;
- install, preflight, smoke-test, and rollback tooling;
- versioned release artifacts.

### Local owns

- private configuration and secrets;
- local model/provider configuration;
- project workspaces;
- runtime state;
- logs and caches;
- locally generated NodeExecutionRecord and Evidence;
- private project/knowledge data;
- real-environment acceptance results.

Local ownership of these data does NOT make local source code authoritative.

## 3. One-way boundary

The supported flow is:

```text
GitHub
  architecture / contracts
  source / tests
  release artifacts
  migration logic
          |
          | download only
          v
Local
  install release
  load local config
  use local state/data
  execute real workloads
  generate local evidence
```

There is no required Local -> GitHub file path.

Local findings are transferred only as explicit human/Agent observations, issue descriptions, failure signatures, or manually supplied facts. A GitHub-side change must reconstruct the fix from those facts and must not assume access to local files.

## 4. Core migration decisions

1. GitHub is the single authoritative engineering mainline.
2. Existing local implementation is legacy evidence, not an automatically trusted baseline.
3. There MUST NOT be a long-lived GitHub runtime and local runtime with independent business semantics.
4. A business semantic MUST have exactly one canonical owner.
5. Migration branches may coexist temporarily, but there MUST NOT be independent v1/v2 runtime semantic owners.
6. Local framework modifications are not a supported production mechanism.
7. Local environment installs immutable GitHub releases rather than running an arbitrary GitHub working tree.
8. Runtime data, secrets, configuration, logs, and Evidence MUST be separated from release directories.
9. Release replacement MUST be versioned, preflighted, smoke-tested, and rollback-capable.
10. An implementation Agent may declare IMPLEMENTED; VERIFIED requires independent verification.
11. Documentation, Contract, code, tests, and verification evidence MUST describe the same semantics.
12. The Verification System is the framework subsystem that plans and evaluates verification. GitHub Actions is execution/automation infrastructure, not the Verification System itself.

## 5. Treatment of the existing local implementation

Local code is classified per semantic/module rather than migrated wholesale.

Allowed classifications:

- **KEEP** - implementation and semantics are sufficiently trusted.
- **WRAP** - behavior is trusted but must be adapted to the new boundary.
- **REWRITE** - Contract/required behavior is trusted but implementation is not.
- **RETIRE** - duplicate, obsolete, or invalid semantic ownership.
- **INVESTIGATE** - available facts are insufficient to make a migration decision.

Low-quality or contradictory local code MUST NOT enter the GitHub mainline merely to preserve historical implementation.

Where behavior must be preserved, first extract the observable contract and characterization cases, then implement the canonical GitHub owner.

## 6. Known architectural risks carried into migration

The migration must explicitly eliminate, rather than reproduce, known classes of defects observed during local construction:

- duplicated state-transition/business semantics across operations;
- old and new paths executing the same core semantic instead of true version evolution;
- terminal transition dual ownership;
- missing cross-operation idempotency protection;
- tests that depend on deleted/obsolete implementation paths;
- remediation artifacts contradicting their own tests;
- authority implementations that cannot be imported or have missing dependencies;
- implicit global/singleton initialization dependencies;
- stale or unsynchronized caches affecting Learning & Feedback behavior;
- silent evaluation failure;
- documentation, Contract, tests, and implementation drifting apart.

These are migration constraints, not merely backlog items.

## 7. First canonical vertical slice

The first GitHub implementation slice MUST establish one complete authoritative path:

```text
Workflow Router
  -> Node execution
  -> canonical operation semantic owner
  -> canonical state transition
  -> NodeExecutionRecord
  -> Evidence
  -> Verification result
  -> Router decision
```

Before expanding the framework, this slice must establish:

- unique semantic ownership;
- Node as the minimum execution/attribution unit;
- terminal transition ownership;
- idempotency behavior;
- attempt/execution identity;
- NodeExecutionRecord generation;
- Evidence linkage;
- verification outcome linkage;
- deterministic Router-visible outcome.

Learning Layer causal inference is downstream of trustworthy execution facts and MUST NOT substitute for this foundation.

## 8. NodeExecutionRecord minimum identity

Every Node execution record must at minimum identify:

```text
runId
nodeId
executionId
attempt
runtimeVersion
gitCommit
contractVersion
```

The record must make it possible to determine which immutable framework implementation produced a local execution.

## 9. Release/local filesystem boundary

Target local layout:

```text
framework/
  releases/
    <version>/
  current -> releases/<version>

.ai-local/
  config/
  state/
  evidence/
  logs/
  cache/
  secrets/
```

A release MUST NOT overwrite `.ai-local` runtime/private data.

Repository documentation may use `.ai-local/docs/**` where appropriate, but runtime/private `.ai-local` content is not part of the release authority source.

## 10. Release contract

Every installable release must identify at least:

```json
{
  "version": "<semver>",
  "gitCommit": "<sha>",
  "contractVersion": "<version>",
  "configSchemaVersion": "<version>",
  "stateSchemaVersion": "<version>",
  "minimumRuntimeVersion": "<version>"
}
```

A release should provide:

```text
framework-<version>.*
release-manifest.json
migration-manifest.json
verification-summary.json
checksum
```

## 11. Local replacement protocol

A local replacement is an installation/switch operation, not a source-tree overwrite.

Required sequence:

1. Download immutable GitHub release.
2. Verify artifact integrity/checksum.
3. Validate runtime prerequisites.
4. Validate local config schema compatibility.
5. Validate state schema compatibility.
6. Back up state when migration can mutate it.
7. Install into a new version directory.
8. Run migration preflight.
9. Run release smoke tests.
10. Atomically switch `current` to the new version.
11. Run local acceptance checks.
12. Roll back to the previous release if acceptance fails.

The default update mechanism MUST NOT be `git pull` over the active runtime directory.

## 12. In-flight execution rule

A framework version MUST NOT change semantics halfway through a Node execution.

Default rule:

- an execution records its runtime/release identity at start;
- new releases accept new executions only after activation;
- an already-running execution completes under its original runtime, or is stopped/recovered through an explicit recovery contract;
- an execution cannot silently continue across two semantic versions.

## 13. One-way verification consequence

Because local files cannot be uploaded, GitHub-side verification and local acceptance are distinct evidence domains.

### GitHub verification

May verify:

- compilation/static checks;
- unit tests;
- Contract tests;
- integration tests with repository fixtures;
- architecture ownership constraints;
- deterministic state transitions;
- migration tests against synthetic/versioned fixtures;
- packaging and release integrity.

### Local acceptance

May verify:

- local provider/model integration;
- private workspace compatibility;
- local state migration;
- machine/runtime dependencies;
- real workload execution;
- local performance/resource behavior.

A release MUST be useful without uploading local Evidence. Local acceptance failures are reported upstream as facts sufficient to reproduce or create a synthetic regression case whenever possible.

## 14. Migration inventory

A separate migration inventory must be maintained for each existing semantic/module with:

```text
semantic/module
current responsibility
known local implementation path (if known)
authoritative Contract/source of truth
known duplicate owners
known defects
available tests/evidence
classification: KEEP | WRAP | REWRITE | RETIRE | INVESTIGATE
target GitHub owner/path
acceptance criteria
migration status
```

No legacy implementation is considered migrated until its semantic ownership and acceptance criteria are explicit.

## 15. Repository construction order

The GitHub mainline should be built in this order:

### Phase 0 - Authority baseline

- freeze this migration baseline;
- define repository rules;
- establish migration inventory;
- record known defects and frozen architecture decisions.

### Phase 1 - Engineering baseline

- repository structure;
- build/test entrypoints;
- Contract location;
- PR/issue conventions;
- architecture checks;
- release manifest schema;
- minimal automated verification.

### Phase 2 - Canonical runtime slice

- Router;
- Node execution boundary;
- operation semantic ownership;
- state transition;
- terminal/idempotency rules;
- NodeExecutionRecord;
- Evidence linkage;
- verification outcome;
- Router continuation.

### Phase 3 - First installable release

- packaging;
- version command;
- preflight;
- smoke test;
- state/config isolation;
- migration mechanism;
- rollback.

### Phase 4 - Controlled legacy replacement

For each semantic boundary:

```text
establish facts/contract
-> capture characterization cases
-> implement canonical owner
-> independently verify
-> remove duplicate owner
-> release
-> local acceptance
```

### Phase 5 - Local source retirement

Once required runtime capabilities have migrated:

- local legacy source becomes read-only historical reference;
- local active environment consists of GitHub releases plus local/private state/config/data;
- all future framework engineering begins from GitHub authority.

## 16. Non-goals

This migration does NOT aim to:

- preserve every historical implementation detail;
- upload or synchronize private local data;
- create a cloud copy of local runtime state;
- maintain two independently evolving runtimes;
- redesign the already-frozen architecture without evidence;
- treat GitHub Actions as the framework Verification System;
- migrate GBrain/Swap knowledge assets into the Framework repository unless a separately approved shared Contract requires it.

## 17. Definition of migration success

The migration is successful when:

1. GitHub contains the only active canonical framework implementation.
2. Core semantics have unique owners and architecture checks prevent duplication.
3. A GitHub release can be downloaded and installed locally without source editing.
4. Local private configuration/state/evidence survives release replacement.
5. Every execution identifies the release/commit/Contract that produced it.
6. Failed releases can be rolled back without restoring an entire source working tree.
7. Local findings can be converted into reproducible GitHub regression cases without requiring local file upload.
8. Legacy local implementation is no longer required for normal framework development or execution.

## 18. Immediate next artifact

The next document is `docs/migration/migration-inventory.md`.

Its first task is not to copy local files. It is to enumerate the currently known framework semantics and decide which ones can be reconstructed from frozen architecture decisions and existing verified facts, and which require local observation before GitHub implementation proceeds.
