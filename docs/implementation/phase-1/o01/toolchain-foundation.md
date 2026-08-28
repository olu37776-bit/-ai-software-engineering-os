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
`pnpm-lock.yaml`. The manifest hashes the lockfile as UTF-8 with LF-normalized line endings so
that Git's Windows checkout conversion cannot create a second dependency identity.

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

The qualified implementation commit is `3c2ee1e4b37c9d73094197cb563490ae2514c2a0`.
[GitHub Actions run 33150909894](https://github.com/olu37776-bit/-ai-software-engineering-os/actions/runs/33150909894)
passed `ubuntu-24.04` and `windows-2025`, including clean frozen installs, the complete quality
baseline, clean authority rebuilds, and platform Evidence emission. Independent P1-V02
verification remains a later gate.

## Supply-chain boundary

Dependency lifecycle scripts are denied unless listed in `allowBuilds`. The only P1-O01
allowlist entry is `protobufjs@7.6.5`, a locked transitive dependency of the accepted
OpenTelemetry SDK baseline. A negative qualification fixture proves that an explicitly denied
dependency install script does not execute.
