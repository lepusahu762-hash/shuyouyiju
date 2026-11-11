# 数有依据 v0.4 · 真实统计、证据定位、单条数字核验

日期：2026-11-12（Asia/Shanghai）。本轮直接开发原仓库 `D:\Desktop\chuanzhibei\shuyouyiju`，沿用 React + TypeScript + Vite、FastAPI、SQLite 和 Python 3.13.11 项目虚拟环境。未创建替代项目。启动前 Git 工作区干净，起始提交为 `d10232f`；已读取 README、WORKSPACE_PREVIEW、产品 MD、相关代码及近期提交。仓库与适用父目录没有找到 AGENTS.md。

## 打开预览

- 首页：<http://127.0.0.1:5173/>
- 注册／登录：<http://127.0.0.1:5173/auth>
- 工作空间：<http://127.0.0.1:5173/app>
- 在任一已有项目的资料页顶部点“计算与证据”，进入 `/app/projects/:projectId/calculations`。
- API：<http://127.0.0.1:8000/api/health>；当前版本 0.4.0。

前后端已实际运行。使用自己的测试账户即可演示；测试账户不写入文档或 Git。项目启动命令未变，完整 Windows PowerShell 操作见 [README](README.md)。没有新依赖，无需重装现有前端或虚拟环境。

```powershell
# 终端一
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\backend'
& '.\.venv\Scripts\python.exe' -m uvicorn app.main:app --host 127.0.0.1 --port 8000
# 终端二
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\frontend'
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

默认本机单个后台进程；保留 `backend/data`，重启会继续使用同一数据库。启动仅新增三张表，原有账户、项目、上传文件不重置；本次升级前后均核对既有 5 个账户仍保留。升级前 SQLite backup 已保存到忽略的 `artifacts/calculation-v04/before-v04.sqlite3`。

## 演示材料和顺序

独立合成材料实际位于：

- [200 条 CSV](artifacts/calculation-demo/合成测试_200条记录.csv)
- [200 条 XLSX](artifacts/calculation-demo/合成测试_200条记录.xlsx)
- [两条百分比结论 DOCX](artifacts/calculation-demo/合成测试_数字结论.docx)
- [合成资料说明](artifacts/calculation-demo/README.txt)

这些是测试材料，不是真实调查；生成器与产品统计代码完全独立。可在根目录重新生成：

```powershell
& '.\backend\.venv\Scripts\python.exe' backend/scripts/make_calculation_demo.py
```

1. 注册或登录，创建／打开项目。先在资料页上传 CSV（也可 XLSX）和 DOCX，等两份资料解析完成。先上传报告可避免后补资料使旧运行失效。
2. 点顶部“计算与证据”。选择表格；CSV 选“CSV 数据”，XLSX 选“合成记录”。计算操作选比例，指标名称自填“有效记录中的满意记录占比”。范围说明写明有效记录、记录／行、不去重。
3. 添加范围条件：字段 B“记录状态”，文本完全相等，值“有效”。添加分子条件：字段 C“反馈选项”，文本完全相等，值“满意”。两组都支持继续添加“并且”条件。
4. 空值处理明确选“保留”；精度选 0 位；勾选确认，运行并保存。后台处理完整 200 条记录，纳入 180、排除 20、分子 144，显示 144÷180×100%=80%。无效记录中另外 20 条也写为满意，用于验证不会被错误计入分子。
5. 在证据区切换“分母”“分子”“排除”“未匹配”等分组，翻页、点击源行。可查看保存行 ID、字段和值、纳入原因，并跳到资料页相应分页高亮原行。展开结果的来源详情可看公式、精确分数、未舍入值、精度、SHA-256、规则和方法版本。
6. 在单条数字核验区选 DOCX 的 P2（72%），输入 72，确认 0 位精度、指标与范围对应，点核验保存。结果为“存在差异”，计算 80% − 报告 72% = **8 个百分点**。
7. 换为 P3（80%），输入 80，重新勾选确认再保存，显示“与数据一致”。前一次 72% 核验独立保留，原文不被改写。
8. 刷新页面，计算、核验和历史仍可查看。到资料页修改并保存项目统计口径，返回／重新载入计算区：旧结果保留，标“待重新计算／复核”。载入旧条件、重新确认运行，会新增一条结果，再重新核验。

切换“按条件统计记录数”可得到符合条件的 144 条记录。这个示例统计的是行，不是对“人数”字段求和；自行上传不同字段名的数据也使用同一引擎。

## 实际完成的能力

- 明确字段／值／类型的等值条件，组内 AND；只提供记录计数和比例，分子始终来自分母范围。
- 后台对完整已解析工作表计算；非预览页汇总，不执行原表公式或任意代码，不去重、不改写原件。
- 三种明确空值策略：排除、保留、遇空值暂停。结果展示总记录、纳入、排除、分子及未匹配和空值原因。必要口径未确认时阻止计算，字段失效返回明确错误；零分母没有正常百分比。
- 保存精确分数、80 位有效数字的十进制展开和确认的显示精度。ROUND_HALF_UP 四舍五入后严格相等比较，不使用容差；百分比差值单位为百分点。
- 人工选报告段落与原文百分比。状态覆盖一致、差异、证据不足、需要确认、资料／口径变化待复核；人工确认不等于通过。
- SQLite 独立保存运行、行快照、报告核验。指纹、原文件 SHA、来源 ID、字段和口径版本、计算方法 `record-equality-v1`、时间及报告原文都可追溯。
- 分页证据默认 25、最多 100 条；报告选择每组 20 段；工作区历史和核验每组 10 条。不会将全表一次渲染到浏览器。
- 所有新 API 均校验当前账户的项目归属。运行不可覆盖，核验只新增。旧记录不会套用新口径重新解释。

## 失效与能力边界

当前采用保守失效规则：项目口径、字段说明、资料集合、解析内容或相关报告变化，旧运行及其核验都标待重新计算／复核。新增一份无关资料也可能触发失效，用户重新确认后运行；不猜测依赖关系。资料替换关系和完整历史版本体系尚未开发；本轮保存的旧行与旧报告快照足以复核当时结果。

报告值只支持 0–100 的阿拉伯数字加 %／％，需在选定原文里存在相同值。不会从整段中自动选择目标、自动理解中文数字、判断范围含义或确认指标；这些都由用户确认。负百分比不会误认为正值。十进制循环展开不可能有限保存，精确分数始终为权威值。

AI、大模型、RAG、Agent、规则检索、自动整篇核验、复杂公式、求和／均值／增长率／去重、PDF/OCR、邮件、报告自动改写、完整版本管理及导出均未实现。没有公网部署，也未执行高并发、跨浏览器矩阵或极限规模性能测试。原首页未重做。

## 验收结果

| 检查 | 实际执行结果 |
| --- | --- |
| 前端 TypeScript + Vite 构建 | 通过；JS gzip 99.50 kB，CSS gzip 16.53 kB |
| 前端 lint | 通过，无警告或错误 |
| 后台计算测试 | 新增 5 项通过；覆盖全量数据、证据集合、精度、异常、快照、隔离与符号边界 |
| 原有账户／资料测试 | 原有 5 项通过；复用原测试验证注册登录、项目和上传等基础能力 |
| 最终后台完整相关测试 | 10 项通过，1 条依赖弃用警告 |
| 浏览器主流程 | 32 项断言通过 |
| 真实后台重启后复核与手机操作 | 9 项断言通过 |
| 生产构建预览 | 4 项断言通过；API 会话、390／1440px 深层路由刷新和证据加载 |
| 来源跳转补查 | 3 项断言通过；390／1440px 资料页正确翻页、滚动并高亮第 127 源行 |
| 390／768／1440 px | 页面宽度无横向溢出，证据表在自身区域滚动；已实际截图查看桌面和手机 |

后台测试有 1 条依赖警告：Starlette TestClient 对当前 httpx 集成发出弃用提醒；没有测试失败。最初运行受 Windows 遗留 pytest 临时目录 ACL 影响，后指定仓库忽略目录中的全新 `--basetemp` 正常完成；未修改旧目录权限。

实际检查内容包括：200 条全表与 25 条证据分页互不影响；144 分子来源全部包含于 180 分母，排除 20、分母内未匹配 36；72% 差异 8 个百分点，80% 一致；3.125% 显示 3.13% 而不容忍成 3.12%；1/3 保存精确分数；空值三策略、零分母、缺失字段和无效条件；规则／资料变更后旧快照不变；另一账户不能读取结果、证据、历史或新增核验；接口不可用时保留输入且不提示保存成功。

实际停止 Uvicorn 27760、用同一 data 目录启动 32696，验证会话、计算、核验、原文、分页证据和原文件字节保留；最后以 16976 进程运行最新代码。390px 手机还实际执行了证据切换、原行定位以及 72% 核验保存，非只测量页面宽度。浏览器为 Chrome 157.0.8103.40，没有 JavaScript 运行时错误。

检查脚本：`frontend/scripts/check-calculations.cjs`。`seed` 创建新的合成测试账户、项目并验证主流程；同目录重启后台后运行 `restart` 验证恢复与手机操作。可设置 `PREVIEW_URL=http://127.0.0.1:4173` 后运行 `production` 只读检查生产预览。不删除或改动其他账户。输出、测试会话、数据库、原件与日志不提交 Git。最终后台 10 项完整相关测试通过，输出保存在本地 `backend-tests.txt`。

