# P1-O01 Toolchain Foundation

Status: `IN_PROGRESS`

P1-O01 establishes the reproducible repository and TypeScript build baseline only. It does not
create production packages or implement Workflow, Node Runtime, Router, Verification System, or
other later Phase 1 capabilities.

## Authority

- Baseline commit: `7700b608586868cc6e4c19d519b8eef6fc770ae3`
- Node.js: `24.19.0`
- pnpm: `11.24.0`
- TypeScript: `6.0.3`
- Module model: ESM-only, `NodeNext`
- Target and lib: `ES2025`
- Authority build: `pnpm exec tsc -b tsconfig.build.json --pretty false`

The exact dependency and workflow-action versions are canonical in
`toolchain/toolchain.json`; dependency identity and integrity are canonical in
`pnpm-lock.yaml`.

## Reproduction

```text
corepack enable
corepack install --global pnpm@11.24.0
pnpm install --frozen-lockfile
pnpm run quality
pnpm run clean
pnpm run build
pnpm run test
```

The GitHub quality workflow runs the same lockfile and authority build on Linux x64 and Windows
x64. The final `verify` job succeeds only when both platform qualifications succeed.

## Supply-chain boundary

Dependency lifecycle scripts are denied unless listed in `allowBuilds`. The only P1-O01
allowlist entry is `protobufjs@7.6.5`, a locked transitive dependency of the accepted
OpenTelemetry SDK baseline. A negative qualification fixture proves that an explicitly denied
dependency install script does not execute.
