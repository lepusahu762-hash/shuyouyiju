# 数有依据 · 队友开发交接

优先阅读本页即可开始。安装时按 [NEW_MACHINE_SETUP.md](NEW_MACHINE_SETUP.md)；查当前能力用 [RELEASE_READINESS.md](RELEASE_READINESS.md)，准备演示用 [DEMO_GUIDE.md](DEMO_GUIDE.md)。不必每次页面修改都重读全部历史PREVIEW。离线包的最终基线SHA、文件校验和本轮验证在包根`MANIFEST.json`、`VALIDATION.md`，恢复及交还见 [离线协作](docs/OFFLINE_HANDOFF.md)。

## 定位、底座与边界

围绕“一个百分比结论能否按确认规则与原始记录对应”构建可追溯流程。前端React＋TypeScript＋Vite，后端Python＋FastAPI＋SQLite，原件与PDF独立存储。继续在`codex/ai-assisted-verification`开发，不使用旧main重建。

| 当前真实能力 | 关键边界 |
| --- | --- |
| 邮箱密码账户、个人项目、CSV/XLSX/DOCX/文本/PNG/JPEG资料管理 | 测试阶段，无邮件验证、找回密码、第三方登录 |
| 字段说明、统计说明、指定规则资料、本地检索、九项结构化规则快照 | 三种规则状态分开；逐项真实来源/人工确认，后台冲突阻断；检索可能漏召回或误返 |
| 完整表记录计数/比例、等值AND、单字段分组/最高最低/柱状图/源行联动 | 单位记录/行，不自动去重或叫人数；整体空值暂停不排名；无预测/因果/任意公式 |
| AI文字单条、图片明确标签单百分比核验与历史 | AI需队友自己的百炼API权限；只核验一条，不是整篇/整图通过，不按图形大小猜值 |
| 文字单数字修订、不可覆盖版本、确定性重算复核、单条文字PDF | 保存先待复核；改含义转人工；无图片PDF/整篇/批量/DOCX/XLSX导出 |

首页和案例展示是明确标注的示例，不能当成工作区支持任意分析。模板套用、收藏、账户汇总导出、完整文件版本比较、协作和公网部署未接通。全站框架完成不等于八项能力全部完成。

## 页面和主要代码入口

| 页面/入口 | 路由 | 常用文件 |
| --- | --- | --- |
| 首页 | `/` | `frontend/src/pages/HomePage.tsx`、`App.css`、`components/FeatureDemos.tsx` |
| 案例/帮助/模板/个人 | `/cases`、`/guide`、`/app/templates`、`/app/me` | `pages/SitePages.tsx`、`SitePages.css`、`capabilities.ts` |
| 登录/项目 | `/auth`、`/app` | `pages/AuthPage.tsx`、`WorkspacePage.tsx` |
| 资料与口径 | `/app/projects/:id/materials` | `pages/MaterialsPage.tsx`、`components/MaterialEditors.tsx`、`RuleConfirmation.tsx`、`RuleLibrary.tsx` |
| 数据分析 | `/app/projects/:id/analysis` | `components/analysis/`会话/方案/图表/证据组件；手动入口`pages/CalculationsPage.tsx` |
| 结论核验 | `/app/projects/:id/verify` | `pages/AIVerificationPage.tsx`、`components/ImageVerification.tsx`、`AI.css` |
| 修改与交付 | `/app/projects/:id/review` | `pages/ReviewPage.tsx`、`components/PdfExportPanel.tsx`、`Review.css` |

公共外壳/导航：`components/WorkShell.tsx`、`navigation.ts`、`Work.css`；入口/按需加载：`App.tsx`；基础字体：`index.css`；请求与XHR上传：`api.ts`。保留旧`/calculations?run=...`、`/ai-verification?task=...`及所有来源参数。

后台：`auth.py`账户、`materials.py`/`parsers.py`资料、`calculations.py`/`group_calculations.py`计算、`rule_constraints.py`规则快照、`rule_retrieval.py`检索、`analysis.py`对话、`ai.py`文字AI、`image_verification.py`图片、`revisions.py`修订、`exports.py`/`pdf_report.py`导出。模型客户端仅在`ai_provider.py`，配置`config.py`，持久化`models.py`。页面优化通常不需改后台逻辑。

## 运行和配置

