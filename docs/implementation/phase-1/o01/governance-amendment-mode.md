# Prior-gate-authorized Phase 1 governance amendments

Status: `IMPLEMENTED` (not independently `VERIFIED`)

Issue #15 adds a deterministic `GOVERNANCE_AMENDMENT` route to the P1-O01 scope validator. This is scope-enforcement infrastructure remediation. It does not amend WRITE_SCOPE, change accepted ADRs, implement P1-O02 Contracts, or start production Runtime work.

## Authorization sequence

An amendment request is identified only by a P1-O01 execution record whose `executionType` is `PHASE_1_GOVERNANCE_AMENDMENT`. Branch names, pull-request text, labels, and commit messages are not authorization inputs.

The execution record binds:

- `trackingIssue` to one positive issue number;
- `implementationBranch` to one exact branch;
- `baseCommit` to one exact protected-main base; and
- `priorAuthorizationGateRef` to the issue-specific Gate path under `operations/phase-1/evidence/o01/`.

The validator reads Gate candidates exclusively from the execution record's base commit with `git show`. A Gate introduced only in the amendment head therefore does not exist for authorization and fails closed.

Because a file cannot contain the Git object ID of the commit that contains that same file, the Gate binds the exact first parent in `subject.authorizationBase` and declares `DIRECT_PROTECTED_MAIN_CHILD_CONTAINING_THIS_GATE`. The amendment base must be that direct child, must contain the Gate, and its first parent must not contain the Gate. This gives a deterministic, non-self-referential binding to the protected-main Gate transition.

## Minimum independent Gate contract

```json
{
  "schemaVersion": "1.0.0",
  "evidenceType": "Phase1GovernanceAmendmentAuthorization",
  "trackingIssue": 14,
  "decision": "AUTHORIZED",
  "subject": {
    "repository": "olu37776-bit/-ai-software-engineering-os",
    "authorizationBase": "<40-character first-parent commit SHA>",
    "authorizedBasePolicy": "DIRECT_PROTECTED_MAIN_CHILD_CONTAINING_THIS_GATE",
    "implementationBranch": "<exact amendment branch>"
  },
  "verifier": {
    "role": "INDEPENDENT_VERIFIER",
    "independent": true,
    "readOnlySubjectVerification": true,
    "remediationPerformed": false
  },
  "authorization": {
    "mode": "GOVERNANCE_AMENDMENT",
    "allowedChangedPaths": ["<sorted exact repository path>"],
    "unlistedPhase1AuthorityPaths": "DENIED"
  },
  "claimBoundary": {
    "acceptedAdrMutationAuthorized": false,
    "productionRuntimeAuthorized": false,
    "p1O02ImplementationAuthorized": false
  }
}
```

The allowlist must be non-empty, sorted, unique, exact paths only. Globs, absolute paths, traversal, accepted ADRs, `packages/**`, `apps/**`, private work paths, generated output, and authorization Gate paths are rejected even if listed.

## Authority Lock transition

For an authorized amendment, the validator compares the base and head Authority Locks before checking every head lock entry against the corresponding file. The lock's top-level policy, authority path set, roles, mutation policies, and operation ownership cannot change. Only hashes for Gate-authorized authority files may change; unrelated authority bytes and lock entries must remain identical.

The existing `OPERATION_EXECUTION`, `OPERATION_MERGE`, `INDEPENDENT_EVIDENCE`, and `NON_OPERATION_GOVERNANCE` routes retain their existing validation behavior. `DENY_BY_DEFAULT` remains mandatory.

No Issue #14 authorization Gate is created by this implementation. That Gate requires a later independent, read-only decision already present in protected `main` before Issue #14 can use this mode.
