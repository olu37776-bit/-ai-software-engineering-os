# ADR-0007：TypeScript 与工程工具链基线

状态：`ACCEPTED`  
日期：`2026-08-26`

## Context

V1 已确定采用单语言 TypeScript、模块化单体与隔离 Worker，但如果 Node.js、TypeScript、包管理器、模块系统和构建入口不精确冻结，Phase 1 会在代码中隐式形成多套不兼容基线。

截至本决策日期：

- Node.js `24.19.0` 是最新 LTS；
- TypeScript `7.0.2` 已稳定，但 7.0 尚无稳定 programmatic API；
- `typescript-eslint` 的正式 TypeScript 支持范围仍为 `<6.1.0`；
- pnpm `11.24.0` 是稳定版本，pnpm 12 仍处于 RC。

框架首先需要可复现、跨 Windows/Linux 一致且能被完整工具链支持的权威构建，而不是追逐单个工具的最新 major。

## Decision

### 1. 精确核心版本

Phase 1 权威工具链冻结为：

```text
Node.js:    24.19.0 LTS (Krypton)
TypeScript: 6.0.3
pnpm:       11.24.0
```

要求：

- 根 `package.json` 使用 `packageManager: pnpm@11.24.0`；
- `toolchain/toolchain.json` 记录完整工具链、平台、lockfile 和构建器版本；
- Release Manifest 记录并校验实际 Node.js runtime、pnpm、TypeScript 和构建 commit；
- CI、开发构建与正式 Release 使用同一版本，不允许“本地可用版本范围”替代精确版本；
- 正式 Windows Release 随制品携带经 hash 校验的 Node.js `24.19.0` runtime，不依赖用户机器安装 Node.js。

补丁升级必须由依赖更新 PR、完整 Gate 和新的 toolchain manifest 完成；不得由浮动 tag、自动下载 latest 或环境自带版本决定。

### 2. 模块与编译模型

全仓采用 ESM-only：

```text
package.json:      "type": "module"
tsc module:        NodeNext
tsc moduleResolution: NodeNext
target/lib:        ES2025
```

规则：

- package 通过 `exports` 暴露唯一 public entry point；
- 源码跨文件 import 使用可被 Node.js 直接解析的显式 `.js` specifier；
- 不生产 CJS/ESM 双份 Core，不使用隐式 transpiler resolution；
- 不在生产环境直接执行 `.ts`；正式代码由 `tsc -b` 编译为 JavaScript；
- TypeScript project references 是 package DAG 和增量构建的权威机制；
- `tsc -b` 是正式 typecheck/build 入口，测试转译器不能替代编译门禁；
- 编译错误、声明生成错误或 project reference 漂移阻止构建。

### 3. 强类型基线

除 `strict` 外至少启用：

```text
noUncheckedIndexedAccess
exactOptionalPropertyTypes
noImplicitOverride
noPropertyAccessFromIndexSignature
useUnknownInCatchVariables
noFallthroughCasesInSwitch
verbatimModuleSyntax
isolatedDeclarations
noEmitOnError
```

跨 package、进程、API 和持久化边界仍以 JSON Schema runtime validation 为权威；TypeScript 类型不能替代边界验证。

禁止以大范围 `any`、`unknown as T`、`@ts-ignore`、跳过 lib check 或测试专用 deep import 绕开 Contract。

### 4. 工具角色

Phase 1 必须落盘并由 lockfile 精确固定：

- ESLint flat config + 与 TypeScript 6 正式兼容的 `typescript-eslint`；
- Prettier，仅负责格式，不承担语义门禁；
- Vitest，负责 unit/integration；
- fast-check，负责 property/model tests；
- StrykerJS，负责关键 reducer/policy/oracle mutation tests；
- dependency-cruiser 或经验证等价工具，负责 package architecture rules；
- Ajv 或经验证等价实现，负责 JSON Schema 2020-12 runtime validation；
- OpenTelemetry SDK，只负责非权威 telemetry。

