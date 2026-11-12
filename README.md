# 数有依据 · shuyouyiju

React + TypeScript + Vite 前端，Python + FastAPI 后台。当前 v0.5 保留真实账户、项目、资料、统计计算、证据与历史，新增 AI 辅助单条百分比核验工作区、项目内真实规则检索、人工确认方案和受控模型工具调用。**当前本机缺少模型凭据，真实 AI 尚未接通**；模拟测试不能代表真实调用通过。首页保留原有合成示例。

## 目录

```text
frontend/                  原有前端，继续增量开发
backend/
  app/                     认证、项目、资料 API 和只读解析器
  tests/                   持久化、解析、权限和异常测试
  scripts/make_fixtures.py  浏览器验收用的合成文件生成器
  requirements.in          直接依赖范围
  requirements.txt         本次实际安装的完整锁定版本
  .env.example             后台环境变量示例
  .venv/                   项目虚拟环境（不提交）
  data/                    SQLite + originals 原文件（不提交）
docs/shuyouyiju_product_spec_v1.md
WORKSPACE_PREVIEW.md        v0.3 工作空间历史交付记录
CALCULATION_PREVIEW.md      v0.4 计算、证据、单条核验历史交付
AI_PREVIEW.md               v0.5 接入说明、配置步骤、模拟与真实验收边界
frontend/HOMEPAGE_PREVIEW.md 上轮历史记录
artifacts/                 本地验收截图、结果、日志（不提交）
```

## Windows PowerShell 启动

已在原仓库 `D:\Desktop\chuanzhibei\shuyouyiju` 安装依赖并建立 `backend\.venv`。本机普通 `python` 指向 **Python 3.8.10**，不适合当前依赖；项目虚拟环境基于 `C:\Users\LENOVO\miniconda3\python.exe` 的 **Python 3.13.11**。请明确使用下面的虚拟环境解释器，避免调用系统旧版 Python。

终端一，启动后台：

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\backend'
& '.\.venv\Scripts\python.exe' -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

终端二，启动前端：

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\frontend'
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

- 首页：<http://127.0.0.1:5173/>
- 登录／注册：<http://127.0.0.1:5173/auth>
- 我的工作空间：<http://127.0.0.1:5173/app>
- 后台健康检查：<http://127.0.0.1:8000/api/health>
- API 文档：<http://127.0.0.1:8000/docs>

首次使用请注册自己的测试账户。邮件验证与找回密码未实现，没有邮件发送流程。端口被占用时先检查已有服务；已运行本项目时可以直接打开页面。两个终端使用 Ctrl+C 停止，不删除 `backend/data`，下次启动会继续使用原数据。请统一使用 127.0.0.1 或 localhost，两个主机名的浏览器 Cookie 不共用。

## 新机器安装

