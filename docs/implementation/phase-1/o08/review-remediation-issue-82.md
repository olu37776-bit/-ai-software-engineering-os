# Issue 82 — P1-O08 review remediation

Status: IMPLEMENTED. Findings R15, R16.

The actual offline preload now admits only validated IPv4 loopback addresses and validated IPv6 loopback or IPv4-mapped loopback addresses. DNS names that begin with 127, invalid octets and ambiguous leading-zero addresses are rejected before the underlying network or lookup function is called. The release workflow checks out the exact pull-request head or dispatch/push commit and binds both assembly and clean-start verification to that same subject, with a git HEAD assertion before assembly.

All 22 locally applicable packaging and deterministic assembly tests passed; one real Windows artifact test is pending its hosted artifact. The regression loads the actual preload source in an isolated child, verifies 16 blocked network/lookup paths and six valid loopback forms, and proves blocked paths never reach the underlying functions. Root build and lint passed. This preload is an offline qualification instrument, not an operating-system network sandbox.

The clean Windows startup test also emits its actual completed Evidence JSON to the public job log after every assertion passes, preserving a second retrieval path when an artifact ZIP download is unavailable. It emits the same record returned by the qualifier and saved to the artifact, without synthesizing a result or relaxing an assertion.

Exact hosted qualification and protected-main post-merge checks remain required. The frozen P1-V10 HUMAN_REVIEW is pending; this implementation does not declare VERIFIED.
