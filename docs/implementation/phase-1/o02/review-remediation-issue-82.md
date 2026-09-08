# Issue 82 — P1-O02 review remediation

Status: IMPLEMENTED. Findings R06, R09, R10.

Canonical JSON now rejects sparse arrays, accessors, cycles, hidden properties and non-JSON object instances before hashing. Valid JSON retains deterministic ordering and round-trip stability. A 500-case property test checks nested JSON round trips.

The canonical JSON Schema authority validates Gregorian calendar dates, clock components and numeric offsets. It supports RFC 3339 lowercase delimiters and offset-adjusted leap-second syntax at UTC month boundaries, without predicting IERS announcements. Source: [RFC 3339 sections 5.6–5.7](https://www.rfc-editor.org/rfc/rfc3339#section-5.6).

The type generator resolves local JSON Pointers using the current schema identity and intersects `allOf` and reference sibling shapes. Recursive unbound references fail explicitly. Policy condition types now include the nested operator tree; mutating an operator below the `allOf` reference causes a real TypeScript shape failure. Generated declarations are refreshed from the existing canonical schemas; no schema ownership or authority hash is changed.

Build, lint and all 94 contract tests passed locally, including schema mutation and positive/negative date-time cases.

Exact hosted qualification and protected-main post-merge checks remain required. The frozen P1-V10 HUMAN_REVIEW is pending; this implementation does not declare VERIFIED.
