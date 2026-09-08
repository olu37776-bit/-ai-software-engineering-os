# Construction after Phase 1

Prepared 2026-09-09 under the user's instruction to finish P1 and continue the main construction line. This is an execution queue, not a claim that the Kernel or later phases are implemented. Phase 1's final human acceptance and protected-main checks precede Phase 2 code changes.

The accepted roadmap's next phase is the deterministic durable Kernel. Existing unmerged Learning, Coverage and GBrain design branches remain separate inputs; they do not replace the mainline Kernel sequence.

| Slice | Implementation and existing owner                                                                                                   | Acceptance                                                                                                                                  |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| P2-01 | Freeze the Phase 2 operation, scope and verification inputs; enumerate existing Command/Event/Node contracts and persistence ports. | Every planned semantic has one owner and a runnable qualification command; no new authority is inferred from an unmerged proposal.          |
| P2-02 | Deterministic command admission and event reducers in the Kernel, through the existing Contract validators and PersistenceWorker.   | Same initial state and event sequence produce identical state; malformed input produces no writes; expected-version conflicts are explicit. |
| P2-03 | Transactional inbox/outbox integration using the existing persistence owner.                                                        | Duplicate commands/effect delivery do not duplicate transitions; crash before and after commit preserves the defined facts.                 |
| P2-04 | Execution lifecycle, retry, timeout, cancellation and scheduler lease.                                                              | Lease conflict, restart and concurrent terminal proposals produce one terminal transition and no duplicate effect.                          |
| P2-05 | Projection rebuild, recovery, backup/restore and Policy audit/replay integration.                                                   | Replay matches live authority state; Policy decisions remain deterministic and cannot be bypassed; recovery drills pass.                    |

Implementation uses functional subagents where the slices can run independently. Each slice runs its relevant tests; routine edits do not repeat broad audits. Risk-bearing changes retain the accepted checks, and a single consolidated phase acceptance records the final results.

The first useful runnable result is a model-free command that produces persisted events, reconstructs state after restart and rejects a duplicate without a second transition. Real model, private Workspace and GBrain connections follow the roadmap's later integration phase.
