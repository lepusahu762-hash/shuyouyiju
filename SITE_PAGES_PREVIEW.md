# 全站页面与导航交付 · 2026-11-12

> 当前v0.14全站能力以 [RELEASE_READINESS.md](RELEASE_READINESS.md) 为准，体验/性能/截图见 [EXPERIENCE_PREVIEW.md](EXPERIENCE_PREVIEW.md)。单条修订、确定性复核及单条PDF现均已接通；下文为当时框架交付的历史状态，不覆盖现有功能。

本轮在原目录 `D:\Desktop\chuanzhibei\shuyouyiju`、原分支 `codex/ai-assisted-verification`、基线 `dbb9ac1` 上继续开发。完整阅读 `docs/shuyouyiju_product_spec_v1.md`，沿用现有 React / TypeScript / Vite、FastAPI 接口与 SQLite 数据。仓库及 D 盘祖先目录没有找到 AGENTS.md；没有重新初始化前后端、修改模型配置或清理运行数据。

**全站11个业务页面的界面框架已完成，不代表八项业务能力全部完成。** 本轮仅补页面、导航、布局与状态；新增真实模型请求 **0次**。截图回看上一轮已保存的真实合成任务，截图中的模型请求4/6为该历史任务原记录，不是本轮新调用。

## 打开预览

- 首页：<http://127.0.0.1:5173/>
- 案例体验：<http://127.0.0.1:5173/cases>
- 使用帮助：<http://127.0.0.1:5173/guide>
- 工作空间：<http://127.0.0.1:5173/app>
- 后台健康检查：<http://127.0.0.1:8000/api/health>

本轮复用正在运行的前后端。关闭后，分别在两个 PowerShell 终端启动：

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\backend'
& '.\.venv\Scripts\python.exe' -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\frontend'
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

请用现有账户登录；原项目、资料和结果仍在原账户内。登录后打开已有项目即可沿四个页签浏览。本机上一轮合成演示账户说明保存在忽略路径 `artifacts/rule-constraints-v06/live/演示账户.txt`，不要提交或分享其中凭据。新环境依赖安装与后台环境变量仍按 [README.md](README.md) 和 [backend/README.md](backend/README.md) 操作。

## 11页逐页清单

`:id` 为当前账户所属项目ID。认证页登录与注册是同一业务页的两种状态。

| 页面 | 路由 | 已接通真实功能 | 本轮新增界面 | 尚未接通 |
| --- | --- | --- | --- | --- |
| 品牌首页 | `/` | 既有合成示例交互、锚点、认证入口 | 案例页、帮助页入口及页脚导航 | 首页示例不调用真实服务，修订互动仍为合成预览 |
| 案例体验 | `/cases` | 可切换四类合成案例、展开流程、进入首页示例 | 独立案例选择与资料/能力边界摘要 | 演示项目副本、访客工作区、示例文件下载包 |
| 登录注册 | `/auth`、`/auth?mode=register` | 真实邮箱密码认证、校验、退出、合法任务返回目标 | 返回目标兼容全部新私有路由及合法来源参数 | 邮件验证、找回密码、第三方认证 |
| 我的工作空间 | `/app` | 真实项目创建、搜索、重命名、资料数和时间、打开项目 | 统一侧栏、手机导航、更新真实能力说明 | 置顶、复制、归档、回收站、项目统计扩展 |
| 资料与口径 | `/app/projects/:id/materials` | CSV/XLSX/DOCX上传、解析、分页、来源定位、文本保存、字段说明、项目口径 | 数据体检名称、规则资料指定与当前规则快照摘要、四页签 | 图片/PDF/OCR、自动清洗、完整文件版本管理 |
| 数据分析 | `/app/projects/:id/analysis` | 既有手动计数/比例、等值AND筛选、确认口径、确定性结果、原始行、单条手动比较和历史 | 真实保存结果的分子/分母条形展示、提问区域预览、统一页签 | 对话分析、分组/趋势/任意新计算、图形筛选联动、收藏 |
| 结论核验 | `/app/projects/:id/verify` | 既有AI辅助单条百分比、规则检索、规则快照/冲突阻断、确认计算、证据页签、任务恢复 | 报告/事项/证据三栏，选中原句与来源快照、明确核验范围、图像核验边界 | 整篇批量核验、图像/图表识别、新核验类型 |
| 修改与交付 | `/app/projects/:id/review` | 只读当前报告分页与已有真实计算历史/证据链接 | 原稿/修订稿对照、修改依据、版本/复核与导出区域、可切换报告 | 修订编辑/保存、接受/撤回、修订后复核、版本差异、文件导出；相关按钮禁用 |
| 模板中心 | `/app/templates` | 本页结构预览筛选、搜索、展开目录 | 三类模板结构卡与禁用套用入口 | 服务端模板、套用、收藏、个人副本、保存/编辑 |
| 个人空间 | `/app/me` | 真实账户邮箱/验证状态、账户退出；本机减少动效偏好 | 账户、收藏、导出、偏好、隐私的可切换区域 | 昵称头像编辑、收藏、导出记录、数据管理/删除、偏好跨设备同步 |
| 使用帮助 | `/guide` | 可切换上手、边界、隐私、验证记录与说明内容 | 独立帮助布局及工作空间入口 | 未开展的用户研究/准确率不展示为实际结果 |

