# 无GitHub账号的离线协作

Git本地版本管理不要求GitHub账户。交接ZIP只包含干净源码、完整开发分支bundle、合成资料与清单；不包含作者.git配置、数据、凭据、依赖或Codex登录。先读包根START_HERE.md，核对MANIFEST.json中的基线。

## 恢复为可继续提交的仓库

安装Git for Windows，在解压包根目录执行（目标workspace必须不存在）：

```powershell
# 可选检查当前包内所有文件；若执行策略拦截，可人工Get-FileHash核对MANIFEST
powershell -NoProfile -ExecutionPolicy Bypass -File .\Verify-Package.ps1
# 此脚本仅临时Process执行策略，不改变系统设置；也可不运行脚本直接执行下方Git命令

git clone --branch codex/ai-assisted-verification .\history\shuyouyiju.bundle .\workspace
if ($LASTEXITCODE -ne 0) { throw '恢复失败，停止后续操作' }
Set-Location workspace
git rev-parse HEAD
# 对照包根MANIFEST.json的baseline_sha，必须逐字一致
git status --short
# origin此时只是本地bundle文件，不是GitHub；移除避免误推
# 只在新恢复的workspace执行，不是在原作者仓库执行
git remote remove origin
# 基于收到的开发基线开工作分支，保留全部祖先历史
git switch -c codex/teammate-ui
# 用队友自己的本地提交身份；无需GitHub，邮箱使用自己愿意保留在历史中的地址
git config --local user.name '你的名字'
git config --local user.email '你自己的提交邮箱'
```

不要同时编辑source与workspace两份：推荐只在workspace开发，source保留为收到的源码快照。Git配置由恢复操作新建，不是从作者电脑复制。未安装Git也能从source运行，但继续开发和交还历史需要安装Git；不要用git init替代bundle历史。

在Codex中选workspace为项目，提示“先阅读HANDOFF.md和AGENTS.md，本轮仅优化页面/交互，保留后台防线，默认0百炼调用”，再描述具体页面目标。账号由队友在自己Codex中登录，不传作者配置；项目API密钥与Codex账户是独立的。

## 安装启动

按照workspace内NEW_MACHINE_SETUP.md的“依赖安装（共用步骤）”和后面的双终端启动。不要执行其中GitHub获取选项；你已经从bundle恢复。使用自己的新venv和空的模型Key，注册自己的合成账户。

包中的demo-fixtures是明确合成，或在workspace运行生成器。旧DEMO_GUIDE的作者本地任务链接不能在新电脑使用。离线交接不是完全无网络安装器：pip/npm初次安装、下载Python/Node/Git通常需要网络。没有附依赖缓存、浏览器安装器、字体或私人数据库。

## 把修改交还原作者

先在workspace内确认：

```powershell
git status --short
git diff --check
# 选择实际改动的源码/说明，避免git add .误纳入私人运行文件
git add frontend/src/你实际修改的文件
# 有多文件时逐项列出；完成相关检查后提交
git commit -m 'feat(ui): 说明具体页面和交互改动'
# 如果没有改动，不为凑记录创建空提交
```

提交前检查新文件、提交历史不含密钥、数据库、session或私人上传。然后创建**完整、无前置依赖**的返回bundle（大小较增量bundle略大，但恢复更可靠）：

```powershell
# 在workspace根；输出在外层，不进Git
# 若文件已存在先改名，不覆盖之前交还的包
git bundle create ..\teammate-return.bundle codex/teammate-ui
if ($LASTEXITCODE -ne 0) { throw '打包失败' }
git bundle verify ..\teammate-return.bundle
git rev-parse HEAD
git log --oneline codex/ai-assisted-verification..codex/teammate-ui
Get-FileHash ..\teammate-return.bundle -Algorithm SHA256
```

发回：返回bundle＋SHA256＋原包基线SHA/工作分支/最新SHA＋改动与测试说明＋必要脱敏截图。不要发backend/data、.env、node_modules、venv、完整个人目录。若返回前又改代码，先真实提交，再生成新文件并更新SHA。

原作者集成建议（**收到后审核，不由队友直接推原远端**）：

```powershell
# 原作者工作区必须先核对状态并保存现有工作
# incoming文件请用实际路径，先核对发送方SHA和扫描历史
git bundle verify '收到的teammate-return.bundle'
git fetch '收到的teammate-return.bundle' refs/heads/codex/teammate-ui:refs/remotes/handoff/teammate-ui
git log --oneline codex/ai-assisted-verification..refs/remotes/handoff/teammate-ui
git diff codex/ai-assisted-verification...refs/remotes/handoff/teammate-ui
# 原作者若未推进且审核通过可fast-forward；如已分叉，正常merge并解决冲突
# 不执行reset --hard、force push或全历史压缩
```

不要盲目覆盖作者源码；bundle保留共同祖先，适合审核和正常合并。原作者按既有授权敏感检查后普通推送原开发分支，main和仓库私有性保持。

## 校验和故障

- ZIP旁的.sha256用于传输完整性；MANIFEST包含包内每个其他文件的大小/哈希，manifest自身由ZIP校验覆盖。这不是数字签名或第三方安全认证。
- Verify脚本在解压后、创建workspace或安装依赖前执行；之后出现新文件属于预期，严格清单会报额外文件。
- bundle verify应说明完整历史、无前置提交；离线克隆HEAD必须与manifest一致，git fsck应通过。
- 缺锁文件、git clone错误、npm/pip安装失败先记录原因，不换旧Python、不清原库、不去别的项目复制凭据。
- 模型未配置可做页面/手动业务；如后续明确要真实AI，另行设置自己的百炼API并约定请求预算。回看/截图不应产生新调用。
