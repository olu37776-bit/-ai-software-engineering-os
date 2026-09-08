# P1-O09 integrated handoff — Issue 82

Status: PARTIAL / INDEPENDENT_GATE_PENDING. Implementation actor: `codex-work-5fb93e787236`.

Base: `db310b1d33324e72ba7767eb66760e4e54c8e1bd`, containing P1-O08 PR #92 after an independent read-only review of its actual HEAD. P1-O01–O08 remediation changes are all merged. The frozen operation, VerificationPlan, WRITE_SCOPE and accepted ADRs remain unchanged.

This operation completes the reviewable handoff bundle and closes two qualification gaps: it executes the actual required Gate shell with positive and failed/cancelled/skipped/missing dependency results, and runs eight real mutations of the compiled canonical Policy owner in isolated temporary modules. Valid ALLOW remains valid in every mutant; a syntax/import/runtime crash cannot count as a killed mutation. The live checkout and production owner are never mutated. Existing receipt-negative fixtures now isolate their Schema documents so a future real independent receipt cannot contaminate a missing-receipt fixture.

Reproduction:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm run build
node scripts/verify-phase-1/qualify-policy-mutations.mjs
corepack pnpm exec vitest run tests/qualification/policy/integrated-mutation.test.mjs tests/qualification/toolchain/review-remediation.test.mjs
```

Use a Corepack shim directory at the front of PATH if the environment's `pnpm` executable is a different version; nested scripts invoke pnpm themselves. No repository toolchain change or version-check disabling is permitted.

Local full quality on the base retained a real environment failure: this container refuses `networkInterfaces()` with `uv_interface_addresses` error. It had 329 passed, nine Windows-only skipped, one failure. This is not full quality PASS. The corresponding hosted Ubuntu and Windows results are separate Evidence and must bind their own exact subjects.

Final required outputs are the structured implementation receipt, per-finding/step Evidence index, known gaps and independent review input. Historical Evidence is preserved with its original subject; new HEAD conclusions must be obtained anew. The frozen P1-V10 has kind HUMAN_REVIEW. Automated checks and the implementation author's report do not replace that Gate or permit a VERIFIED declaration.

No Phase 2, LF-C1, GBrain, production runtime or production release is implemented by this operation. The Windows artifact is a Phase 1 qualification build, not a complete Framework/local replacement.

Independent review remediation: discussion_r3955261881 identified checkout-dependent mutation hashes. Logical hashes now use canonical source imports and normalized emit newlines. discussion_r3955334378 identified missing AJV runtime dependencies in the relocation fixture and alias masking. The fixture preserves the installed dependency graph and compares both checkouts through a real Node subprocess. Both findings require fresh exact-head independent acceptance; neither is author-closed.