旧地址 `/app/projects/:id/calculations?run=...` 和 `/app/projects/:id/ai-verification?task=...` 继续由原组件处理。新的 `/analysis?run=...`、`/verify?task=...` 使用同一数据和接口，没有第二套计算或历史系统。登录返回白名单保留合法 `run`、`task`、资料、段落、行号、分页和历史锚点；不接受站外地址。

## 导航与八项能力

侧栏主入口为工作空间、模板中心、案例体验；个人空间与帮助位于次要位置。手机导航保持可见。项目展示真实名称、目标和四个页签：资料与口径 / 数据分析 / 结论核验 / 修改与交付。历史与版本公共入口复用原计算历史，AI最近任务仍从原恢复入口打开，版本差异标为未实现。

| 能力 | 位置与当前边界 |
| --- | --- |
| 数据体检 | 资料与口径：已接通空值/表头等现有明确检查，不自动清洗 |
| 统计规则与依据库 | 资料与口径：指定真实规则资料、查看当前快照；逐项规则确认/冲突对照复用核验流程 |
| 对话式分析 | 数据分析：提问布局预览，输入与提交禁用 |
| 交互图表 | 数据分析：展示真实运行的记录构成；图形筛选、切换和新计算未接通 |
| 报告与图表核验 | 结论核验：报告单条百分比已接通，图像核验明确未接通 |
| 修改复核 | 修改与交付：只读原稿和依据，修改/复核动作禁用 |
| 成果导出 | 修改与交付：区域和禁用按钮，未生成导出文件 |
| 历史与版本 | 项目公共入口：真实计算与核验快照可看，完整版本对比未接通 |

所有预览卡片、模板结构及公共案例均明确标为示例或界面预览，不计入真实项目。没有虚构保存、核验通过、导出、个人统计或模型记录。资料指定复用既有后台归属检查；规则变化继续按原保守策略使旧结果待复核。

## 实际验收

