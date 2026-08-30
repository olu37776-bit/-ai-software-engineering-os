# P1-O01 Toolchain Foundation

Status: `IMPLEMENTED` (not independently `VERIFIED`)

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
`pnpm-lock.yaml`. Verification computes and emits the current lockfile SHA-256 from UTF-8 content
with LF-normalized line endings so Git's Windows checkout conversion cannot create a second
dependency identity. The derived hash is Evidence, not a historical authority value in the
toolchain manifest.

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
x64. Its uniquely named `p1-o01-toolchain-qualify` aggregator succeeds only when both platform
qualifications succeed. The pre-existing M0 independent workflow remains the sole owner of the
required `verify` check context.

The qualified implementation commit is `eba4ebf219529cca2c34fd813d37f8bd7b1f5a6c`.
[Quality run 33157374028](https://github.com/olu37776-bit/-ai-software-engineering-os/actions/runs/33157374028)
passed `ubuntu-24.04`, `windows-2025`, and `p1-o01-toolchain-qualify` on PR #9. The concurrent
[M0 independent run 33157374004](https://github.com/olu37776-bit/-ai-software-engineering-os/actions/runs/33157374004)
was the sole producer of `verify` and also passed. This remediates `P1-O01-IV-01`; independent
P1-O01 re-verification remains a later gate.

## Supply-chain boundary

Dependency lifecycle scripts are denied unless listed in `allowBuilds`. The only P1-O01
allowlist entry is `protobufjs@7.6.5`, a locked transitive dependency of the accepted
OpenTelemetry SDK baseline. A negative qualification fixture proves that an explicitly denied
dependency install script does not execute.
