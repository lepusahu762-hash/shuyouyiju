# 新机器运行与复现（Windows PowerShell）

源码不包含开发者数据库、密钥、账户或演示历史。使用自己的测试账户和合成资料。不要向聊天粘贴API Key；不要从开发机复制data作为必需依赖。

包内的MANIFEST.json和VALIDATION.md记载该交接基线及本轮恢复/运行验证；下方“本轮”隔离记录是v0.15历史，不能代表队友电脑已验收。离线交付不含依赖安装器/缓存，首次安装通常需要网络。

## 已验证版本与依赖来源

本机/隔离安装使用Python **3.13.11**、Node **24.22.2**、npm **11.19.1**。电脑默认Python3.8不适用；通过`py -0p`确认后显式选择3.13。安装包来自Python/Node官方发行版。当前项目锁定FastAPI0.162.4、fastapi-users15.0.5、SQLAlchemy2.0.57、aiosqlite0.22.1、openpyxl3.1.5、python-docx1.2.0、Pillow13.0.0、ReportLab4.5.1、pypdf6.21.4、PyMuPDF1.28.2；完整锁见`backend/requirements.txt`。前端锁定React19.3.1、TypeScript7.0.2、Vite8.3.7，安装使用`frontend/package-lock.json`和`npm ci`，不要只按package.json范围重新解析。

v0.15历史记录：曾在忽略的隔离目录仅复制源码（无.env/data/.venv/node_modules），新建venv、联网执行完整pip安装和npm ci、生产构建通过；当时隔离服务启动动作被自动审批拒绝，未验证该副本的网页登录全流程。**本次离线交接的最新验证请以包根VALIDATION.md为准；同一台Windows上的干净验证仍不代表队友电脑或Linux已验收。** 团队应在另一台机器照下列步骤检查。

## 获取源码：离线包或GitHub二选一

**没有GitHub账号优先用离线包**：按包根START_HERE及[离线协作](docs/OFFLINE_HANDOFF.md)从history/shuyouyiju.bundle恢复workspace。安装Git本身不要求GitHub账户；恢复完整历史后直接进入下面的共用依赖安装。不要另行GitHub登录，不复制作者.git配置或数据库。

如果已有合法仓库读取权限，也可用下方GitHub获取方式：

先取得私有仓库的合法读取权限；私有仓库推送不等于评委已获权限。本轮未邀请评委、未改可见性。克隆原开发分支后，进入实际克隆目录：

```powershell
git clone --branch codex/ai-assisted-verification https://github.com/lepusahu762-hash/shuyouyiju.git
Set-Location .\shuyouyiju
```

## 依赖安装（共用步骤）

在已恢复/获取的仓库根运行，GitHub克隆者和bundle接收者相同。建议放在短路径如`D:/Projects/shuyouyiju`，避免Windows路径过长。

```powershell
py -0p
py -3.13 -m venv backend/.venv
& .\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
Set-Location frontend
npm ci
npm run build
npm run lint
Set-Location ..
if (-not (Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
```

Copy-Item只用于**新克隆没有.env时**。已配置机器不要覆盖原.env。数据目录默认独立位于这个克隆的`backend/data`，首次启动自动建表。`.venv`不能从别的机器直接拷贝。

终端一启动后台：

