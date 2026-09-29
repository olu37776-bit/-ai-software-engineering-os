# Authority 获取协议：复用既有 .ai-local，仅下载当前任务需要的文档

状态：`CURRENT DELIVERY GUIDE`

本协议用于把 GitHub 上的 Knowledge Reconstruction Authority 单向交付给本地 Agent。

目标：

- 不 clone / fetch / checkout Framework 仓库；
- 不新建第二套 `D:\ai-authority` 目录体系；
- 继续使用既有 Swap 本地治理根：`<SwapRepo>\.ai-local\knowledge\reconstruction\`；
- 每次只缓存当前 Authority SHA 下真正需要的 Markdown。

## 1. 本地固定位置

正式知识：

- `D:\gbrain-knowledge\swap-kb\`
- `D:\gbrain-knowledge\microwave-kb\`

Raw Sources：

- `D:\swap-knowledge-sources\`

长期本地治理根：

- `<SwapRepo>\.ai-local\knowledge\reconstruction\`

远程 Authority 只读缓存：

- `<SwapRepo>\.ai-local\knowledge\reconstruction\authority-cache\<AUTHORITY_SHA>\`

`<SwapRepo>` 必须是 Agent 当前已经打开的 Swap 项目仓库，并且应已存在：

`.ai-local\knowledge\reconstruction\`

如果当前 Workspace 无法唯一证明这一点：

`BLOCKED_BY_AUTHORITY`

禁止扫描磁盘猜测 SwapRepo。

## 2. 禁止把 Framework 项目拉到本地

Authority 获取阶段禁止：

```text
git clone
git fetch
git pull
git checkout
git switch
git sparse-checkout
gh repo clone
Download ZIP
repository archive / source tarball
```

也禁止创建 Framework 仓库的 `.git`、packages、apps、tests、operations、.github 等工作树。

网络或单文件下载失败时 fail closed；不得自动退化成整仓下载。

## 3. exact SHA 是任务输入

每次任务必须由聊天短提示词给出完整 40 位：

`AUTHORITY_SHA`

不得自行使用“latest main”“latest PR HEAD”继续执行。

如果没有 exact SHA：

`BLOCKED_BY_AUTHORITY`

一个执行/审查 subject 中不能切换 Authority SHA。

## 4. 下载顺序

只按以下顺序：

1. 下载 `docs/knowledge-reconstruction/authority-index.md`；
2. 阅读 index，取得唯一 CURRENT Task；
3. 下载 CURRENT Task；
4. 只下载 CURRENT Task 明确要求的 supporting Authority；
5. 其余 Framework 文件不持久化到本机。

因此不同任务缓存的文件数量可以不同，不要求固定下载整个 `docs/knowledge-reconstruction/` 目录。

## 5. 单文件下载模板

```powershell
$ErrorActionPreference = 'Stop'

$Owner = 'olu37776-bit'
$Repo = '-ai-software-engineering-os'
$AuthoritySha = '<EXACT_40_CHAR_SHA>'

$SwapRepo = (Get-Location).Path
$GovernanceRoot = Join-Path $SwapRepo '.ai-local\knowledge\reconstruction'

if (-not (Test-Path -LiteralPath $GovernanceRoot)) {
    throw 'BLOCKED_BY_AUTHORITY: current workspace is not proven SwapRepo'
}

if ($AuthoritySha -notmatch '^[0-9a-f]{40}$') {
    throw 'BLOCKED_BY_AUTHORITY: invalid AUTHORITY_SHA'
}

$CacheRoot = Join-Path $GovernanceRoot "authority-cache\$AuthoritySha"
New-Item -ItemType Directory -Path $CacheRoot -Force | Out-Null

function Get-AuthorityFile {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)][string]$TargetRelative
    )

    if (-not $Path.StartsWith('docs/knowledge-reconstruction/')) {
        throw "Authority cache only accepts knowledge-reconstruction docs: $Path"
    }

    $Url = "https://raw.githubusercontent.com/$Owner/$Repo/$AuthoritySha/$Path"
    $Response = Invoke-WebRequest -Uri $Url -UseBasicParsing

    if ($Response.StatusCode -ne 200) {
        throw "Authority download failed: $Path"
    }

    $Bytes = [System.Text.Encoding]::UTF8.GetBytes($Response.Content)

    if ($Bytes.Length -gt 2MB) {
        throw "Unexpected Authority file size: $Path"
    }

    $Target = Join-Path $CacheRoot $TargetRelative
    New-Item -ItemType Directory -Path (Split-Path $Target -Parent) -Force | Out-Null
    [System.IO.File]::WriteAllBytes($Target, $Bytes)
}

Get-AuthorityFile 'docs/knowledge-reconstruction/authority-index.md' 'authority-index.md'

Get-Content -LiteralPath (Join-Path $CacheRoot 'authority-index.md') -Encoding UTF8
```

读取 index 后，再按 CURRENT Task 的精确路径调用 `Get-AuthorityFile`。

## 6. supporting Framework 文件

CURRENT Task 如果确实要求核对 Framework 其他公开文件，这些文件不得保存到 authority-cache。

只允许使用 Task 指定的 exact commit SHA + exact path，通过 Raw GitHub HTTP 读取到内存。

```powershell
function Read-FrameworkFile {
    param(
        [Parameter(Mandatory=$true)][string]$CommitSha,
        [Parameter(Mandatory=$true)][string]$Path
    )

    if ($CommitSha -notmatch '^[0-9a-f]{40}$') {
        throw 'Invalid Framework commit SHA'
    }

    $Url = "https://raw.githubusercontent.com/$Owner/$Repo/$CommitSha/$Path"
    return (Invoke-WebRequest -Uri $Url -UseBasicParsing).Content
}
```

不使用 `-OutFile`。Task 未明确列出的 Framework 文件不得因为“可能相关”而读取。

## 7. cache 内容与 Evidence

每个 Authority SHA 的 cache 只保存：

- `authority-index.md`
- CURRENT Task
- CURRENT Task 明确要求的 supporting Knowledge Reconstruction Authority
- 可选 `delivery-record.json`

不得保存 Framework 源码、测试或其他目录。

本地报告必须记录：

- `AUTHORITY_SHA`
- 实际下载的 Authority 文件清单
- CURRENT Task
- 本地执行 subject

完整内部 Evidence 仍留在 `<SwapRepo>\.ai-local\knowledge\reconstruction\`，不要上传 GitHub。

## 8. 后续聊天提示词

聊天只负责提供 exact `AUTHORITY_SHA`、当前任务所需 Authority 文件路径、单文件下载命令、开始/停止条件和最终短回执。

完整设计、WRITE_SCOPE、Evidence、Verification 和 Gate 继续由仓库 Authority 维护。
