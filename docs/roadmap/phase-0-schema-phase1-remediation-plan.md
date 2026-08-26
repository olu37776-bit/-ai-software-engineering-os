# Phase 0 Schema / Phase 1 Governance Remediation Plan

状态：`IMPLEMENTED`  
目标：关闭 machine-readable Schema、examples、Phase 1 Operation、WRITE_SCOPE、VerificationPlan 与 Receipt 的实现前阻塞。

## Required checks

1. Parse every governed JSON file.
2. Draft 2020-12 meta-validation for every Schema.
3. Unique `$id`, resolvable `$ref`, unique authority path and exact SHA-256.
4. Active/planned inventory validation and no overlap.
5. Valid examples pass; invalid examples fail for declared keyword/path.
6. Payload, Schema and Artifact hash fidelity.
7. Operation and Verification DAG closure.
8. WRITE_SCOPE global/suboperation/path-output closure.
9. Authority Lock exact-byte verification.
10. Incomplete `IMPLEMENTED` Receipt rejection.
11. Implementation and independent verification role separation.
12. No production runtime path or accepted ADR change.

## Exit

Only an independent read-only PASS may recommend the M0 final Gate. Any failure returns to a separate remediation operation.
