# P1-O08 Windows clean-start qualification

Status: implementation candidate
Gate: `P1-V09-PACKAGING`

## Boundary

The qualification runner receives an already assembled Windows x64 artifact. It does not build,
repair, or download payloads. Before startup it verifies the canonical release manifest, every
declared payload hash, the pinned runtime identity, framework version, and immutable Git commit.

The runner copies the artifact to an install path containing both Unicode characters and spaces,
and creates a separate data root with the same path characteristics. It invokes the packaged
`node/node.exe` directly with an empty `PATH`; host Node.js, pnpm, Python, compilers, shell lookup,
and administrator-only locations are outside the startup boundary.

For this non-production qualification, a `NODE_OPTIONS` ESM guard instruments the packaged CLI
and detached runtime. It allows loopback Control API traffic, blocks non-loopback Node network and
DNS APIs, records every decision, and is itself exercised by negative probes before startup. This
is an application-level offline-startup proof for the reviewed Node artifact, not an OS network
sandbox claim.

## Startup sequence

The packaged CLI is exercised in this order:

1. `start` with the packaged runtime entry;
2. `version`, bound to the expected framework version and generated release identity;
3. `doctor`, which must return `PASS`;
4. `status`, which must return `READY`;
5. `stop`, followed by bounded observation of process exit and removal of both descriptor and
   token discovery files.

The release manifest is verified again after shutdown. A bounded payload file is then modified and
removed in turn; both variants must be rejected by the same verifier. The original bytes are
restored and the final manifest verification must pass. This proves fail-closed detection without
publishing a corrupted artifact.

Verification also parses and cross-binds the SPDX SBOM, SLSA provenance subjects and parameters,
and the complete checksum inventory; merely replacing those documents with hash-consistent but
semantically empty JSON is rejected.

## Evidence

The runner emits one schema-bound record containing the three evidence types required by the
verification plan:

- `SelfContainedArtifactResult`;
- `ReleaseManifestConsistencyResult`;
- `CleanWindowsStartupResult`.

The result is a non-production qualification artifact. This operation does not create a GitHub
Release, sign a production release, activate auto-update, or make a production-approval claim.
