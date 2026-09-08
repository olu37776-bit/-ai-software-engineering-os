# Phase 1 integrated verification input — Issue 82

Status: **AUTOMATED_QUALIFICATION_COMPLETE / FINAL_HUMAN_ACCEPTANCE_PENDING** (2026-09-09). The exact handoff subject `3777bda86f090ac75a3382b8b310da17737dc257` passed hosted Linux, Windows, packaging and required verify, plus local Windows quality. One final human acceptance remains. No independent receipt is fabricated.

Current results supersede the historical pending machine results below. Run [34200250486](https://github.com/olu37776-bit/-ai-software-engineering-os/actions/runs/34200250486) checked out that exact subject: Linux 333 passed / 9 Windows-specific skipped; Windows 341 passed / 1 bash-specific skipped; architecture 14 passed on each platform; real packaged startup 5/5 passed. Local Windows `pnpm quality` exited 0 with 341 passed / 1 skipped, architecture 14 passed; all 8 Policy mutations were killed. Full logs, skip explanations and packaging JSON are archived in `operations/phase-1/evidence/o09/issue-82/integrated/3777bda-qualification-summary.json` and its references. The actual receipt now records V00–V09 and all five ADR qualifications PASS; V10 remains BLOCKED pending human acceptance. Source `8d24246` below is retained as a historical implementation subject.

The user's 2026-09-09 instruction consolidates review into this final acceptance. Subsequent record-only changes use focused schema/scope checks and required CI; they do not trigger another broad source audit. [Next construction queue](../implementation/phase-1/o09/next-construction-queue.md) starts with the deterministic durable Kernel after Phase 1 acceptance.

## Exact subjects

- Protected-main foundation: `db310b1d33324e72ba7767eb66760e4e54c8e1bd`.
- P1-O09 executable implementation: `8d24246aea2ece10ff5793bd7647ca222638b6e3`.
- Implementation receipt: `operations/phase-1/implementation-receipt.json`.
- Index: `operations/phase-1/evidence/o09/p1-v10-integrated-evidence-index-issue-82.json`.
- Required independent receipt: `operations/phase-1/evidence/o09/p1-v10-independent-verification-issue-82.json` (not yet issued).

Read the frozen `operations/phase-1/{operation,write-scope,verification-plan,authority-lock}.json`, accepted ADRs and existing Issue 82 remediation plan. None was changed. The implementation commit precedes the receipt-containing commit, avoiding a self-referential SHA. External review/run records must bind the actual final PR HEAD, receipt hash and landing main SHA. New HEADs need new checks and independent conclusions; prior same-tree or ancestor results are not relabeled.

The receipt's `startedAt` is the GitHub timestamp of the first published O09 implementation commit `9d7cec1` (2026-09-08T07:04:14Z); `completedAt` is the receipt preparation timestamp. They bound the published handoff preparation, not the duration of all earlier Phase 1 work. Local test-run wall-clock labels and hosted timestamps are preserved as recorded and are not mixed to calculate durations.

The independent automated review of source `8d24246` reported [no major issues](https://github.com/olu37776-bit/-ai-software-engineering-os/pull/101#issuecomment-5581071173), following the two recorded findings and fixes. That review covers the named source only and does not issue P1-V10 human acceptance or accept subsequent receipt/document changes.

## Observed mainline qualification

P1-O01–O08 remediation is merged. Protected main `db310b1` passed required run [34196663191](https://github.com/olu37776-bit/-ai-software-engineering-os/actions/runs/34196663191): Linux quality, Windows quality, required packaging, quality aggregation and unique verify. M0 reports 14/14; Windows main suite 339 passed, architecture 14 passed. Real host-only termination security qualification passed. This is hosted Windows Evidence, not local Windows execution.

The Windows qualification artifact from [release run 34196662898](https://github.com/olu37776-bit/-ai-software-engineering-os/actions/runs/34196662898) was downloaded and checked by the repository manifest verifier.

| Artifact field    | Observed value                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| Artifact ID       | `10044161568`                                                                                                |
| Artifact subject  | `db310b1d33324e72ba7767eb66760e4e54c8e1bd`                                                                   |
| ZIP SHA-256       | `3fd80ee883a3979b659ba5aad55ff034669fea0d8e6722216421a23a4cc63dc7`                                           |
| Manifest SHA-256  | `ca0432eae19f8a5e86d632cfbeddf38fe43fd29d93ac92d36af8cf949aad127b`                                           |
| Payload           | 245 files, 93,822,859 bytes                                                                                  |
| Windows startup   | Bundled Node, development tools removed, separate Unicode/space roots, start/version/doctor/status/stop PASS |
| Integrity/cleanup | Tampered/missing payload rejected; process, descriptor and token removed                                     |

Transport metadata, expiration and actual stdout are archived in the index. This is a Phase 1 qualification build, not a production Release, installer or complete local Framework. Check expiry/digest before reusing a download; expiration requires rebuilding and qualifying a new exact subject. Baseline artifact Evidence does not replace qualification of a later HEAD.

## Per-finding independent acceptance

Every row requires a final independent acceptance result. A merged patch and green automated run alone do not close a finding. The index records exact implementation and test paths.

| Finding | Owner  | Required behavior                                                                                                                                |
| ------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| R01     | P1-O01 | Actual dependency shell rejects 12 non-success combinations; hosted 455ae22 lint failure propagated to required verify.                          |
| R02     | P1-O01 | Actual receipt validation; incomplete/VERIFIED/self-declared integrated PASS rejected.                                                           |
| R03     | P1-O04 | Missing constants and incompatible operands fail closed, including invalid DENY beside valid ALLOW.                                              |
| R04     | P1-O05 | Canonical registry validates every journal/outbox payload before writes; zero fact mutation on rejection.                                        |
| R05     | P1-O05 | Invalid busy timeout preserves healthy bytes and permits reopening; operational failures do not quarantine.                                      |
| R06     | P1-O02 | Sparse arrays rejected; public persistence remains zero-write and accepts subsequent valid batch.                                                |
| R07     | P1-O06 | Multi-process election, stale recovery and loser non-interference; Windows transient claim errors separately qualified.                          |
| R08     | P1-O03 | Normal entry governs every workspace app and rejects deep imports, cycles, forbidden dependencies and unknown owners.                            |
| R09     | P1-O02 | allOf/local-reference operator mutation produces type consistency failure.                                                                       |
| R10     | P1-O02 | Calendar-aware timestamp rejection and valid leap-year/offset fixtures.                                                                          |
| R11     | P1-O05 | Existing truncated authority is quarantined and cannot silently become an empty database.                                                        |
| R12     | P1-O06 | Unfinished request deadline closes socket and releases capacity exactly once.                                                                    |
| R13     | P1-O06 | Streaming Unicode survives split UTF-8 bytes; client success statuses bind their route.                                                          |
| R14     | P1-O01 | Authoritative root build restores the byte-identical required Win32 bridge.                                                                      |
| R15     | P1-O08 | Actual preload rejects loopback-looking DNS/invalid literals before network/DNS; six valid forms accepted.                                       |
| R16     | P1-O01 | Evidence uses actual checkout and rejects target mismatch; controller provenance remains separate.                                               |
| WR01    | P1-O07 | Creation-time Job membership removes pre-assignment window; hosted Windows kills only Node host then observes bridge/root/child/grandchild exit. |

P1-O09 adds no production owner. It executes the actual required Gate shell for twelve negative dependency combinations and eight real compiled-Policy behavioral mutations. Baseline assertions and normal ALLOW must pass; import/syntax/runtime failures never count as killed mutations. Different checkout paths and CRLF bytes must produce the same logical mutation identities. Original compiled byte hash and canonical source hash remain separate. The prior independent finding `discussion_r3955261881` was repaired at `f34dc15`; only a new independent conclusion can accept that repair.

## Frozen VerificationPlan obligations

| Step                    | Required Evidence types                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| P1-V00-M0-AUTHORIZATION | M0GateEvidence, AuthorityLockEvidence                                                                       |
| P1-V01-PREFLIGHT        | BaselineIdentityEvidence, WriteScopeValidationResult                                                        |
| P1-V02-TOOLCHAIN        | FrozenLockfileInstallResult, TypeScriptBuildResult, CrossPlatformBuildEvidence                              |
| P1-V03-CONTRACTS        | SchemaMetaValidationResult, SchemaRegistryValidationResult, ExampleSuiteResult, SchemaTypeConsistencyResult |
| P1-V04-ARCHITECTURE     | DependencyGraphResult, DeepImportDenialResult, DuplicateSemanticOwnerDenialResult                           |
| P1-V05-POLICY           | CanonicalizationDeterminismResult, FailClosedPropertyResult, PolicyMutationResult                           |
| P1-V06-PERSISTENCE      | PersistenceAtomicityResult, CrashRecoveryResult, BackupRestoreResult, CorruptionQuarantineResult            |
| P1-V07-CONTROL-API      | OpenApiValidationResult, LoopbackExposureResult, TokenAclRedactionResult, CliPublicApiAcceptanceResult      |
| P1-V08-ISOLATION        | JobObjectLifecycleResult, ProcessTreeTerminationResult, NoDowngradePropertyResult                           |
| P1-V09-PACKAGING        | SelfContainedArtifactResult, ReleaseManifestConsistencyResult, CleanWindowsStartupResult                    |
| P1-V10-INTEGRATED-GATE  | StructuredReceiptValidationResult, WriteScopeComplianceResult, IndependentGateDecision                      |

Normal entrypoints: `pnpm quality`, `pnpm contracts:qualify`, `pnpm architecture:qualify`, `pnpm persistence:qualify`, `pnpm control-api:qualify`, `pnpm isolation:qualify`, `node scripts/toolchain/qualify-required-packaging.mjs`, `node scripts/verify-phase-1/qualify-policy-mutations.mjs`, normal `verify-scope.mjs` and `verify_m0.py` with exact base/head/branch/scope report. The index distinguishes each subject and expected Evidence type.

The preceding source f34dc15 had 68 focused author tests; the new source additionally repairs actual Node dependency resolution for the relocation fixture; this is not full quality or independent Gate PASS. Full base quality in the author container failed `networkInterfaces()` (329 passed, nine Windows-only skipped, one environment failure). It is archived; no fake LAN address or weaker assertion was used. Linux provider UNAVAILABLE/NOT_APPLICABLE is explicit and does not replace real Windows results.

## Final independent procedure

1. Fetch the actual PR HEAD; check commit/tree/base, changed paths and every indexed hash. Do not use a stale review request's subject.
2. Independently compare Authority, Contract, code, tests and actual execution for every finding and V00–V10. Read actual Windows process observations and packaging JSON.
3. Run the normal verification entries without remediation; record actor, exact subject, receipt SHA-256, commands, times, results and remaining gaps. A new defect returns REWORK, then a new implementation subject.
4. Frozen `P1-V10-INTEGRATED-GATE` has kind `HUMAN_REVIEW`; `docs/engineering/quality-gates.md` also requires human security review for R4. The author and automated green checks cannot substitute for that Gate. Only an actual independent verifier may issue the receipt at the fixed path.
5. Do not change judging rules, fabricate PASS, erase the original review or expand scope. Final phase completion requires all required steps PASS and actual independent receipt acceptance.
6. Merge only an independently accepted exact head through protected merge, then repeat protected-main checks. An external landing receipt binds the resulting main SHA, avoiding a commit that claims its own hash.

Until then the implementation receipt remains PARTIAL, Issue #82 stays open and Phase 2 is unstarted. Learning/GBrain/Coverage PRs remain separate; their unmerged documents and code are not assumed to be on main.

Latest executable source `8d24246` has now been checked in a clean detached checkout: exact frozen install/root build, normal Scope/M0, 68 focused regressions, eight real Policy mutations, Contracts, Architecture, Persistence and Control API qualifiers PASS on Linux. Its Windows qualification and the receipt-containing final HEAD remain distinct required observations.
