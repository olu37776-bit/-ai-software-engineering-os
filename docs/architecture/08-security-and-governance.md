# 安全与治理

状态：`BASELINE DRAFT v0.1`  
日期：`2026-08-26`

## 1. 安全目标

Framework 同时处理源码、模型、工具、Secrets、知识和可执行命令，默认威胁面高于普通本地应用。安全必须进入执行模型、Contract 和 Policy，而不是发布前附加扫描。

## 2. 主要威胁

- Workspace、知识库、网页或日志中的 prompt injection；
- 模型 hallucination 被当成权威事实；
- 过宽工具/文件/网络权限；
- secret 泄露到 prompt、日志、Evidence 或外部 provider；
- shell/path traversal/命令注入；
- 恶意依赖、构建脚本或 Release 制品；
- Adapter 伪造成功、丢失 Evidence 或版本不匹配；
- 重试导致重复外部副作用；
- 未授权状态迁移或审批伪造；
- Event/Artifact 篡改；
- cache poisoning 和 stale Context；
- LearningProposal 造成自我强化错误；
- 本地 Control API 被其他进程滥用。

## 3. 信任分层

建议：

```text
SYSTEM_AUTHORITY
SIGNED_POLICY
HUMAN_APPROVAL
VERIFIED_CONTRACT
TRUSTED_LOCAL_SOURCE
UNTRUSTED_CONTENT
MODEL_PROPOSAL
```

Trust level 不是检索相关度，也不是模型 confidence。任何来源的内容只有经过明确授权才能成为指令。

## 4. Capability-based Security

Node/Skill 明确申请 capability，Policy 计算最小权限集。Worker 只获得当前 task 需要的 capability token/handle。

默认拒绝：

- 任意磁盘访问；
- 任意网络访问；
- 任意 shell；
- secret 读取；
- 修改 Git 历史；
- 删除/覆盖大量文件；
- 发布、发送消息或外部写操作。

高风险操作必须具备 precondition、diff/preview、Human Approval 和后置 Verification。

## 5. 隔离执行

Execution Adapter 提供安全级别：

- `PROCESS_RESTRICTED`：受限子进程、路径 allowlist、环境清理；
- `OS_SANDBOXED`：利用操作系统/WSL 沙箱；
- `CONTAINER_ISOLATED`：容器隔离；
- `REMOTE_ISOLATED`：受治理远程 executor。

Node Contract/Policy 声明最低级别。环境不满足时 fail closed，不能静默降级为 unrestricted host execution。

## 6. Prompt Injection 防护

- instruction 与 data 使用独立 channel/structure；
- ContextItem 携带 `instructionAuthority`；
- 外部内容中的工具调用要求一律视为数据；
- 模型提出的高风险行动必须经过 Policy 和 approval；
- 不把 secrets 注入模型；
- 对工具输出再次进行 schema 和 content policy 检查；
- Evidence 中记录 Context source 与 trust；
- 安全测试包含 indirect prompt injection scenarios。

## 7. 数据与隐私

- local-first，默认不上传运行数据；
- provider 调用前按 sensitivity Policy 检查；
- Artifact Store 支持敏感级别、加密和 retention；
- 日志默认脱敏；
- 导出/诊断 bundle 必须显示将包含什么；
- 删除采用显式 retention/erase workflow，并记录 audit event；
- content hash 可用于完整性，但不能泄露敏感明文。

## 8. 审批与职责分离

- 实现者不能通过自述完成独立验证；
- 申请者不能伪造 approver；
- Human Approval 绑定具体 action、input hash 和 expiry；
- risk acceptance 必须显式记录未覆盖风险；
- emergency override 需要独立 reason、scope、expiry 和后续复盘；
- LearningGate 与 ReleaseGate 分离。

## 9. Audit

所有以下行为形成不可变审计事实：

- Policy decision；
- permission grant/deny；
- approval request/decision；
- secret handle 使用；
- external side effect；
- state transition；
- Evidence 创建/失效；
- config/schema migration；
- release install/activation/rollback；
- LearningProposal application。

Audit event 与普通 debug log 分离，不受日志级别关闭影响。

## 10. 供应链

Release pipeline 目标：

- dependency lockfile；
- least-privilege GitHub Actions；
- pinned action/reference；
- secret scanning；
- static/dependency/license checks；
- SBOM；
- reproducible or hermetic build where practical；
- artifact checksum；
- build provenance/attestation；
- signed release；
- local installer verification；
- rollback to verified prior release。

供应链目标参考当前 SLSA 和 NIST SSDF，但实际控制以本项目 threat model 和可验证结果为准。

## 11. 安全失败语义

安全组件异常时：

- Policy engine unavailable -> 阻止受治理写操作；
- secret provider unavailable -> Node `BLOCKED`；
- sandbox unavailable -> 不满足最低隔离级别的任务拒绝；
- artifact integrity mismatch -> quarantine + terminal security event；
- approval signature/identity invalid -> reject；
- audit persistence failure -> 高风险写操作不得继续。

禁止 catch 后只写 warning 并继续。

## 12. 安全验证

关键门禁至少包括：

- threat-model test scenarios；
- permission/property tests；
- path traversal/command injection fuzzing；
- prompt injection red-team fixtures；
- secret leakage scanners；
- dependency and provenance verification；
- crash/retry duplicate side-effect tests；
- approval replay/expiry tests；
- tampered journal/artifact detection；
- Windows local API exposure tests。
