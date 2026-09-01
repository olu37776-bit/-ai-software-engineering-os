# Release 与本地运行协议

状态：`BASELINE DRAFT v0.1`  
日期：`2026-08-26`

> P1-O08 qualification note: the repository now contains a non-production Windows x64 artifact
> assembler and clean-start gate. Its manifest, hash, SBOM, provenance, bundled runtime, Unicode
> path, empty-`PATH`, and release/data separation checks are qualification controls only; they do
> not constitute production release approval. See
> `docs/implementation/phase-1/o08/windows-clean-start-qualification.md`.

## 1. 目标

GitHub 完整构建 Framework，用户从 GitHub 单向下载到本地运行。正常使用不要求本地上传源码、配置、知识库、Evidence 或业务数据。

本地安装是产品化 Release 的激活，不是把 `main` 工作树直接覆盖到运行目录。

## 2. Windows-first 目标

首个正式发行目标是 Windows 本地环境，同时保持跨平台 Core。Release 应包含运行所需 runtime 与依赖，用户无需安装 Node.js、包管理器或编译器。

具体打包机制通过 spike 选择，但必须满足：

- portable/self-contained；
- 可校验完整性和 provenance；
- 路径中含中文/空格可运行；
- 无管理员权限的标准安装路径可用；
- 启动错误可见，不出现双击无反应；
- CLI 和诊断命令始终可运行；
- 支持离线启动。

## 3. 目录边界

逻辑布局：

```text
<install-root>/
├─ releases/
│  ├─ 0.1.0/
│  └─ 0.2.0/
├─ launcher/
└─ active-version.json

<data-root>/.ai-local/
├─ config/
├─ state/
├─ evidence/
├─ artifacts/
├─ logs/
├─ cache/
├─ secrets/
├─ backups/
└─ knowledge-adapters/
```

Release 目录不可写或视为不可变。升级不得覆盖 data root。

Windows 不依赖需要管理员权限的 symlink；launcher 根据原子更新的 active-version metadata 选择版本。

## 4. Release 内容

每个 Release 至少包含：

```text
framework distribution
release-manifest.json
config.schema.json
state-schema manifest
migration-manifest.json
verification-summary.json
SBOM
checksums
provenance/attestation
LICENSE/NOTICE
release notes
```

Manifest 至少标识：

```text
frameworkVersion
gitCommit
buildId
builtAt
toolchain/runtime versions
contract versions
config schema version
state schema version
supported upgrade sources
artifact hashes
```

## 5. CLI 目标

```text
framework init
framework doctor
framework start
framework stop
framework status
framework run <workflow>
framework inspect <run|node|evidence>
framework verify <subject>
framework backup
framework restore
framework upgrade
framework rollback
framework version
```

命令名称可在 CLI Contract 中细化，但能力不可缺失。

## 6. 首次运行

```text
install/extract
-> verify release
-> framework init
-> create local data root
-> generate config template
-> configure adapters
-> framework doctor
-> initialize state schema
-> start runtime
-> run built-in acceptance workflow
```

如果 preflight 不满足，应输出结构化诊断和修复建议，不得无窗口静默退出。

## 7. Config

- repository 保存 schema 和 example，不保存用户真实配置；
- config 分层：release defaults < machine config < workspace config < explicit CLI override；
- 冲突与最终值来源可检查；
- secrets 使用 handle/SecretProvider；
- config 变更有 validation 和 effective snapshot；
- 不允许配置注入新的 Core 状态转换代码；
- breaking config change 提供 migration/preflight。

## 8. Upgrade

```text
1. 获取 Release metadata
2. 下载到 staging
3. 校验 checksum/signature/provenance
4. 检查 runtime/config/state compatibility
5. 创建必要 backup
6. 安装到新 version directory
7. 在副本/事务中执行 migration preflight
8. 运行 package smoke
9. drain 或停止旧 Runtime
10. 原子切换 active version
11. 启动并运行 local acceptance
12. 成功后提交 activation event
```

升级过程中不允许一个 NodeExecution 前半段使用旧 reducer、后半段使用新 reducer。Runtime 必须 drain、固定 execution runtime 或使用显式 recovery protocol。

## 9. Rollback

- code-only rollback：切换回上一 verified Release；
- state-compatible rollback：只有 manifest 声明兼容才可直接切换；
- state-breaking migration：使用预升级 backup/restore；
- rollback 本身生成 audit/evidence；
- 未知外部副作用需要 reconciliation，不因代码回滚自动撤销。

## 10. Backup 与恢复

Backup 至少包含：

- authoritative state/journal；
- config snapshots；
- Evidence metadata；
- Artifact manifest；
- adapter metadata；
- schema/version manifest。

Secrets 和大型知识数据可按 provider-specific 方式处理，但必须在 backup report 中说明是否包含。Restore 必须在隔离目录验证后再激活。

## 11. Knowledge Adapter 接入

本地配置示意：

```yaml
knowledgeProviders:
  - id: gbrain-local
    adapter: gbrain
    endpoint: <local endpoint>
    knowledgeBases:
      - swap-kb
      - microwave-kb
    mode: read-only
```

示意不构成最终 schema。Release 不包含 KB 内容，只包含 Adapter 和 Contract。

## 12. Diagnostics

`framework doctor` 应检查：

- release integrity；
- runtime dependency；
- data directory permissions；
- state schema/migration；
- database integrity；
- available disk/memory；
- local API bind/auth；
- model/tool/workspace/knowledge adapter health；
- sandbox capability；
- stale leases/outbox；
- backup readiness。

诊断 bundle 必须先展示将导出的内容并默认脱敏。由于本地不能自动上传，工具应生成可阅读的结构化摘要，便于用户手工提供必要事实。

## 13. 本地验收

每个 Release 激活后运行 built-in acceptance workflow，至少验证：

- state write/read/replay；
- worker dispatch/result；
- Evidence 创建与 hash；
- Verification Gate；
- CLI/API；
- configured Adapter preflight；
- clean shutdown/restart recovery。

本地验收失败时自动保留旧版本，并提供明确 rollback 选项。
