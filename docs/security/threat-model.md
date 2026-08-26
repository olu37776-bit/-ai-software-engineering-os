# Threat Model

状态：`BASELINE DRAFT v0.1`  
日期：`2026-08-26`

## 1. Scope

覆盖本地 Framework Runtime、Worker、Control API、Workspace、模型/工具/知识 Adapter、Storage、Evidence、Release/Upgrade 和 GitHub build pipeline。

## 2. Protected Assets

- authoritative event journal；
- Workflow/Node state；
- source Workspace 与 change set；
- secrets/credentials；
- local knowledge and business data；
- Evidence/artifacts；
- approval/policy decisions；
- Release artifacts/provenance；
- audit history；
- user control over external side effects。

## 3. Actors

- Local human operator；
- approved implementation/verification Agent；
- Framework system actor；
- Worker/Adapter；
- model/provider；
- external tool/service；
- untrusted repository/knowledge/web content；
- malicious dependency/release actor；
- local unprivileged/malicious process。

模型和外部内容始终不属于 trusted authority actor。

## 4. Trust Boundaries

```text
GitHub build/release -> downloaded artifact
Launcher -> Runtime
Runtime -> local storage
Runtime -> Worker process/sandbox
Runtime -> Model provider
Runtime -> Tool/external process
Runtime -> Workspace
Runtime -> GBrain/Knowledge provider
CLI/UI -> local Control API
Learning Proposal -> Policy/Human/Release Gate
```

每个边界需要身份、schema validation、permission、timeout、provenance 和 failure semantics。

## 5. Threats and Controls

### T1 Prompt Injection / Instruction Confusion

攻击：仓库、日志、知识页面或工具输出诱导模型调用工具、泄露 secret 或忽略 Policy。

控制：ContextItem trust/authority separation；capability Policy；secret handles；schema proposals；high-risk approval；injection fixtures；模型无 authority。

### T2 Hallucinated Success

攻击：模型或 Adapter 声称完成/验证，但无真实效果。

控制：Claim 与 Event 分离；SideEffectResult/Evidence；ResultOracle；GateDecision；模型/Executor 无 terminal write 权限。

### T3 Duplicate/Partial Side Effect

攻击：崩溃或 retry 重复写文件、发布、发送或删除。

控制：outbox/inbox、idempotencyKey、expected snapshot、reconciliation、non-retryable classification、approval/compensation。

### T4 Unauthorized File/Command/Network Access

控制：capability deny by default；path allowlist；restricted Worker；environment cleanup；network policy；preview；post-verification。

### T5 Secret Exfiltration

控制：SecretProvider handles；不进入 Context；redaction；provider sensitivity Policy；DLP tests；diagnostic preview；least privilege。

### T6 State/Journal Tampering

控制：transaction/integrity constraints；event hash chain or equivalent integrity option；file permissions；backup；audit；startup integrity check；quarantine。

### T7 Malicious Adapter/Dependency

控制：signed/verified distribution；adapter allowlist；capability manifest；process isolation；SBOM/provenance；contract tests；dependency review。

### T8 Approval Forgery/Replay

控制：actor identity；action/input hash binding；scope/expiry；single-use/replay protection；audit；separation of duties。

### T9 Stale/Poisoned Cache or Knowledge

控制：cache non-authority；freshness/provenance；content hash；source trust；explicit stale result；no silent fallback。

### T10 Local Control API Abuse

控制：loopback only；local auth token/OS protection；CSRF/origin policy where UI exists；rate limit；schema validation；audit；no direct DB endpoint。

### T11 Supply-chain Artifact Substitution

控制：checksum、signature/attestation、SLSA-aligned provenance、pinned actions/dependencies、local verification before activation。

### T12 Learning Self-corruption

控制：candidate vs validated cause；causal experiment；proposal-only V1；LearningGate；normal Verification/Release path；rollback；scope limits。

### T13 Denial of Service / Resource Exhaustion

控制：Context/artifact size limit；worker concurrency；timeout；queue/backpressure；disk quota alerts；circuit breakers；no unbounded retry。

### T14 Evidence Leakage

控制：sensitivity metadata；encryption/retention；redaction；export preview；content refs instead of duplicating payload；access Policy。

## 6. Security Invariants

1. untrusted content never gains instruction authority by wording；
2. model/Adapter cannot commit authority state；
3. no high-risk effect without explicit capability and required approval；
4. no secret in normal model Context/log/Evidence plaintext；
5. unsupported sandbox/Policy condition fails closed；
6. release activation only after integrity verification；
7. audit persistence failure blocks governed high-risk writes；
8. duplicate messages cannot produce duplicate committed outcome；
9. Learning cannot bypass normal change governance；
10. local private data is not uploaded by default。

## 7. Verification Matrix

| Threat | Required verification |
|---|---|
| Prompt injection | curated indirect injection scenarios + capability denial |
| Hallucinated success | fake success claim/exit-0-but-wrong Oracle tests |
| Duplicate effects | crash boundary + duplicate delivery property tests |
| Path/command injection | fuzzing + Windows path cases |
| Secret leakage | canary secret tests + log/artifact scanner |
| Journal tampering | corruption fixture + startup quarantine |
| Approval replay | expiry/scope/input-change tests |
| Supply chain | provenance/checksum verification on clean machine |
| Learning corruption | counterexample/contradicting Evidence tests |
| Local API | external bind/auth/rate tests |

## 8. Open Risks Requiring ADR/Spike

- Windows native sandbox guarantees and fallback levels；
- local Control API authentication mechanism；
- event/artifact cryptographic integrity depth；
- third-party Adapter loading policy；
- local Evidence encryption/key management；
- provider data-retention verification；
- signed Human Approval identity in single-user local mode。

Open risk 不能被默认实现静默决定。
