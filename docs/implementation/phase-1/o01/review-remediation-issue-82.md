# Issue 82 — P1-O01 review remediation

Status: IMPLEMENTED. Findings R01, R02, R14 and R16.

The sole required `verify` job now waits for the reusable Linux/Windows quality matrix and a Windows packaging job. Its `always()` aggregation accepts only success from both dependencies; failed, cancelled or skipped prerequisites fail the required context. The workflow checks out the exact PR head, push subject or validated historical dispatch target. The required-check identity and branch protection remain unchanged.

The packaging job uses the existing release assembler, manifest verifier, pinned runtime checksum and clean Windows startup qualification. The latter removes development toolchain discovery from the artifact process. Evidence names the checked-out Git commit and separately records the dispatch controller.

The authority build now copies the adapter's canonical PowerShell runtime asset after TypeScript emits, including incremental builds. Cleaning removes that asset. No alternate source owner is introduced.

M0 validates the actual implementation receipt whenever present, including schema, ancestry, authority/plan bindings and referenced local evidence. Linked independent receipts must bind the same implementation and exact receipt bytes and cannot reuse the implementing actor. A missing O09 receipt is explicitly reported as not yet created; this is not a Phase 1 completion verdict.

Focused tests passed locally. Full exact-head hosted qualification remains required. The frozen verification plan requires an independent HUMAN_REVIEW at P1-V10; this implementation does not declare VERIFIED.
