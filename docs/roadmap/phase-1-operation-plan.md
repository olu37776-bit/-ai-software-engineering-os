# Phase 1 Operation Plan — Executable Repository Foundation

状态：`BASELINE — PENDING M0 FINAL GATE`  
机器权威：`operations/phase-1/operation.json`

## Purpose

Phase 1 establishes a reproducible, schema-validated, architecture-enforced repository foundation. It does not implement the production Workflow, Node Runtime, Verification System, EvidenceGraph or Learning runtime.

## Operations

| ID | Scope | Gate |
|---|---|---|
| P1-O01 | exact toolchain and monorepo | P1-V00/V01/V02 |
| P1-O02 | Contract registry and runtime validation | P1-V03 |
| P1-O03 | dependency and semantic-owner enforcement | P1-V04 |
| P1-O04 | deterministic Policy qualification | P1-V05 |
| P1-O05 | node:sqlite/PersistenceWorker qualification | P1-V06 |
| P1-O06 | authenticated loopback Control API | P1-V07 |
| P1-O07 | Windows PROCESS_RESTRICTED qualification | P1-V08 |
| P1-O08 | self-contained qualification artifact | P1-V09 |
| P1-O09 | integrated implementation receipt and handoff | P1-V10 |

## Baseline identity

- Architecture baseline: frozen by accepted Phase 0 decisions.
- Planning source: the commit from which this remediation began.
- Execution baseline: a later immutable commit selected only by the M0 Gate.
- Implementation must verify `operations/phase-1/authority-lock.json` before writing.

## Stop rule

A required R4 result other than PASS, an authority-lock mismatch, scope expansion, fallback implementation, or accepted-ADR conflict stops the current Operation. The implementation Agent cannot declare VERIFIED.
