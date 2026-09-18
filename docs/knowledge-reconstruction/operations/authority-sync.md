# 本地拉取 Authority：只取 Authority 子树并固定执行版本

状态：`CURRENT DELIVERY GUIDE`。这里只下载公开 Authority，不执行业务建设，不上传本地文件。

## 1. 固定位置

- 远程：`https://github.com/olu37776-bit/-ai-software-engineering-os.git`
- 本地只读 Authority checkout：`D:\\ai-authority\\ai-software-engineering-os`
- 默认稀疏目录：`docs/knowledge-reconstruction/`
- 入口：`docs/knowledge-reconstruction/authority-index.md`

Authority checkout 不是本地 Swap 工程、正式知识仓或私有报告目录。旧 `D:\\ai-authority\\excel-arrival-tool` 保留历史即可，不改 remote、不搬内容。

**本地 Agent 不应为了读取 Authority 拉取或 checkout 整个 Framework 项目。** 默认使用 Git partial clone + sparse checkout；CURRENT Task 需要的少量仓库外 Authority/Contract 文件，使用固定 SHA 的 `git show` 按文件读取，不扩大工作树。

## 2. 本次未合并设计的读取方式

当前设计 ref：

`docs/knowledge-reconstruction-design-v1-20260908`

未合并前不能从 `main` 假定这些文件存在。后续设计合并并正式发布新的 CURRENT Task 后，再由新任务把 `$Ref` 改成 `main` 或固定批准 SHA。

PowerShell：

```powershell
$ErrorActionPreference = 'Stop'
$Repo = 'https://github.com/olu37776-bit/-ai-software-engineering-os.git'
$A = 'D:\ai-authority\ai-software-engineering-os'
$Ref = 'docs/knowledge-reconstruction-design-v1-20260908'

function Invoke-CheckedGit {
    param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments)
    & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "git failed (exit=$LASTEXITCODE); stop without reset/clean."
    }
}

if (-not (Test-Path -LiteralPath $A)) {
    New-Item -ItemType Directory -Path (Split-Path $A -Parent) -Force | Out-Null
    Invoke-CheckedGit clone --filter=blob:none --no-checkout --single-branch --branch $Ref $Repo $A
    Invoke-CheckedGit -C $A sparse-checkout init --cone
    Invoke-CheckedGit -C $A sparse-checkout set docs/knowledge-reconstruction
} else {
    if (-not (Test-Path -LiteralPath (Join-Path $A '.git'))) {
        throw 'Target exists but is not the expected Authority checkout.'
    }
    $Top = (Invoke-CheckedGit -C $A rev-parse --show-toplevel).Trim()
    if ([IO.Path]::GetFullPath($Top).TrimEnd('\') -ne [IO.Path]::GetFullPath($A).TrimEnd('\')) {
        throw 'Wrong Git root.'
    }
    $Remote = (Invoke-CheckedGit -C $A remote get-url origin).Trim()
    if ($Remote -ne $Repo) {
        throw 'Origin does not match; do not rewrite it.'
    }
    $Dirty = @(Invoke-CheckedGit -C $A status --porcelain)
    if ($Dirty.Count -ne 0) {
        throw 'Authority checkout is dirty; preserve files and stop.'
    }
    Invoke-CheckedGit -C $A sparse-checkout init --cone
    Invoke-CheckedGit -C $A sparse-checkout set docs/knowledge-reconstruction
}

Invoke-CheckedGit -C $A fetch --filter=blob:none --depth=1 --no-tags origin "refs/heads/${Ref}:refs/remotes/origin/${Ref}"
Invoke-CheckedGit -C $A switch --detach "refs/remotes/origin/$Ref"
Invoke-CheckedGit -C $A sparse-checkout reapply

$AuthoritySha = (Invoke-CheckedGit -C $A rev-parse HEAD).Trim()
Write-Host "AUTHORITY_SHA=$AuthoritySha"
Get-Content -LiteralPath (Join-Path $A 'docs\knowledge-reconstruction\authority-index.md') -Encoding UTF8
```

任务开始后固定打印出的 `AUTHORITY_SHA`。同一个实施/审查记录中不得中途 pull/fetch 另一个 Authority 版本。

## 3. CURRENT Task 需要少量主线文件时

默认**不要把 `docs/architecture`、`docs/roadmap` 或源码目录加入 sparse checkout**。

CURRENT Task 若列出必须核对的公开仓库文件，按固定 `AUTHORITY_SHA` 精确读取，例如：

```powershell
git -C $A show "$AuthoritySha`:CONTRIBUTING.md"
git -C $A show "$AuthoritySha`:docs/README.md"
git -C $A show "$AuthoritySha`:docs/architecture/07-local-integrations.md"
git -C $A show "$AuthoritySha`:docs/architecture/04-context-contract-policy.md"
git -C $A show "$AuthoritySha`:docs/roadmap/progress-status.md"
```

partial clone 会只按需取这些 blob，不把对应目录完整 checkout。

如果任务要求比较另一个明确 commit/base，先只获取该 commit，再用 `git show <SHA>:<path>`：

```powershell
$Base = '<TASK_DECLARED_SHA>'
Invoke-CheckedGit -C $A fetch --filter=blob:none --depth=1 --no-tags origin $Base
git -C $A show "$Base`:docs/architecture/07-local-integrations.md"
```

任务未声明的目录/源码不能因为“可能有用”就加入 checkout。确实需要新增公开文件时，先按 CURRENT Task 的 scope 处理；需要内部源码/资料则从本机既有事实源读取，绝不上传到 Authority checkout。

## 4. 明确禁止的同步方式

Authority checkout 不执行：

- 普通 `git clone <repo>` 后完整 checkout；
- `git pull` 让未知工作树自动前进；
- `git fetch --all`；
- `git sparse-checkout disable`；
- `git checkout .` / `reset --hard` / `clean`；
- 将本地 Swap 源码、Knowledge Repo、Raw Sources 或 Evidence 复制到本 checkout；
- `git push`。

网络、ref、权限或 partial clone 不受支持时停止并返回 blocker；不要自动退化为整仓 clone。

## 5. 安全、恢复与后续聊天

只在专用 Authority checkout 下载公开设计。读取索引后，只执行其中唯一 CURRENT Task；将 `AUTHORITY_SHA` 写入该任务规定的本地报告。

如果已有批准任务正在执行/审查，先完成或停止该 subject，再同步新 Authority。不同 SHA 不得混入同一执行记录。

后续聊天只需要给：

- Authority repo；
- 当前 ref/批准 SHA；
- 本文件或短版 sparse/partial 拉取命令；
- Authority Index；
- CURRENT Task；
- 文档规定的短回执。

完整设计、WRITE_SCOPE、门禁、Evidence 要求继续只维护在仓库 Authority 中。
