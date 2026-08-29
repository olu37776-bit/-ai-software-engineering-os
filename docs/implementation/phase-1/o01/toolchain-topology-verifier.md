# Topology-aware toolchain configuration verification

Status: `IMPLEMENTED` (not independently `VERIFIED`)

Issue #21 is a P1-O01 toolchain transition remediation. It removes two initial-topology assumptions from `verify-config.mjs` without changing the accepted compiler, module, build, supply-chain, workflow, version, secret, scope, or required-check authority rules. It does not implement P1-O02 Contracts or amend WRITE_SCOPE.

## Topology invariants

The root authority build always contains `./tests/qualification/toolchain`. Every project reference must be an exact safe repository-relative path to a real in-repository TypeScript project with `tsconfig.json`.

Every workspace package must have:

- one exact canonical workspace path;
- a real `package.json` inside the repository;
- a real `tsconfig.json` inside the repository; and
- one matching `./<workspace-path>` reference in `tsconfig.build.json`.

Referenced projects are classified from repository facts. A referenced project with `package.json` is a package project and must belong to the pnpm workspace. A referenced project with `tsconfig.json` but no `package.json` is a non-package TypeScript project and may remain outside the workspace. Workspace packages and package project references are equal as sets; non-package project references are not part of that equality. Ordering is not authority.

The validator fails closed for duplicate paths, malformed reference objects, missing declarations, empty block declarations, absolute paths, Windows-style separators, parent traversal, glob syntax, non-canonical `./` usage, symlink escape, missing package manifests, and missing project configs.

The policy is generic: it contains no P1-O02 or Contracts exception. The intended next topology is valid because `packages/contracts` would be added to both the workspace and root build and would contain the required real project files.

## Qualified fixtures

- Initial topology: empty workspace plus the mandatory toolchain qualification reference — PASS.
- Generic non-package topology: empty workspace plus mandatory toolchain and a real non-package TypeScript project reference — PASS.
- Future P1-O02-shaped topology: `packages/contracts` in both workspace and root build — PASS.
- Workspace-only package — FAIL_CLOSED.
- Build-only package reference — FAIL_CLOSED.
- Duplicate, malformed, absolute, traversal, glob, backslash, missing-project, and missing-manifest inputs — FAIL_CLOSED.

The repository configuration files themselves remain unchanged by this remediation. P1-O02 remains blocked pending independent verification and a new protected-main baseline.
