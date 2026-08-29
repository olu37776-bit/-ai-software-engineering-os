# Topology-aware toolchain configuration verification

Status: `IMPLEMENTED` (not independently `VERIFIED`)

Issue #21 is a P1-O01 toolchain transition remediation. It removes two initial-topology assumptions from `verify-config.mjs` without changing the accepted compiler, module, build, supply-chain, workflow, version, secret, scope, or required-check authority rules. It does not implement P1-O02 Contracts or amend WRITE_SCOPE.

## Topology invariants

The root authority build always contains `./tests/qualification/toolchain`. Additional project references are valid only when they are exact safe repository-relative paths to real TypeScript projects.

Every workspace package must have:

- one exact canonical workspace path;
- a real `package.json` inside the repository;
- a real `tsconfig.json` inside the repository; and
- one matching `./<workspace-path>` reference in `tsconfig.build.json`.

Every root build reference other than the mandatory toolchain qualification project must identify one workspace package. Workspace packages and package project references are therefore equal as sets; ordering is not authority.

The validator fails closed for duplicate paths, malformed reference objects, missing declarations, empty block declarations, absolute paths, Windows-style separators, parent traversal, glob syntax, non-canonical `./` usage, symlink escape, missing package manifests, and missing project configs.

The policy is generic: it contains no P1-O02 or Contracts exception. The intended next topology is valid because `packages/contracts` would be added to both the workspace and root build and would contain the required real project files.

## Qualified fixtures

- Initial topology: empty workspace plus the mandatory toolchain qualification reference — PASS.
- Future P1-O02-shaped topology: `packages/contracts` in both workspace and root build — PASS.
- Workspace-only package — FAIL_CLOSED.
- Build-only package reference — FAIL_CLOSED.
- Duplicate, malformed, absolute, traversal, glob, backslash, missing-project, and missing-manifest inputs — FAIL_CLOSED.

The repository configuration files themselves remain unchanged by this remediation. P1-O02 remains blocked pending independent verification and a new protected-main baseline.
