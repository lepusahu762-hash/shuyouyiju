# 数有依据 · shuyouyiju

**队友接手／无GitHub账号：先读 [HANDOFF.md](HANDOFF.md)，离线恢复与交还见 [docs/OFFLINE_HANDOFF.md](docs/OFFLINE_HANDOFF.md)。** 源码包不含作者数据库/密钥，页面优化默认不调用百炼。

## 参赛与团队信息

| 项目 | 内容 |
| --- | --- |
| 作品名称 | 数有依据（shuyouyiju） |
| 参赛方向 | AI 辅助数据分析与单条百分比结论核验 Web 应用；最终赛事/赛道名称以报名表为准 |
| 团队名称 | 深藏blue队 |
| 成员与分工 | 刘炳旭：产品与统计计算；龙秀丽：前端与交互；张逸晨：后端与 AI |
| 学校 | 黑龙江工商学院 |
| 指导老师 | 于洪、霍佳欣 |
| 代码分支 | `codex/ai-assisted-verification`，不要使用旧 `main` |
| 录屏与材料 | [逐步演示](DEMO_GUIDE.md) · [约6分40秒讲解稿](docs/DEMO_SCRIPT.md) · [技术与评分证据](docs/TECHNICAL_EXPLANATION.md) |

以上团队信息由项目负责人提供。私有仓库推送不代表评委已取得访问权限。

## 交卷前快速入口（2026-11-17）

