# 本地获取 Authority：只下载本支线明确文件

状态：`CURRENT DELIVERY GUIDE`。

本规则的目标不是“少 checkout 一点”，而是**完全不建立 Framework 仓库的本地 Git checkout**。

本地 Agent 只允许下载当前任务明确列出的 Knowledge Reconstruction Authority Markdown。不得 clone、fetch、pull、checkout、下载 ZIP 或 source archive。

## 1. 固定边界

远程仓库：

`https://github.com/olu37776-bit/-ai-software-engineering-os`

本地 Authority cache：

`D:\\ai-authority\\knowledge-reconstruction\\<AUTHORITY_SHA>\\`

当前默认允许持久化到本地 cache 的文件只有：

```text
docs/knowledge-reconstruction/authority-index.md
docs/knowledge-reconstruction/architecture/overall-design-v1.md
docs/knowledge-reconstruction/reviews/design-v1-review-scope.md
docs/knowledge-reconstruction/operations/authority-sync.md
```

这些文件就是本支线远程 Authority。Framework 其他源码、测试、配置、文档不得因为读取 Authority 而落到本机。

## 2. AUTHORITY_SHA 必须由当前任务明确给出

不得以 branch/main 的“最新版本”作为长期任务输入。

聊天中的短执行提示词必须提供完整 40 位 `AUTHORITY_SHA`。Agent 只下载这个 commit 上的明确文件。

如果没有 exact SHA：

`BLOCKED_BY_AUTHORITY`

不得自行解析 latest main、latest PR HEAD 后继续。

## 3. Windows PowerShell：只下载四个 Authority 文件

把聊天中给出的 SHA 填入 `$AuthoritySha`：

```powershell
$ErrorActionPreference = 'Stop'

$Owner = 'olu37776-bit'
$Repo = '-ai-software-engineering-os'
$AuthoritySha = '<EXACT_40_CHAR_AUTHORITY_SHA_FROM_CURRENT_TASK>'
$Root = "D:\ai-authority\knowledge-reconstruction\$AuthoritySha"

if ($AuthoritySha -notmatch '^[0-9a-f]{40}$') {
    throw 'Missing or invalid AUTHORITY_SHA. Stop.'
}

$Files = @(
    'docs/knowledge-reconstruction/authority-index.md',
    'docs/knowledge-reconstruction/architecture/overall-design-v1.md',
    'docs/knowledge-reconstruction/reviews/design-v1-review-scope.md',
    'docs/knowledge-reconstruction/operations/authority-sync.md'
)

New-Item -ItemType Directory -Path $Root -Force | Out-Null

foreach ($Path in $Files) {
    $Url = "https://raw.githubusercontent.com/$Owner/$Repo/$AuthoritySha/$Path"
    $Relative = $Path.Substring('docs/knowledge-reconstruction/'.Length)
    $Target = Join-Path $Root $Relative
    New-Item -ItemType Directory -Path (Split-Path $Target -Parent) -Force | Out-Null

    $Response = Invoke-WebRequest -Uri $Url -UseBasicParsing
    if ($Response.StatusCode -ne 200) {
        throw "Authority download failed: $Path"
    }

    $Bytes = [System.Text.Encoding]::UTF8.GetBytes($Response.Content)
    if ($Bytes.Length -gt 2MB) {
        throw "Unexpected Authority file size: $Path"
    }

    [System.IO.File]::WriteAllBytes($Target, $Bytes)
}

@{
    authoritySha = $AuthoritySha
    downloadedAt = (Get-Date).ToString('o')
    files = $Files
} | ConvertTo-Json -Depth 3 |
    Set-Content -LiteralPath (Join-Path $Root 'delivery-record.json') -Encoding UTF8

Get-Content -LiteralPath (Join-Path $Root 'authority-index.md') -Encoding UTF8
```

执行完成后，本地 `$Root` 中只能存在：

- 上述四个 Authority Markdown；
- `delivery-record.json`。

没有 `.git`，没有 Framework package、源码、测试、CI、roadmap 或其他项目目录。

## 4. 任务确实需要核对其他公开仓库文件时

**不得下载到 Authority cache，也不得 clone 仓库。**

只能按任务文档明确列出的 exact path + exact commit，通过 Raw GitHub 单文件读取到内存，例如：

```powershell
$Path = 'docs/architecture/07-local-integrations.md'
$Url = "https://raw.githubusercontent.com/$Owner/$Repo/$AuthoritySha/$Path"
$Text = (Invoke-WebRequest -Uri $Url -UseBasicParsing).Content

# 直接检查 $Text；不使用 -OutFile，不持久化整个项目文件。
```

如果任务要求的是另一个明确 base/main SHA，应使用任务文档指定的那个 SHA，而不是自动跟随最新 main。

未被 CURRENT Task 明确列出的项目文件不得读取。

## 5. 明确禁止

本地 Agent 在 Authority 获取阶段不得执行：

```text
git clone
git fetch
git pull
git checkout
git switch
git sparse-checkout
gh repo clone
GitHub Download ZIP
任何 repository archive / source tarball 下载
```

也不得：

- 把 Framework 仓库 remote 加到本地 Swap / Knowledge Repo；
- 把内部源码、Knowledge Page、Raw Sources、Evidence 上传到 GitHub；
- 因 HTTP 单文件读取失败而自动退化为完整仓库下载；
- 在一个任务运行中切换到新的 Authority SHA。

HTTP、权限或指定文件失败时立即停止并返回 blocker。

## 6. 本地执行与报告

读取顺序：

1. `authority-index.md`
2. 其中标记的 CURRENT TASK
3. CURRENT TASK 明确要求的其他 Authority 文件
4. 本机已有 Swap 源码、Raw Sources、Knowledge Repo 和私有 Evidence

内部事实源直接从本机读取，不通过这个 GitHub Authority cache 搬运。

所有本地报告记录 `AUTHORITY_SHA`。不同 Authority SHA 的执行不得合并成一个 VERIFIED subject。

## 7. 后续聊天提示词

后续聊天只需要提供：

- `AUTHORITY_SHA`
- 上面的 exact-file 下载命令或指向本文件
- CURRENT TASK 文件
- 最终短回执要求

完整设计、WRITE_SCOPE、Evidence 和 Gate 留在仓库 Authority 中；Framework 项目本身不下发到本地 Agent。