- 前端 `npm run build`：通过，TypeScript与Vite生产构建完成。
- 前端 `npm run lint`：通过，无错误或警告。
- 项目虚拟环境运行 `test_calculations.py`、`test_rule_constraints.py`、`test_accounts.py`：**12项通过**。覆盖账户/会话、手动完整数据计算、证据、失效、冲突阻断、历史兼容与隔离。1条既有 Starlette/httpx TestClient 弃用提示。
- Chrome浏览器脚本 `check-site-pages.cjs`：**100项检查通过**。真实后端/现有合成账户，检查公开页面、私有保护、合法返回目标、33组页面/尺寸组合、全部私有页直接进入与刷新、四页签实际点击、手机首页菜单、模板筛选/展开、个人导出空状态、禁用交付动作、旧运行/任务地址、报告/规则/原行定位、规则库真实读取。
- **1440 / 768 / 390px**：检测无页面级横向溢出；表格在自身区域滚动。实际查看桌面核验三栏、平板原稿/修订稿重排、手机顶部与核验证据、资料与规则、模板和公共页面截图。未见主要文字或按钮重叠。
- 页面回看没有写接口请求，没有前端运行时异常。逐项对比历史任务payload、规则快照、trace、结果和模型请求数，保持不变。没有为截图重新调用模型。
- 复用原后台与原数据；本轮未重启后台、未做新的真实模型联调、未重新全量走注册上传链路、未做公网部署或完整浏览器矩阵测试。本轮没有改变相关后台；既有流程的接口回归与历史回看分别如上。

复现命令（最后一个变量仅用于回看本机已存在的合成任务；文件包含本机验收状态，不能提交）：

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\frontend'
$env:PLAYWRIGHT_MODULE_PATH = 'C:\Users\LENOVO\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'
$env:BROWSER_EXECUTABLE = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:QA_SITE_SAVED_RUN = 'D:\Desktop\chuanzhibei\shuyouyiju\artifacts\rule-constraints-v06\live\browser-run.json'
npm run check:site-pages
```

不设置 `QA_SITE_SAVED_RUN` 时只运行公共页面和未登录保护检查。脚本禁止页面写请求，不执行模型提取、规划、确认或计算。

## 截图与本机证据

截图均为现有合成验收账户，不含用户真实上传原件。本地文件在忽略目录 `artifacts/site-pages/`，不随Git同步：

- [完整首页](artifacts/site-pages/homepage-1440.png)、[案例桌面](artifacts/site-pages/cases-1440.png)、[案例手机](artifacts/site-pages/cases-390.png)、[帮助](artifacts/site-pages/guide-1440.png)、[认证手机](artifacts/site-pages/auth-390.png)
- [工作空间桌面](artifacts/site-pages/workspace-1440.png)、[手机](artifacts/site-pages/workspace-390.png)
- [资料桌面](artifacts/site-pages/materials-1440.png)、[平板](artifacts/site-pages/materials-768.png)、[手机](artifacts/site-pages/materials-390.png)
- [数据分析桌面](artifacts/site-pages/analysis-1440.png)、[手机](artifacts/site-pages/analysis-390.png)
- [核验三栏桌面](artifacts/site-pages/verify-1440.png)、[平板](artifacts/site-pages/verify-768.png)、[手机顶部](artifacts/site-pages/verify-390-top.png)、[手机结果](artifacts/site-pages/verify-result-390-detail.png)
- [修改与交付桌面](artifacts/site-pages/review-1440.png)、[平板](artifacts/site-pages/review-768.png)、[手机](artifacts/site-pages/review-390.png)
- [模板桌面](artifacts/site-pages/templates-1440.png)、[手机](artifacts/site-pages/templates-390.png)、[个人空间桌面](artifacts/site-pages/personal-1440.png)、[手机](artifacts/site-pages/personal-390.png)
- [100项检查与布局测量](artifacts/site-pages/checks.json)

## Git与同步

保留原开发历史；只提交本轮源码、脚本和说明，不提交密钥、数据库、会话、运行数据或上传原件。目标保持原 `origin/codex/ai-assisted-verification`，不修改main、不强推。推送前已检查140个历史文件对象及当前待提交文件，未发现本机配置密钥与运行文件；通过GitHub元数据核对仓库仍为private，没有改变可见性。最终提交编号及远端一致性以本轮交付回复和 `git log` 为准。