这些工具的精确 patch 版本由 `pnpm-lock.yaml` 与 `toolchain/toolchain.json` 双重记录，不在 ADR 中复制第二套版本清单。

### 5. 供应链与安装

- 所有自动化使用 `pnpm install --frozen-lockfile`；
- 保留 pnpm 11 的 `minimumReleaseAge`、`blockExoticSubdeps` 等安全默认值；
- dependency lifecycle/build script 默认不执行，只通过显式 `allowBuilds` allowlist 开放；
- 仓库配置不得读取或展开开发机 registry secret；
- GitHub Action、下载器和 bootstrap reference 精确 pin；
- clean checkout 构建不得需要全局 npm package、Python、C/C++ 编译器或管理员权限；
- Windows 与 Linux 使用同一 lockfile，平台原生依赖必须通过 Release smoke 明确验证。

### 6. TypeScript 7 兼容轨

TypeScript 7 可作为非阻塞 compatibility lane 运行，但：

- 不生成正式 Release；
- 不与 TypeScript 6 共同构成双权威编译结果；
- 发现差异时以冻结的 TypeScript 6.0.3 Gate 为准，并记录兼容性 Evidence；
- 只有在 TypeScript 7 提供稳定 API、核心 lint/schema/test 工具正式支持、Windows/Linux 连续两个 Release Gate 通过后，才可由新 ADR 升级权威工具链。

## Canonical Ownership

- 工具链版本：根 `toolchain/toolchain.json`；
- package dependency identity：`pnpm-lock.yaml`；
- 编译语义：根 `tsconfig.base.json` + package project references；
- package public surface：各 package `exports`；
- Release 中实际版本：`ReleaseManifest`。

以上资产必须一致；任何自动化不得维护平行版本源。

## Consequences

- Phase 1 可以建立单一、可重复构建路径；
- TS7 的性能收益保留为可验证升级路径，而不是让生态兼容风险进入 authority path；
- ESM-only 消除 CJS/ESM 双实现、条件导出漂移和重复测试矩阵；
- 精确版本提高可复现性，但安全更新必须通过受治理的快速升级流程；
- 自包含 Release 增加制品体积，但符合本地无需开发工具链的目标。

## Rejected Alternatives

- **直接采用 TypeScript 7.0 作为唯一基线**：当前缺少稳定 programmatic API，关键 lint/tooling 尚未正式支持；
- **TypeScript 6 与 7 双权威构建**：会产生失败结果归属不清和不同语义；
- **支持任意 Node 24.x**：无法保证内置 API、SQLite 和打包结果一致；
- **pnpm 12 RC**：不把候选版包管理器放入第一条权威构建链；
- **CJS + ESM 双发布**：增加 package 边界、测试和语义所有权复杂度；
- **运行时直接执行 TypeScript**：把转译器行为引入生产运行时；
- **浮动 major/latest**：破坏可复现性和供应链审计。

## Verification

Phase 1 Gate 至少包括：

1. clean Windows 11 x64 与 Linux x64 checkout 使用冻结工具链构建；
2. offline/reproducible install fixture 与 lockfile integrity；
3. ESM import/export、中文/空格路径和 package public-entry tests；
4. architecture rule 能阻止 deep import、循环依赖和 dependency inversion；
5. 未 allowlist 的 dependency build script 被拒绝；
6. Release 在无 Node.js、pnpm、Python 和编译器的干净 Windows 环境启动；
7. manifest、实际二进制版本和构建 Evidence 一致。

## Revisit Triggers

- Node.js 24 进入不满足本项目支持窗口的阶段；
- TypeScript 7.1+ 提供稳定 API且核心工具正式支持；
- 安全修复要求立即升级 Node、TypeScript 或 pnpm；
- self-contained packaging 证明当前 exact runtime 不可行；
- 新工具链能在不改变 Contract/authority 语义下显著降低构建或发布风险。
