# 从这里开始 · 数有依据离线交接

**无需GitHub账号，不包含作者账号/数据库/密钥。** 这是完整源码和Git历史的离线交付；首次安装Python/Node/Git和pip/npm依赖仍通常需要联网，包内没有依赖缓存或安装器。

## 包里有什么

- `source/shuyouyiju/`：最终基线的完整干净源码（无.git）。
- `history/shuyouyiju.bundle`：原开发分支全部可达真实历史，无前置依赖；不是复制作者.git配置。
- `demo-fixtures/`：统一合成CSV、替代XLSX、DOCX、规则TXT、PNG及答案清单，明确非真实调查。
- `MANIFEST.json`：基线SHA、分支、源文件/Git对象树校验、逐文件SHA256和大小。
- `VALIDATION.md`：本次实际恢复/安装/运行和敏感检查结果及未验证范围。
- `Verify-Package.ps1`：只读逐文件校验，不联网、不运行模型。

## 第一件事：校验并恢复自己的工作区

1. 把ZIP完整解压到短路径，例如`D:/Projects/syj-handoff`（可自选），不要直接在ZIP内编辑。核对发送方另附的ZIP SHA256。
2. 安装Git for Windows（Git本地使用无需GitHub账号），在解压根打开PowerShell。先执行文件校验；执行策略阻止时，可只为本进程运行下面命令，不更改全局策略，也可用Get-FileHash人工对照manifest：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Verify-Package.ps1
```

3. 校验通过后，在同一目录恢复Git历史，`workspace`目标必须不存在：

```powershell
git clone --branch codex/ai-assisted-verification .\history\shuyouyiju.bundle .\workspace
if ($LASTEXITCODE -ne 0) { throw 'Restore failed' }
Set-Location workspace
git rev-parse HEAD
# 与上一层MANIFEST.json的baseline_sha必须完全一致
git status --short
# 只在这个新恢复的仓库移除本地bundle origin，不涉及作者远端
git remote remove origin
git switch -c codex/teammate-ui
```

4. 后续**只编辑workspace**，source作为收到时的快照不要两边同时修改。读`workspace/HANDOFF.md`，按`workspace/NEW_MACHINE_SETUP.md`的“依赖安装（共用步骤）”安装，跳过GitHub获取选项。
5. 默认百炼API Key留空，先注册自己的合成账户，运行手动业务和优化页面。ChatGPT/Codex账号不需要发给别人，也不是本项目模型API凭据。

## 第一次启动与给Codex的提示

建议Python3.13.11、Node24.22.2，锁文件和完整步骤在源码里。两个PowerShell终端分别在backend启动venv uvicorn8000、frontend启动Vite5173。生产预览build后4173；都只是本机服务，不是公网。

可给队友自己的Codex：

> 请在这个workspace继续《数有依据》，先读HANDOFF.md和AGENTS.md，核对当前分支/HEAD/修改。仅优化我指定的页面与交互，沿用现有栈、业务和白底蓝色风格；不绕过账户/规则/冲突/版本检查；默认真实模型0次。按范围验证并保存真实提交，不重建项目、不清库、不改main。实际数据与凭据只留本机。

合成资料可直接用包内demo-fixtures，或运行源码生成器。不要同时把CSV/XLSX当不同批次累计。旧DEMO_GUIDE的作者项目UUID链接不能在队友新电脑使用；创建自己的账户和项目。

## 如何交还

按`workspace/docs/OFFLINE_HANDOFF.md`操作，用自己的本地Git身份提交，在`codex/teammate-ui`生成完整返回bundle，附SHA256、基线、最新提交、改动/检查说明和少量脱敏截图交还。无需GitHub登录或推送权限。不要把包含.env、DB、session的workspace整目录ZIP发回。

本包含私有项目源码与完整提交历史（包含正常作者身份元数据），只发给获授权队友；不改变仓库可见性，不自动邀请其他账号。校验是完整性检查，不是第三方签名/安全认证。