- 首次运行按 [NEW_MACHINE_SETUP.md](NEW_MACHINE_SETUP.md)，安装后使用两个终端启动；已有电脑不覆盖 `.env` 或 `backend/data`。
- 录屏主线：资料与已确认规则 → A50%／B25%／总体40%的分组证据 → 文字50%与40%的差异 → 图片所选50%与40%的差异 → 文字修订40% → 保存待复核 → 确定性复核 → 单条文字PDF。
- 对应点击位置、预填出现条件、历史回看与现场执行的区别见下方[录屏演示步骤](#录屏演示步骤)。本次交卷检查不调用真实模型。
- 最新干净安装、启动、测试与待办记录：[docs/SUBMISSION_CHECK.md](docs/SUBMISSION_CHECK.md)。模板与可恢复项目删除已接通，账户提示清理不改变认证逻辑。

React + TypeScript + Vite 前端，Python + FastAPI 后台、SQLite。原项目持续增量开发，保留真实账户、资料、规则、计算、AI任务、修订和PDF历史。

**v0.15（2026-11-13）：修复写后旧列表，完成同项目统一真实演示。** 已撤回通用GET合并并防止晚旧响应覆盖；该轮7次真实请求含1次图片格式失败，保留失败与人工修改记录。

- [本轮验收与实际截图](UNIFIED_DEMO_PREVIEW.md)
- [统一演示指南与本机保存链接](DEMO_GUIDE.md) · [6分40秒中文讲解稿](docs/DEMO_SCRIPT.md)
- [评分对应技术初稿](docs/TECHNICAL_EXPLANATION.md) · [新机器安装](NEW_MACHINE_SETUP.md) · [空白队友试用表](docs/TEAM_TRIAL_TEMPLATE.md)

**历史v0.14（2026-11-13）：全站体验与视觉打磨、生产资源按需加载和并发GET去重（后者已在v0.15撤回）。** 修复分析提问失败清空输入、320px项目/个人区溢出，规则逐项来源确认分组、技术审计折叠、键盘页签与长原稿阅读优化。11页×关键状态在320/390/768/1440px检查；真实模型新增请求0次。生产包体积减少不等于加载速度全面提升：性能表保留最终时序变慢的结果。

- 当前11页、八项能力、参赛阻断及未实现清单：[RELEASE_READINESS.md](RELEASE_READINESS.md)。全站界面框架完成不代表八项能力全部完成。
- 本轮修复、实际截图、生产测量前后、测试、检查路线和生产预览启动：[EXPERIENCE_PREVIEW.md](EXPERIENCE_PREVIEW.md)。本机生产预览 <http://127.0.0.1:4173/>，开发预览 <http://127.0.0.1:5173/>，均非公网。
- 独立确认统计规则、暂停不排名：[RULE_ONBOARDING_PREVIEW.md](RULE_ONBOARDING_PREVIEW.md)。
- 对话/单字段分组：[ANALYSIS_PREVIEW.md](ANALYSIS_PREVIEW.md)；图片单条核验：[IMAGE_VERIFICATION_PREVIEW.md](IMAGE_VERIFICATION_PREVIEW.md)。
- 单条修订复核：[REVIEW_PREVIEW.md](REVIEW_PREVIEW.md)；单条PDF：[PDF_EXPORT_PREVIEW.md](PDF_EXPORT_PREVIEW.md)；规则检索评测：[RETRIEVAL_PREVIEW.md](RETRIEVAL_PREVIEW.md)。
- 百炼配置与逐轮真实/模拟记录：[AI_PREVIEW.md](AI_PREVIEW.md)。各历史文档的请求次数只属于其轮次，不能相加或当成本轮。

当前真实功能包括个人模板添加/编辑、内置模板另存、套用创建独立项目，以及已确认口径下的记录计数/占比、单字段分组、单条百分比核验、报告文字单条修订/复核和PDF。模板仅复用规则草稿与报告提纲，保存使用时的内容快照；新项目仍需上传资料、指定规则来源并逐项人工确认，编辑模板不会覆盖旧项目。模板说明见[docs/TEMPLATES.md](docs/TEMPLATES.md)。邮件、模板共享/删除/文件导入、已有项目覆盖套用、隔离案例副本、整篇改写、复杂统计及图片PDF等未接通；主页示例不能代表工作区支持任意公式。仓库保持私有，源码推送不代表评委已有访问权；未邀请账号或部署公网。

## 录屏演示步骤

以下是计划录制的操作路线，不代表本轮重新进行了付费 AI 验收，也不代表已检查最终视频文件。全部数字来自明确标注的独立合成资料，统计单位为记录/行，不自动去重。

| 预计时间 | 页面与点击位置 | 展示内容／预期数字 | 推荐方式 |
| --- | --- | --- | --- |
| 0:00–0:40 | 首页 → 工作空间 → 打开自己的统一演示项目 | 产品问题、当前项目及四个页签；说明是合成案例 | 实时导航 |
| 0:40–1:35 | 资料与口径 → 选择CSV → 确认统计规则 | 12条总记录、10条有效、2条空评价仍保留；九项规则及真实来源。已确认则直接看当前有效版本 | 回看已保存规则；新项目需实际确认保存 |
| 1:35–2:30 | 数据分析 → 恢复已保存会话 → 点击B组柱子 → 原始记录／规则来源 | A=3/6=50%，B=1/4=25%，整体=4/10=40%；B组对应源行 | 回看，不再次提交问题 |
| 2:30–3:25 | 结论核验 → 报告文字 → 恢复所选50%任务 | 原句定位、规则引用；计算40%，报告高10个百分点 | 已完成任务直接回看；待确认任务核对右侧“确认并计算”后才执行 |
| 3:25–4:15 | 结论核验 → 图片图表 → 恢复50%标签任务 → 原始数据／规则原文 | 单个满意50%标签定位，计算40%，差10个百分点；识别确认与数字一致分开 | 回看已保存识别和结果，不重新识别 |
| 4:15–5:15 | 文字结果 → 去修订这条原句 → 选定修订版本 → 复核结果 | 原稿50%保留；修订40%保存后先待复核，执行后才一致 | 优先回看版本；现场保存/复核会新增真实记录 |
| 5:15–5:55 | 修改与交付 → 单条PDF记录 → 预览 → 下载此PDF | 选定原句、版本、具体复核；不是整篇报告或图片PDF | 下载已有文件，不重新生成 |
| 5:55–6:40 | 规则与来源详情／技术说明 | 人工确认、受控工具与确定性计算；能力限制 | 说明边界，无模型请求 |

从零准备：注册 → 创建项目 → 一次上传生成器的CSV、DOCX、PNG各一份 → 保存说明/指定规则 → 确认规则 → 建立分析与核验。全部资料完成后再计算，后补资料会使旧依据失效。CSV与XLSX仅选一种，不重复上传同名文件。

- 三份原件与已登记指纹一致时，“确认统计规则”可显示演示预填卡；读取九项和原文后，由用户点击“确认并保存演示口径”。已有有效规则显示已确认状态；不是上传即自动确认。
- 重新生成的DOCX/PNG可能字节不同，未命中指纹时使用手动逐项确认来源，不能关闭指纹或后台规则检查。文字预填仍须匹配原句、有效快照和实际规则引用。
- 新机器不含作者任务或会话；没有模型配置时，可以注册、上传、手动确认规则、手动计数/比例/文字比较和后续修订/PDF，不能生成新的AI分析或图像识别结果。
- 本机旧演示链接只供历史参考。2026-11-17只读检查发现原统一演示与原录屏项目已在“已删除项目”，直接链接返回404；录制前由项目所有者决定从工作空间恢复，或使用当前项目的新链接。未擅自恢复项目。

完整准备、失败恢复及本机历史链接见 [DEMO_GUIDE.md](DEMO_GUIDE.md)，演示预填边界见 [docs/DEMO_PREFILL.md](docs/DEMO_PREFILL.md)。

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
SITE_PAGES_PREVIEW.md       全站框架历史交付
REVIEW_PREVIEW.md           单条修订、版本与确定性复核历史交付
PDF_EXPORT_PREVIEW.md       单条PDF、演示、样例、权限与验收
ANALYSIS_PREVIEW.md         对话、分组、来源、连续方案与本轮真实验收
IMAGE_VERIFICATION_PREVIEW.md 图片核验、真实调用及验收
RETRIEVAL_PREVIEW.md        前轮检索、36题评测及少量真实对照
backend/evaluation/        合成规则、固定分组与逐题结果（不含凭据）
frontend/HOMEPAGE_PREVIEW.md 上轮历史记录
artifacts/                 本地验收截图、结果、日志（不提交）
```

独立规则冲突资料生成：在 `backend` 运行 `& '.\.venv\Scripts\python.exe' scripts/make_rule_conflict_demo.py`，生成到忽略的 `artifacts/rule-conflict-demo`。登录后在原AI核验工作区选择报告段落、指定规则资料，逐项确认规则与来源后检查和确认方案；有冲突时修正方案或明确保存新规则快照，不能勾选知晓绕过。只回看已保存结果不新增模型请求。

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

请按 [NEW_MACHINE_SETUP.md](NEW_MACHINE_SETUP.md) 安装Python3.13、创建本机venv、按锁安装前后端依赖。无GitHub账号可用离线包的完整Git bundle恢复，见 [离线交接](docs/OFFLINE_HANDOFF.md)，无需作者账号或私人数据库。

上方D盘和解释器路径仅为作者已有电脑启动示例，队友使用自己的workspace路径；不要复制作者虚拟环境，不要覆盖已有.env。新电脑默认留空百炼Key，真实页面与手动业务仍可开发。

## 数据与认证

- SQLite：`backend/data/shuyouyiju.sqlite3`，存账户、服务器会话、项目、文件元数据、解析结果、字段与统计口径。
- PDF：`backend/data/exports/<导出 UUID>.pdf`，独立文件及快照；每次读取校验账户归属与SHA256，不通过公开静态目录暴露。备份必须包含此目录。
- 图片预览：`backend/data/image_previews/<资料UUID>.png`，EXIF转正及去除元数据后的独立预览，受保护接口访问；备份时和SQLite、originals、exports一起保存。
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

默认每份 20 MiB，每项目 20 份，每表 50000 数据行、200 列，每文件 100 万单元格；XLSX 最多 30 个工作表。报告最多 100 万字符／20000 段；粘贴最多 20000 行。限制可在环境变量允许的范围内调整，页面上传限制读取后台真实配置。PDF导入、XLS 和宏文件未接通；PNG/JPEG已支持受保护图片核验，限制见图片核验说明。

文件使用 UUID + 内容哈希；表格行列和报告段落使用 `资料ID:v1:来源位置` 标识。新上传文件会产生新资料 ID，重试保留原 ID。本轮没有完整历史版本、原文编辑和版本对比功能。

## 检查命令

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\frontend'
npm run build
npm run lint
Set-Location '..\backend'
& '.\.venv\Scripts\python.exe' -m pytest tests -q
```

v0.4 新增 `tests/test_calculations.py`，覆盖完整数据、证据集合、空值、零分母、条件校验、舍入、原文符号、失效和隔离。v0.5 初次交付的完整15项测试通过；本轮新增适配器与整轮预算测试后，相关11项回归通过（详见 AI_PREVIEW.md）；依赖 Starlette 对 TestClient 使用 httpx 发出一条弃用警告。前端构建与 lint 通过。本轮 AI 配置与浏览器检查见 [AI_PREVIEW.md](AI_PREVIEW.md)，原计算流程见 [CALCULATION_PREVIEW.md](CALCULATION_PREVIEW.md)；上轮记录保留在 [WORKSPACE_PREVIEW.md](WORKSPACE_PREVIEW.md)。

## 下一阶段

单条修订、确定性复核及单条PDF已接通。整篇或批量导出、DOCX/XLSX导出、复杂对话统计、多字段分组、无标签图片估值、图片PDF、邮件验证、找回密码、PDF导入/OCR与完整文件版本比较仍未接通。现有AI单条核验继续由确定性后台计算和比较，关键口径需要用户确认。请按独立开发范围推进，勿将禁用预览入口视为已实现业务。


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


## 本地规则检索评测

不需要模型账号或新服务，使用已有项目虚拟环境：

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju'
& '.\backend\.venv\Scripts\python.exe' backend/scripts/evaluate_retrieval.py --split all --output artifacts/retrieval-recheck.json
```

原关键词方法和改进方案同组配对，详见 [RETRIEVAL_PREVIEW.md](RETRIEVAL_PREVIEW.md)。`compare_retrieval_live.py` 则会产生真实计费，属于显式验收工具，不是离线评测命令；本轮结果已保存，不需重复调用。