使用 Python 3.12/3.13（本次实际验证 3.13.11）及 Vite 8 支持的 Node.js 版本。以下建环境命令仅在 `.venv` 尚不存在时执行；换机器后重新创建，不复制旧虚拟环境。

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\backend'
& 'C:\Users\LENOVO\miniconda3\python.exe' -m venv .venv
& '.\.venv\Scripts\python.exe' -m pip install -r requirements.txt
# 可选：需要覆盖默认配置时复制一次，已有 .env 时先保留原配置。
Copy-Item .env.example .env
Set-Location '..\frontend'
npm ci
```

在其他电脑上，将创建虚拟环境的解释器路径换成当地 Python 3.12/3.13 的完整路径。无需执行 Activate.ps1，因此不依赖 PowerShell 激活脚本策略。

## 数据与认证

- SQLite：`backend/data/shuyouyiju.sqlite3`，存账户、服务器会话、项目、文件元数据、解析结果、字段与统计口径。
- 原件：`backend/data/originals/<资料 UUID>.<扩展名>`，上传后单独保存，SHA-256 记录完整性；预览、检查、字段说明和规则编辑不改写原件。同名上传新增资料。
- FastAPI Users 15.0.5 管理注册、密码校验和会话；密码使用库默认的 Argon2id 安全哈希。会话使用数据库策略和 HttpOnly / SameSite=Lax Cookie，默认 7 天；退出会在服务器撤销令牌。
- 每个项目、文件、预览、下载、重试和保存接口均检查当前用户归属。私有资源越权访问返回 404，未登录返回 401。写接口要求 `X-Requested-With: shuyouyiju`，校验浏览器 Origin；认证入口有本进程限频。
- 前端统一请求同源 `/api`，Vite 开发与预览代理至 `127.0.0.1:8000`。生产托管需同时配置 API 反向代理和 SPA `index.html` 回退，才能直接访问／刷新 `/auth`、`/app` 和项目深层路径。
- 当前按本机、单后台进程运行。HTTPS 环境应设置 `SYJ_COOKIE_SECURE=true` 并配置真实允许来源。当前内置解析任务和启动中断恢复按单进程设计，不要增加多个 Uvicorn worker。
- 备份应停止后台后整体复制 `backend/data`，包含 SQLite 与原件；更改 `SYJ_DATA_DIR` 会切换到另一份数据，不会自动迁移已有项目。

环境变量完整示例见 [backend/.env.example](backend/.env.example)。`.env`、虚拟环境、用户数据与验收输出已被 Git 忽略。

## 本轮能力和限制

v0.4 的“计算与证据”位于 `/app/projects/:projectId/calculations`，从已有项目资料页顶部进入。用户明确选择表格、工作表、字段和等值条件，后台对完整已解析数据计数；多个条件按“并且”组合。支持记录数及分子记录数／分母范围记录数，不执行求和、去重或任意表达式。统计单位是记录／行。

必须确认空值策略与显示精度。结果保存精确分数和未作展示舍入的十进制值，循环小数展开最多 80 位有效数字；展示与核验用 `ROUND_HALF_UP` 十进制四舍五入后严格相等，不使用容差。核验报告需手动选段、输入原文百分比并确认范围、指标和精度。保留原报告内容；不判断整篇报告或因果关系。

每次运行保存独立结果、规则版本、项目资料签名、方法版本、字段信息、原始行快照及报告段落快照。证据按页读取，默认 25 条、最多 100 条；报告选择每页 20 段。修改项目口径、字段说明、资料集合或解析内容后，旧运行及核验保留并显示待重新计算／复核。该阶段采用保守失效策略，补充其他资料也会触发重新确认；不会猜测新资料是否与某个指标无关。

新数据表由启动时自动新增，已有用户、项目、文件不重置；没有修改旧表结构。运行数据仍在 `backend/data/`。升级前建议用 SQLite backup 或停止后台后完整备份该目录；本次已创建本地升级前 SQLite 备份，保留在忽略的 `artifacts/calculation-v04/` 中。

独立合成演示文件生成：

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju'
& '.\backend\.venv\Scripts\python.exe' backend/scripts/make_calculation_demo.py
```

生成到 `artifacts/calculation-demo/`，包含明确标注的 CSV、XLSX、DOCX 和说明：200 条总记录，180 条有效，其中 144 条满意。产品代码不会读取或硬编码这个案例。逐步演示与当前截图见 [CALCULATION_PREVIEW.md](CALCULATION_PREVIEW.md)。

| 材料 | 实际支持 |
| --- | --- |
| CSV | UTF-8/BOM、GB18030、UTF-16 BOM，常见分隔符；失败时可指定编码与分隔符重试；首记录作为表头 |
| XLSX | 工作表选择、列名、数据行数、分页预览；首行作为表头；公式显示原文，不执行计算 |
| DOCX | 正文和正文表格中的非空段落，保留可定位来源标识；不提取图片、文本框、页眉页脚或批注 |
| 粘贴文本 | 原文保存为 UTF-8，每个非空行建立稳定段落标识 |
| 字段与规则 | 字段含义、单位；对象范围、期间、指标定义、异常处理决定、补充说明；真实保存且有并发版本冲突提示 |
| 数据问题 | 空值及坐标、重复／空表头、不齐行、公式等可明确识别的提示；不自动清洗，不评判统计结论 |

