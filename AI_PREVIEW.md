# v0.5 · AI 辅助单条百分比核验

交付日期：2026-11-12。原仓库 `D:\Desktop\chuanzhibei\shuyouyiju`，沿用 React / TypeScript / Vite、FastAPI、SQLite 和 `backend/.venv`（Python 3.13.11）。未重建项目、未修改首页、未删除或迁移原有账户和上传文件。本次检查未发现仓库及已检查父目录中的 AGENTS.md；已读 README、CALCULATION_PREVIEW、产品需求及实际代码。

**当前真实 AI 尚未接通。** 本机没有 `backend/.env`，也未检测到该项目模型环境变量。缺少 API Key、Base URL、模型和地域。真实模型请求 **0 次**，没有付费模型验收。下面明确区分“接入代码／模拟验收完成”和“真实服务尚待验收”。

## 预览与启动

常规前端：[http://127.0.0.1:5173](http://127.0.0.1:5173)。登录 → 我的项目 → 打开项目 → 顶部 **AI 辅助单条核验**。路由为 `/app/projects/:projectId/ai-verification`，登录保护保留合法返回目标。原手动工作区 `/calculations` 继续可用。

PowerShell 终端一：

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\backend'
& '.\.venv\Scripts\python.exe' -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

PowerShell 终端二：

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\frontend'
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

仍使用原 `backend/data`，其中 SQLite 和 `originals` 原件均被 Git 忽略。不要改用机器默认的 Python 3.8.10，不要删除 data 目录。当前为本地单进程服务，不配置多个 uvicorn worker；首版后台任务在进程中执行，重启中断的阶段会保存为失败，并允许在剩余调用额度内显式重试。

## 本地填写百炼配置（无需在聊天中提供密钥）

1. 打开 [阿里云百炼控制台](https://bailian.console.aliyun.com/)，开通**模型 API 服务**。选择实际使用的地域和业务空间，在“API Key”管理创建该地域可用的 Key。菜单位置可能随控制台版本调整，可从官方 [获取 API Key](https://help.aliyun.com/zh/model-studio/get-api-key) 页面进入。不要使用 Coding Plan / Token Plan 编程订阅的专用 Key 或端点为网站后台提供服务。
2. 在同一空间的模型广场／调用示例中核对模型 ID、地域及 Function Calling 支持；查看 [模型调用计费](https://help.aliyun.com/zh/model-studio/model-pricing)，确认账户额度。这里采用网站后台的 Chat Completions API，用量默认按输入、输出 token 计费；价格受模型、地域、输入长度和缓存等影响，不把订阅费用当作 API 调用额度。
3. 在本机创建配置文件。下列命令只在文件不存在时复制，不覆盖已有配置：

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\backend'
if (-not (Test-Path -LiteralPath '.env')) {
    Copy-Item -LiteralPath '.env.example' -Destination '.env'
}
notepad .env
```

在记事本本地填写：

```dotenv
SYJ_AI_API_KEY=在本机填写同地域百炼APIKey
SYJ_AI_BASE_URL=https://你的业务空间ID.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
SYJ_AI_MODEL=qwen-plus
SYJ_AI_REGION=cn-beijing
SYJ_AI_TIMEOUT_SECONDS=45
SYJ_AI_MAX_TOKENS=2500
SYJ_AI_MAX_REQUESTS=6
SYJ_AI_MAX_TOOL_CALLS=4
```

不要原样保留中文占位符。北京地域的旧 `https://dashscope.aliyuncs.com/compatible-mode/v1` 端点当前官方文档仍声明支持，模板使用此地址；优先从控制台复制你的业务空间专属地址。Base URL **不含** `/chat/completions`，后台会补上。地域必须与端点和 Key 相同；模型 ID 来自控制台，不自动升级或切换为其他模型。`qwen-plus` 是官方兼容文档明确列出的工具调用模型示例，实际权限和可用性仍需账户验收。

| 地域配置 | 官方业务空间 Base URL |
| --- | --- |
| `cn-beijing` | `https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` |
| `ap-southeast-1` | `https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1` |
| `us-east-1` | `https://{WorkspaceId}.us-east-1.maas.aliyuncs.com/compatible-mode/v1` |
| `ap-northeast-1` | `https://{WorkspaceId}.ap-northeast-1.maas.aliyuncs.com/compatible-mode/v1` |

4. 保存 `.env`，在后台终端按 Ctrl+C，再执行上方后台启动命令。刷新 AI 页面。出现“模型配置已读取”只表示后台读到了完整配置，**不代表成功调用**。只有本次真实请求完成后，才能确认鉴权、模型和工具调用可用。失败时页面会显示鉴权、限流、超时或格式错误，已完成结果保留。`.env` 不进入 Git，Key 不返回前端、不记入运行快照、不写日志或截图。

本次核对官方文档：2026-11-12，读取了 [OpenAI 兼容 Chat](https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope)、[API Key](https://help.aliyun.com/zh/model-studio/get-api-key)、[模型目录](https://help.aliyun.com/zh/model-studio/models) 和 [模型调用计费](https://help.aliyun.com/zh/model-studio/model-pricing)。兼容文档包含 `tools` / `tool_calls` / `tool_call_id` 和工具响应轮次要求。代码在规则查询后向模型回传真实 tool 结果，并在该轮继续提供工具定义；计算工具返回后使用后台确定性的数字解释结束，不再花费额外模型请求生成数字结论。

## 演示顺序

生成独立、明确标注的合成资料：

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\backend'
& '.\.venv\Scripts\python.exe' scripts/make_ai_demo.py
```

输出在 `artifacts/ai-demo`，产品不会自动装载这些资料。真实模型配置完成后按以下顺序，用少量请求验收：

1. 新建演示项目。上传 `合成测试_200条记录.csv`（或同名 XLSX）、`合成测试_AI报告.docx` 和 `合成测试_统计规则.docx`。也可以将规则 txt 内容粘贴保存为文本；txt 文件直接上传仍不支持。
2. 进入 AI 工作区，展开“指定统计规则资料”，勾选刚上传的统计规则。选择 AI 报告中“满意率为72%”的段落。确认云端发送说明，点击提取候选，并选其中1条。
3. 等待真实规则查询及方案生成。核对表、工作表、分母为有效记录、分子为其中满意记录、保留空值、不去重、0位小数。必要时展开“手动调整”。明确选择采用的规则，解决确认事项，写明依据，勾选规则及整体口径确认后执行。
4. 应得到完整数据 **200 条，总分母180，分子144，80%**。报告72% → **存在差异，计算值−报告值 = 8个百分点**。点原始数据页签查看25行一页的证据和原始行定位；点规则原文定位实际段落。
5. 对80%段落重复，精度与范围一致时应显示“与数据一致”；这只适用于该条数字，不表示整篇报告通过。对“比去年提升8个百分点”应提示需要同口径基期证据，本轮不执行该变化率核验。
6. 刷新，或从“恢复最近的 AI 方案”打开任务；计算结果也可从原有“计算与核验历史”进入。修改规则／资料后旧结果保留并待复核。规则资料角色变化会递增规则版本，移除后再加入也不悄悄恢复旧结果为当前。
7. 新建另一个项目，用 `改名合成测试_200条.csv`，粘贴 `改名合成测试_规则.txt`，复用合成报告。字段和值都不同，应依据真实目录提出映射或具体确认项；不能套用旧字段。

典型正常任务为4次模型请求：提取1、提出规则工具调用1、接收规则并生成方案1、计算工具调用1。缺规则或不支持的陈述会提前结束。失败／重试计入同一个任务最多6次；工具默认最多4次。修改关键口径需重新确认；未变化的已确认方案在失败重试时复用，不重复弹窗。支持的首版计算是等值 AND 条件下的记录占比；记录计数继续由手动工作区提供。

## 已完成的真实能力与限制

- 后台实际从环境读取百炼配置，使用 `httpx` 调用官方 HTTPS Chat Completions API；服务地址、模型和地域均不写死在页面。限定官方兼容端点，检测地域与端点不匹配，拒绝编程订阅端点。适配器无自动重试，不自动切换模型。
- 规则资料角色、中文双字词／关键词真实检索、评分排序、段落位置、内容指纹和快照已实现。不是向量检索；只检索当前有权项目的指定 DOCX／文本，返回最多8条节选。找不到规则不生成通过；多个命中保守要求检查冲突、选择采用依据。
- 模型原文引用和数字均经校验：最多5条，报告原句不可杜撰，百分比／小数／百分点分开。首版仅自动比较 `数字%` 的单条记录占比，小数和跨期变化保守转交确认／手动流程，不伪装为已验证。
- 用户可修改表、工作表、字段、范围／分子等值条件、空值处理与精度。服务器校验引用集合、明确确认、字段存在、数据版本、资源归属。模型计算工具参数只接受已确认方案的指纹，不能自行更换项目、口径或执行 Python／SQL／系统命令。模型输出不是工具就不执行。
- 原有确定性引擎计算全表、保存精确分数、展示舍入值、严格比较。最终数字、差值与状态均由它产生，AI 文本不能改写结果。原件不变。无数据、零分母、未确认口径不能产生正常百分比。
- 新增 `rule_materials`、`ai_tasks` 两个表，不破坏旧表。任务保存原段落、数据及规则上下文、确认方案、模型/地域/地址（不含Key）、提示词版本、工具摘要、实际请求计数、时间和失败状态。模型响应耗时保存在摘要的 `duration_ms`。完成计算与核验仍关联原 `calculation_runs` / `numeric_checks`，共用历史、分页证据及保守失效策略。
- 提取、检索、方案生成、等待确认和执行状态来自真实后台阶段。取消阻止后续工具步骤，保留已完成快照；已发出的请求无法保证服务商停止计费。请求失败可在剩余额度内重试。中断任务在重启后为失败，不显示虚假运行中。
- 云端仅发送选定片段、来源标识、字段说明/少量示例值和检索规则；不发送整份原始文件或所有数据行。单次消息超过6万字符会明确停止并提示精简资料。未宣称全部本地处理。

未实现：真实账号连通验收、完整报告自动核验、复杂统计/分组图表、AI 自动改写、导出、PDF/OCR、邮件功能、RAG向量服务、Agent自治执行或公网部署。没有独立的完整版本管理或持久任务队列。关键词检索可能漏召回；字段映射与语义解释仍须人工检查。

## 验收结果（模拟与真实分开）

| 项目 | 结果 |
| --- | --- |
| 后台测试 | 完整15项通过；后续规则版本/地址校验调整后的相关5项再通过。覆盖账户、资料、原手动计算，以及AI模拟协议、真实规则检索、72/80比较、换列名、缺规则、冲突未确认、假引用、篡改工具、非法JSON、超时/限流、取消、6次上限、持久化、失效和跨账户访问 |
| 前端构建 | `npm run build` 通过 |
| 前端 lint | `npm run lint` 通过，0警告 |
| 浏览器 | Chrome + Playwright，21项通过；1440px桌面、768px平板、390px手机无页面横向溢出，原始数据表自身滚动；追加实测了390px规则选择与展开字段/条件编辑；注册、原资料接口、规则指定、单条72/80、无基期证据、来源高亮、刷新、原历史复用、未配置提示已实测 |
| 进程重启 | 实际重启隔离测试后台后，390px深层页面刷新恢复80%、8个百分点、规则原文快照、确认方案、4次模拟请求计数及过期状态，不增加模型请求 |
| 真实模型验收 | **未执行，0次调用**。缺少本地Key及完整模型配置；72/80/基期不足/换字段这些语义流程尚未由真实模型验证。不能把模拟通过记为真实AI成功 |

已知依赖提示：Starlette TestClient 对使用 httpx 发出1条弃用警告，不影响本次测试。本轮未升级认证或无关依赖。上传文档即使含有指令也不会增加工具权限；测试拒绝修改工具计划和虚构引用。真实模型的工具选择、中文提取效果、服务商取消行为和实际账单仍需配置后的小量验收。

相关检查命令：

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\backend'
$testRun = Join-Path (Resolve-Path '..\artifacts') ('pytest-ai-' + [guid]::NewGuid().ToString())
& '.\.venv\Scripts\python.exe' -m pytest tests -q --basetemp $testRun
Set-Location '..\frontend'
npm run build
npm run lint
```

浏览器模拟服务**仅供开发验收**：`backend/.venv/Scripts/python.exe backend/tests/preview_ai.py`（从项目根目录执行），端口8001，数据在 `artifacts/ai-browser-data`。再从 frontend 用 `$env:SYJ_API_TARGET='http://127.0.0.1:8001'` 启动 `npm run dev -- --host 127.0.0.1 --port 5174 --strictPort`；页面持续标注“模拟模型验收 · 未调用真实 AI”。新开PowerShell可避免该临时代理环境变量影响常规5173启动。

`frontend/scripts/check-ai.cjs` 是本轮21项浏览器脚本；`check-ai-restart.cjs` 在实际重启上述测试后台后复核保存内容。Playwright 可用路径通过 `PLAYWRIGHT_MODULE_PATH` 指定，Chrome 通过 `BROWSER_EXECUTABLE` 指定。这些脚本不自动调用付费模型。测试会创建明确标注的合成账户/项目，不删除用户资料。

## 本机截图和记录

全部在 `artifacts/ai-v05`，不提交运行资料、会话、日志或截图到 Git。以下含结果的截图均为**模拟模型 + 真实统计/检索/数据库**，画面顶部有相同标注：

- [确认方案（桌面）](artifacts/ai-v05/simulated-plan-desktop.png)
- [展开条件编辑（390px）](artifacts/ai-v05/simulated-plan-mobile.png)
- [72%差异结果（桌面）](artifacts/ai-v05/simulated-result-desktop.png)
- [差异结果（390px）](artifacts/ai-v05/simulated-result-390.png)
- [原始证据（桌面）](artifacts/ai-v05/simulated-evidence-desktop.png)
- [原始证据（390px）](artifacts/ai-v05/simulated-evidence-mobile.png)
- [80%一致结果](artifacts/ai-v05/simulated-consistent-desktop.png)
- [缺基期证据](artifacts/ai-v05/simulated-unsupported-desktop.png)
- [过期快照](artifacts/ai-v05/simulated-stale-desktop.png)
- [实际重启后恢复（手机）](artifacts/ai-v05/simulated-restored-mobile.png)
- [常规预览真实未配置状态](artifacts/ai-v05/unconfigured-desktop.png)
- [常规预览未配置状态（手机）](artifacts/ai-v05/unconfigured-mobile.png)
- 浏览器逐项结果：`checks.json`；重启验收：`restart-checks.json`。模型请求模拟计数：72%为4次、80%为4次、百分点候选为1次；手机方案补检另用3次模拟请求；真实模型总计0次。

本轮本地提交按后台、前端、文档/验收模块保留，分支 `codex/ai-assisted-verification`；未推送远端。