1. 无GitHub账号用包内`history/shuyouyiju.bundle`恢复（见包根START_HERE），源码目录可直接看，开发建议用恢复后的Git工作区。**不要在源码快照里git init重造历史。**
2. 实测Python3.13.11、Node24.22.2/npm11.19.1；依赖以`backend/requirements.txt`与`frontend/package-lock.json`锁定。重建自己的venv，不复制原电脑环境。
3. 新电脑从`.env.example`复制自己的`.env`，保留`SYJ_AI_API_KEY=`空。无需共享作者密钥、账户、数据库；注册自己的合成账户。完整PowerShell步骤见NEW_MACHINE_SETUP。
4. 后台在`backend`运行`.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000`；前端在`frontend`运行`npm ci`，`npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`。生产用build＋preview4173。
5. 前端代理/api到8000；不换端口时无需配置。`127.0.0.1`和`localhost`的Cookie不同，保持同一主机名。默认数据是恢复工作区自己的`backend/data`，首次启动自动创建，不含原作者业务数据。

ChatGPT/Codex的订阅不提供本项目百炼API凭据。页面优化、注册/资料/规则、手动统计、来源核验、修订/确定性复核和PDF不需百炼密钥；AI候选提取、自然语言方案、图片识别未配置时明确不可用。本轮交接真实模型调用0次。离线包不含Python/Node安装器或依赖缓存；源码和历史可离线接收，首次依赖安装通常要联网。

## 合成资料与页面开发

在恢复仓库根目录：

```powershell
& .\backend\.venv\Scripts\python.exe backend/scripts/make_unified_demo.py
```

默认生成到`artifacts/unified-demo-fixtures`；包内也提供同一生成器产出的`demo-fixtures`。CSV和XLSX相同，只选一种上传。规则TXT、报告DOCX、PNG均明确合成。总12、有效10（含2空评价保留）、满意4；A3/6=50%、B1/4=25%、总体4/10=40%；报告/图片50%是待核验值。

先一次上传全部需要资料，保存字段和统计说明、粘贴并指定规则，再在资料页逐项确认规则快照。不要为页面截图发起模型。可走手动计算/比较与修订/PDF；如要完整AI路线，需另获真实调用授权和队友自己本地配置。DEMO_GUIDE中的旧UUID/账号路径只对作者电脑有效，新电脑需从空账户建立自己的记录，不会自动拥有作者历史。

## 已知问题与建议优先级

- 优先：在队友电脑完成安装、空账户上手和手机/键盘操作记录；再按页面逐个优化，避免同时重构四工作区。
- 已修复写后旧列表：通用GET合并已撤回；MaterialsPage仅最新序号可更新列表，报告POST/XHR成功使旧读失效。别为去重重新引入晚旧响应覆盖。
- 规则指标/范围说明保守精确比较，近义表述可能需人工对齐；非目标数字的文字改动可能转人工复核；项目级保守失效会让新增资料影响旧结果。
- 检索仍有漏限制/误召回；模型可能格式失败，不能把HTTP200当核验成功。
- 页面按需加载已做，但上一轮性能测量有就绪时间变慢；GET优化撤回后未重测，不声称全面提速。
- 旧浏览器回归脚本部分依赖作者绝对Chrome路径/私有state；新机器先按NEW_MACHINE_SETUP选择可移植脚本。不复制私人session。
- 原机Chrome桌面/390手机已有验收；队友真实设备、Safari/Linux、弱网/大表压测和完整屏幕阅读器覆盖仍未验证。TestClient有既有httpx弃用警告。
- 团队还需计时排练、真实试用记录、赛事格式/渠道核实；本包不是公网部署，也不代表评委有私库权限。

## 修改后的检查与交还

纯样式/布局：前端`npm run build`、`npm run lint`，实际检查涉及页1440/768/390/320、长中文/文件名、错误与空态、键盘/弹窗、表格内部滚动、直接访问刷新和来源链接；表单改动保留失败输入。不是每次都运行全部后台测试。

请求改动额外运行`node scripts/test-api.cjs`、`node scripts/test-write-refresh.cjs`；资料列表涉及XHR时可选生产4173下`check-material-race.cjs`（会创建合成资料，不调用模型）。后台改动在`backend`用项目venv运行对应tests，临时目录设`../artifacts/你的检查名`。账户/规则/来源/修订/导出防线不能为演示绕过。

每个真实模块保留提交，提交前`git diff --check`和`git status --short`，确认没有.env、DB、uploads、PDF、session、node_modules、venv等。队友可用本地Git姓名邮箱（不需GitHub），基于交接分支创建`codex/teammate-ui`；交还Git bundle、提交清单、测试及必要脱敏截图即可，详见 [离线协作与交还](docs/OFFLINE_HANDOFF.md)。不要把整个个人工作区ZIP回传，也不要强推/改main/公开仓库。
