# 本地拉取 Authority：固定仓库、ref 与执行版本

状态：`CURRENT DELIVERY GUIDE`。这里只下载设计，不执行业务建设，不上传本地文件。

## 1. 固定位置

- 远程：`https://github.com/olu37776-bit/-ai-software-engineering-os.git`
- 本地只读 Authority checkout：`D:\ai-authority\ai-software-engineering-os`
- 入口：`docs/knowledge-reconstruction/authority-index.md`

这不是本地 Swap 工程、正式知识仓或私有报告目录。旧 `D:\ai-authority\excel-arrival-tool` 保留但不再作为本支线任务入口；无需删除、迁移或改 remote。

## 2. 本次未合并设计的读取方式

当前设计分支：`docs/knowledge-reconstruction-design-v1-20260908`。

本次只供审查；未合并前不能要求从 main 读取尚不存在的文件。后续合并且正式发布 CURRENT Task 后，才将下面 `$Ref` 改成 `main`。长任务开始后固定打印出的 SHA，不在任务中途继续更新。

PowerShell：

```powershell
$ErrorActionPreference = 'Stop'
$Repo = 'https://github.com/olu37776-bit/-ai-software-engineering-os.git'
$A = 'D:\ai-authority\ai-software-engineering-os'
$Ref = 'docs/knowledge-reconstruction-design-v1-20260908'
function Invoke-CheckedGit {
    param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments)
    & git @Arguments
    if ($LASTEXITCODE -ne 0) { throw "git failed (exit=$LASTEXITCODE); stop, do not reset or clean." }
}
if (-not (Test-Path -LiteralPath $A)) {
    New-Item -ItemType Directory -Path (Split-Path $A -Parent) -Force | Out-Null
    Invoke-CheckedGit clone --no-checkout $Repo $A
} else {
    if (-not (Test-Path -LiteralPath (Join-Path $A '.git'))) { throw 'Target exists but is not the expected checkout.' }
    $Top = (Invoke-CheckedGit -C $A rev-parse --show-toplevel).Trim()
    if ([IO.Path]::GetFullPath($Top).TrimEnd('\') -ne [IO.Path]::GetFullPath($A).TrimEnd('\')) { throw 'Wrong Git root.' }
    $Remote = (Invoke-CheckedGit -C $A remote get-url origin).Trim()
    if ($Remote -ne $Repo) { throw 'Origin does not match; do not rewrite it.' }
    $Dirty = @(Invoke-CheckedGit -C $A status --porcelain)
    if ($Dirty.Count -ne 0) { throw 'Checkout is dirty; preserve files and stop.' }
}
Invoke-CheckedGit -C $A fetch --no-tags origin "refs/heads/${Ref}:refs/remotes/origin/${Ref}"
Invoke-CheckedGit -C $A switch --detach "refs/remotes/origin/$Ref"
Invoke-CheckedGit -C $A rev-parse HEAD
Get-Content -LiteralPath (Join-Path $A 'docs\knowledge-reconstruction\authority-index.md') -Encoding UTF8
```

本段使用 fetch + detached checkout 固定本次版本，而非在未知工作分支直接 pull。执行前查看远端新任务通知的 ref；网络或权限失败时停止，不清理用户改动、不自动选镜像、不改代理配置。作者未在用户 Windows 机器执行本命令，首次本地使用需记录实际结果。

## 3. 安全与恢复

只在专用 Authority checkout 下载；禁止把知识仓挂到此 remote，禁止 `git push`。下载不需要上传单位源码/日志。不要 `reset --hard`、`clean`、覆盖未知目录或携带内部资料到 GitHub Issue/PR。

读取索引后，只执行其中 CURRENT Task；把 Authority SHA 记入该任务规定的本地报告。当前任务只允许设计审查，不能从设计中的未来路线自行开工。

如果原本已处于一个批准 task 的执行/审查中，先完成或停止该 task，再同步新 Authority；不同 SHA 不能混在一个执行记录里。

## 4. 后续聊天只保留什么

后续短提示词只给：专用 checkout、确切 ref 或已批准 SHA、上述拉取命令/本文件、Authority Index、当前 task 路径和短回执要求。完整设计、写范围、门禁都在仓库，不复制到聊天。

独立 Reviewer 可对当前 PR HEAD 审查；本地正常实施只按已发布 CURRENT Task。没有新任务文档时，读到设计并不意味着获得下一阶段写权限。