默认每份 20 MiB，每项目 20 份，每表 50000 数据行、200 列，每文件 100 万单元格；XLSX 最多 30 个工作表。报告最多 100 万字符／20000 段；粘贴最多 20000 行。限制可在环境变量允许的范围内调整，页面上传限制读取后台真实配置。PDF、图片、XLS 和宏文件未接通。

文件使用 UUID + 内容哈希；表格行列和报告段落使用 `资料ID:v1:来源位置` 标识。新上传文件会产生新资料 ID，重试保留原 ID。本轮没有完整历史版本、原文编辑和版本对比功能。

## 检查命令

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\frontend'
npm run build
npm run lint
Set-Location '..\backend'
& '.\.venv\Scripts\python.exe' -m pytest tests -q
```

v0.4 新增 `tests/test_calculations.py`，覆盖完整数据、证据集合、空值、零分母、条件校验、舍入、原文符号、失效和隔离。v0.5 后台当前共 15 项测试（含5项 AI 流程／协议模拟测试）；依赖 Starlette 对 TestClient 使用 httpx 发出一条弃用警告。前端构建与 lint 通过。本轮 AI 配置与浏览器检查见 [AI_PREVIEW.md](AI_PREVIEW.md)，原计算流程见 [CALCULATION_PREVIEW.md](CALCULATION_PREVIEW.md)；上轮记录保留在 [WORKSPACE_PREVIEW.md](WORKSPACE_PREVIEW.md)。

## 下一阶段

下一阶段需在本地配置百炼账号并完成少量真实调用验收，再考虑扩展统计方法与完整报告核验。修订复核、交付、邮件验证、找回密码、PDF/OCR 和完整版本历史尚未实现。当前 AI 接入代码与模拟验收已完成，真实模型尚未接通；计算与比较仍由确定性后台执行。


## v0.5 AI 辅助单条核验

入口：项目的“资料与口径”或“计算与证据”顶部 → **AI 辅助单条核验**，路由 `/app/projects/:projectId/ai-verification`。原有手动流程继续可用。

先在资料页上传/保存报告和规则，再在 AI 页指定“统计规则资料”。从一个段落提取最多5条候选，选择1条，检索实际规则，检查并修改字段和条件，明确采用的规则及冲突处理后执行。仅支持记录占比，跨期提升/百分点及复杂统计不判为通过。计算、证据与数字比较进入原有运行历史；任务额外保存原文、方案、模型与工具摘要，不另建计算历史系统。

后台通过 `pydantic-settings` 实际读取 `backend/.env` 的 `SYJ_AI_API_KEY`、`SYJ_AI_BASE_URL`、`SYJ_AI_MODEL`、`SYJ_AI_REGION`。密钥仅在后台使用，不进入前端；无配置时页面明确禁用模型调用。支持百炼官方 Chat Completions API，地域地址要与 Key 一致，不使用 Coding Plan／Token Plan 编程订阅接口。每任务最多6次模型请求，失败和重试均计入；默认45秒超时、2500输出 tokens、4次工具调用，不自动切换模型。

本地填写、官方文档、计费、演示资料及截图见 [AI_PREVIEW.md](AI_PREVIEW.md)。生成独立合成资料：

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\backend'
& '.\.venv\Scripts\python.exe' scripts/make_ai_demo.py
```

文件写入仓库 `artifacts/ai-demo`，不会被产品自动装载。常规启动仍用上方两个终端；不要用 `tests/preview_ai.py` 代替真实后台，该模块仅用于清楚标记的模拟浏览器验收，使用独立 `artifacts/ai-browser-data`。生产后台依旧 `app.main:app`，保留 `backend/data` 中原有账户和原件。