## 截图和输出

- [桌面工作区首屏](artifacts/calculation-v04/overview-desktop.png)
- [桌面完整流程](artifacts/calculation-v04/recalculated-desktop.png)
- [桌面 80% 结果](artifacts/calculation-v04/result-desktop.png)
- [桌面分页证据与定位](artifacts/calculation-v04/evidence-desktop.png)
- [桌面 72% 差异](artifacts/calculation-v04/difference-desktop.png)
- [390px 手机完整流程](artifacts/calculation-v04/recalculated-mobile.png)
- [手机计算结果](artifacts/calculation-v04/result-mobile.png)
- [手机单条核验差异](artifacts/calculation-v04/difference-mobile.png)
- [零分母状态](artifacts/calculation-v04/zero-denominator-desktop.png)
- [旧口径待复核状态](artifacts/calculation-v04/stale-desktop.png)
- [32 项主流程结果](artifacts/calculation-v04/seed-checks.json)
- [9 项重启与手机结果](artifacts/calculation-v04/restart-checks.json)
- [实际进程重启记录](artifacts/calculation-v04/restart-evidence.json)
- [4 项生产预览结果](artifacts/calculation-v04/production-checks.json)
- [3 项原资料定位结果](artifacts/calculation-v04/source-checks.json)
- [后台 10 项测试输出](artifacts/calculation-v04/backend-tests.txt)、[前端构建](artifacts/calculation-v04/frontend-build.txt)、[lint](artifacts/calculation-v04/frontend-lint.txt)

## 本地提交

- `611c1df`：后台计算、精确结果、证据快照和单条核验。
- `bf9f407`：一个计算工作区、分页定位、报告比较与浏览器验收脚本。
- `5135f08`：原文百分比符号与严格精度边界修正、测试。
- 文档及最终验收另存本地 docs 提交。未推送远端，使用命令级 `Codex <codex@local.invalid>` 提交身份，未改全局配置。
