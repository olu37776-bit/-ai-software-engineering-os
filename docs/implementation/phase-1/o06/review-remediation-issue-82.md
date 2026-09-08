# Issue 82 — P1-O06 review remediation

Status: IMPLEMENTED. Findings R07, R12, R13.

Runtime locking now uses unique per-process claims and bakery ordering. Only the elected owner can replace shared metadata; losing contenders remove only their own immutable claim, and dead-owner recovery cannot unlink a successor. Releasing a lock is idempotent. Request deadlines now close unfinished body connections, release concurrency exactly once and prevent late route execution. The client decodes UTF-8 incrementally with fatal error handling, rejects incomplete event frames and binds success responses to their documented HTTP status (200 for reads, 202 for stop).

Eight new regressions passed, including 40 rounds of 16 contenders, eight separate processes and crash recovery, five unfinished-body deadlines, split Chinese UTF-8, invalid/truncated streams and HTTP 201 rejection. The broader Control API/contract/CLI suite had 38 passes, two Windows-only skips and one environment-blocked network-interface enumeration (uv_interface_addresses permission restriction). The LAN assertion is preserved for hosted Linux/Windows. Root build and lint passed.

Exact hosted qualification and protected-main post-merge checks remain required. The frozen P1-V10 HUMAN_REVIEW is pending; this implementation does not declare VERIFIED.