```powershell
Set-Location '你的克隆目录\shuyouyiju\backend'
& .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

终端二运行生产预览：

```powershell
Set-Location '你的克隆目录\shuyouyiju\frontend'
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
# 开发时可以改用 npm run dev -- --host 127.0.0.1 --port 5173
```

浏览器访问http://127.0.0.1:4173/，注册自己的测试账户。前端默认代理/api到127.0.0.1:8000；两终端持续运行。端口占用先识别原进程，不要结束其他项目服务；改端口时同时核对Vite代理SYJ_API_TARGET和后台SYJ_ALLOWED_ORIGINS，不在前端写密钥。默认cookie用于本机HTTP，不是公网部署配置。

## 已安装依赖后的便捷启动

在仓库根，使用本项目已安装好依赖的 Python 环境执行：

```powershell
& '你的虚拟环境\Scripts\python.exe' tools/start_local.py --node '你的Node路径\node.exe'
# 只检查/启动服务，不打开浏览器时加 --no-browser
```

此脚本启动本仓库的 FastAPI（8000）和 Vite 开发前端（5173），然后打开
http://127.0.0.1:5173/。服务只监听本机，Windows 下后台运行；关机后需重新启动。
脚本复用已响应的数有依据服务，遇到其他占用不会结束进程；日志在
`artifacts/local-server/*-launcher.log`。它不下载依赖、不修改数据库、不配置模型。
如果旧虚拟环境因 Windows 路径过长安装失败，可在短路径新建环境并按锁安装，
再用那个环境的 Python 启动；不要直接搬动已有 venv。

## 合成资料与中文字体

```powershell
# 在仓库根目录执行，不调用AI、不操作数据库
& .\backend\.venv\Scripts\python.exe backend/scripts/make_unified_demo.py
# 图片生成若未找到中文字体，可显式指定：
& .\backend\.venv\Scripts\python.exe backend/scripts/make_unified_demo.py --font 'C:/Windows/Fonts/msyh.ttc'
```

默认生成到`artifacts/unified-demo-fixtures`。CSV和XLSX是替代关系。PDF另需可嵌入中文TrueType字体，Windows默认SimSun；失败时在本地.env设置`SYJ_PDF_FONT_PATH`为实际字体文件并重启，不提交字体版权不明的文件。其他平台可参考.env.example中的WenQuanYi路径，但未在本轮Linux实测。

之后按[DEMO_GUIDE.md](DEMO_GUIDE.md)从网页上传、指定规则、逐项确认，不运行数据库种子程序冒充独立上手。新机器没有本机GUID对应任务，须建立自己的记录。

## 模型配置与未配置能力

本地`backend/.env`填写`SYJ_AI_API_KEY`、`SYJ_AI_BASE_URL`、`SYJ_AI_MODEL`和`SYJ_AI_REGION`。在阿里云百炼控制台选择北京地域，开通网站后台适用的模型API，查看同地域工作空间端点、API Key权限、模型权限和按量计费余额；不是Coding Plan订阅。当前已验收模型qwen3.7-plus、cn-beijing，地址用控制台对应的HTTPS compatible-mode/v1端点；不擅自切换模型或地域。保存后重启后台；“配置已读取”不等于真实请求成功。

无密钥仍可注册、管理项目、上传解析、编辑和确认规则、手动计数/比例及数字比较、手动来源关联、修订/确定性复核和PDF。自然语言方案、文字候选提取和图片识别会明确提示AI不可用，不能伪装接通。新机器没有已保存核验时，应先按手动流程建立真实来源核验再修订。

模型会收到必要片段/字段目录/规则，图片识别会发送所选区域；不是全部本地处理。新机器如要真实复现，团队需配置自己的权限与费用预算。不要反复执行付费脚本来截图。

## 自动化脚本边界

前端日常运行不依赖Playwright。可选自动化需要另行安装Playwright及Chromium（例如`npm exec --package=playwright -- playwright install chromium`，并确保Node可以解析playwright；临时包缓存不会自动成为require搜索路径）。最直接方式是在外部QA目录安装playwright，再将`PLAYWRIGHT_MODULE_PATH`设为其绝对模块路径。也可在克隆本地`npm install --no-save --package-lock=false playwright`后安装Chromium；不要因此提交锁或依赖变化。

本轮`browser-runtime.cjs`默认使用Playwright安装浏览器，显式`BROWSER_EXECUTABLE`可覆盖，不硬编码开发电脑。`check-material-race.cjs`需生产预览4173（单次挂载）；开发StrictMode双挂载不适用它的延迟次数脚本。此脚本创建独立合成账户，真实写入但0模型请求。

`prepare-unified-demo.cjs setup`从空账户开始，经网页保存所有规则；后续stage见代码，每个付费stage应先检查本地state和统一账本。默认输出忽略目录，不携带私人session。`replay-unified-demo.cjs`需要**自己先建立**的本地state/session，只读并阻止所有写操作，不能当克隆即用的无准备测试。

旧`check-ai-live.cjs`、`check-images.cjs`、`check-revisions.cjs`、`check-experience-*.cjs`等属于开发者回归：有的默认绝对Chrome路径，有的依赖本机忽略目录历史/会话或接口造数据。本轮没有批量改写它们，也不把它们列为评委一键验收步骤。可用显式环境变量的脚本先读头部，纯硬编码脚本需由开发者适配后运行；不要复制私人会话来绕过登录。

离线检查在backend工作目录运行：

```powershell
# 在仓库根先创建忽略的测试输出目录；干净克隆中该目录原本不存在
New-Item -ItemType Directory -Force artifacts | Out-Null
Set-Location backend
& .\.venv\Scripts\python.exe -m pytest tests/test_unified_demo.py tests/test_materials.py tests/test_images.py -q --basetemp=../artifacts/fresh-pytest
Set-Location ../frontend
node scripts/test-api.cjs
node scripts/test-write-refresh.cjs
npm run build
npm run lint
```

Python测试从仓库根运行但没设置app搜索路径会收集失败；上面明确进入backend。Node原生导入TS测试需本次验证的Node24。安装失败先记录包名、版本和网络错误，不换用旧Python或清理原库。
