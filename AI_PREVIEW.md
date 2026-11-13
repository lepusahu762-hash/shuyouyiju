> v0.14（2026-11-13）体验打磨轮次：新增真实模型请求0次，未改配置。原任务/规则/审计保持，最新体验、性能和截图见 [EXPERIENCE_PREVIEW.md](EXPERIENCE_PREVIEW.md)，准确参赛边界见 [RELEASE_READINESS.md](RELEASE_READINESS.md)。以下调用次数与未接通说明属于各历史轮次。

> v0.15统一参赛案例：[实际验收](UNIFIED_DEMO_PREVIEW.md)，同项目分析、文字、图片、修订复核和PDF完成。本轮7/8次真实请求，输入7406/输出1309/总8715tokens，包含1次图片格式失败；失败任务保留，通用图片输出契约v2后新任务识别成功。历史轮次账本不归入本轮。

> v0.13（2026-11-13）：已修复整体空值暂停仍对局部分组排名的问题，并在资料页接通不依赖核验任务的独立规则确认。新账户全程网页上传、指定规则、逐项确认后进入分析；真实百炼2/4次，4121输入＋510输出＝4631 tokens。暂停与正常流程、1440/390布局、重登/重启恢复及旧历史回归已验收。详见 [RULE_ONBOARDING_PREVIEW.md](RULE_ONBOARDING_PREVIEW.md)。

> 对话分析增量（2026-11-13）：已在原数据分析页接通受限自然语言方案、人工确认、完整工作表单字段分组、保存结果最高最低与源行/规则联动。真实新增4/12次，8627输入＋1065输出＝9692 tokens；首次响应结构异常经有界校验修复后复用，没有重复付费。模型原建议、人工确认和后台计算分别保存，旧规则/核验/修订/PDF不改写。能力边界、真实与离线检查、截图见 [ANALYSIS_PREVIEW.md](ANALYSIS_PREVIEW.md)。下文用量和“对话未接通”均为此前轮次记录。

> 图片核验增量（2026-11-12）：在现有结论核验页新增“报告文字／图片图表”切换，PNG/JPEG明确百分比标签使用真实qwen3.7-plus识别；用户确认识别及九项规则后，复用确定性计算与后台冲突阻断。4次真实调用，输入3924、输出874、合计4798 tokens；50%差异、40%一致、无标签/模糊停止均实际通过。重启/重登回看不再次调用，图片核验PDF未接通。完整当前边界、操作、测试与截图见 [IMAGE_VERIFICATION_PREVIEW.md](IMAGE_VERIFICATION_PREVIEW.md)。以下“图像未接通”等为各轮历史状态，不覆盖旧任务。

# AI 辅助单条百分比核验 · 已确认规则冲突检查

> 最新检索轮次（2026-11-12）：已保留关键词基线，接入本地BM25/相邻条款，新任务记录查询、策略、来源与耗时，旧任务不改写。固定36题评测与3条固定输入真实对照、1条正常网页流程见 [RETRIEVAL_PREVIEW.md](RETRIEVAL_PREVIEW.md)。本轮新增真实请求 **9次/上限12**，9575输入＋2913输出＝12488 tokens；下方0、4、9次为各自历史轮次，不可相加冒充本轮。未调整模型配置。

> 最新PDF轮次（2026-11-12）：单条结论PDF已接通，仅读取保存结果，不重算、不执行核验、不调用模型。本轮真实模型请求0次，配置和既有AI任务未变。样例、权限、重启恢复和视觉验收见 [PDF_EXPORT_PREVIEW.md](PDF_EXPORT_PREVIEW.md)。

> 最新修订轮次（2026-11-12）：已在现有手动/AI结果增加“去修订”，接通原稿保留、单条数字修订、不可覆盖版本及按当前规则的确定性复核。新增模型请求**0次**，未修改模型配置；规则冲突和旧确认失效继续由后台阻断。实际功能、18项相关后台测试、真实浏览器检查与截图见 [REVIEW_PREVIEW.md](REVIEW_PREVIEW.md)。下方4次、9次和全站界面预览说明均为此前轮次的历史记录，不能作为本轮新增调用或当前修订状态。

> 2026-11-12 全站界面轮次：新增 `/verify` 与原 `/ai-verification` 共用现有组件，改为报告/事项/证据三栏；原任务链接、规则冲突和历史不变。本轮新增模型请求 **0次**，没有调整模型配置或后台计算。下方4次与9次是此前各轮验收记录。11页清单及本轮100项只读浏览器检查见 [SITE_PAGES_PREVIEW.md](SITE_PAGES_PREVIEW.md)。

## 本轮增量交付 · 2026-11-12

本轮在原项目、原开发分支 `codex/ai-assisted-verification` 上增量实现规则约束检查，没有重做首页或建立重复工作区。沿用 React / TypeScript / Vite、FastAPI、SQLite、项目 `backend/.venv`（Python 3.13.11）和真实百炼 `qwen3.7-plus` / `cn-beijing`。**本轮真实新增请求为4次，不是下方历史联调的9次；错误建议阻断的模拟验收与真实验收分开记录。**

### 实际实现

- 新增不可覆盖的结构化规则快照：表格、工作表、计算类型、指标、范围说明、分母条件、分子条件、空值策略、显示／比较精度共9项。全部必须明确填写、逐项关联真实规则段落并由用户确认；保留歧义／未明确内容时拒绝保存，不能将界面预填草稿或模型默认值视为已确认规则。
- 每个来源保存实际资料和段落ID、原文节选、位置、解析指纹、文件SHA256；规则快照保存连续版本号、前一版本、上下文、指纹、变更说明和时间。使用新增 `rule_snapshots` 表，既有表结构、账户及用户数据保留，没有用清库实现升级。快照没有覆盖或删除接口。
- AI 原建议保留在 `payload.plan`；可编辑草稿和修改事件另存为 `draft_plan` / `plan_revisions`；最终确认方案、绑定规则快照和检查版本分别保存。模型返回 `plan=null` 时，可以用用户完整明确的规则创建独立草稿，原建议仍保留为null。
- 后台对9项逐项确定性比对。等值条件按AND语义比较，忽略顺序和重复条件；数值条件归一化。文本指标、范围说明采用保守的明确值比较，不自动推断近义语义。冲突必须修正方案，或明确保存新规则快照后重新绑定、检查及确认；确认说明或“已知晓”勾选不能绕过。
- 确认接口及计算执行阶段都检查规则、资料版本和权限；模型工具响应返回后、实际计算前再次检查。规则变化会使旧确认失效，即使变化发生在确认后、等待模型响应时，也不能继续产出旧口径的计算结果。模型仍只获得已有受控规则查询和计算工具，不执行代码或SQL。
- 原核验方案区域新增“规则要求／AI原建议／最终方案”对照。冲突优先展开原文，其余字段与修改记录可展开；手机纵向排列。状态来自真实后台检查，区分待确认、冲突、已确认、过期和旧历史未检查。
- 旧任务和结果不回填新版检查版本，不自动标为通过；原任务数据没有被迁移或覆盖。旧记录仍可查看，并显示“未执行结构化规则检查”。新结果继续使用原有计算和核验历史。

新增接口均校验当前账户的项目／任务归属：

| 接口 | 功能 |
| --- | --- |
| GET `/api/projects/{id}/rule-snapshots` | 分页查看快照，返回当前版本和上下文指纹 |
| POST 同路径 | 逐项确认并追加新快照；预期版本不符返回409 |
| POST `/api/ai-tasks/{id}/bind-rule` | 绑定当前规则并清除旧确认，保留原AI建议和旧修改记录 |
| POST `/api/ai-tasks/{id}/plan-check` | 保存独立草稿，返回真实冲突项及对应规则原文 |
| POST 既有 `/confirm` | 必须传当前规则快照ID，无未解决冲突才可进入执行 |

### 独立合成案例及演示步骤

生成器仅为验收使用：

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\backend'
& '.\.venv\Scripts\python.exe' scripts/make_rule_conflict_demo.py
```

生成目录 `artifacts/rule-conflict-demo`，含CSV、规则DOCX、报告DOCX和说明，全部明确标注独立合成资料。共12条：纳入10条（满意4、不满意4、评价为空2），不纳入2条。字段为“纳入标记”“服务评价”，与旧演示不同。规则明确要求纳入记录全部进入分母，评价空值保留，精度0位，按记录不去重。错误排除会得到4÷8=50%；正确为4÷10=40%，报告50%与计算值相差10个百分点。产品判断代码不包含这些字段名或答案。

预览仍是 <http://127.0.0.1:5173>；后台 <http://127.0.0.1:8000>。Windows启动方式见 README。真实演示项目名为“真实AI验收 · 空值规则冲突12条”，保存在本机原数据库。独立演示账户的本地登录说明在 `artifacts/rule-constraints-v06/live/演示账户.txt`，不提交Git。已有自己的账户也可以上传上述合成资料。

1. 登录后打开演示项目 → AI辅助核验。直接从“恢复最近的AI方案与执行状态”打开已保存任务，仅回看不会调用模型。
2. 新演示时先上传三份资料，将“合成统计规则.docx”指定为统计规则资料，再选择报告50%的段落，同意发送必要片段，提取候选并选择这一条。
3. 展开“明确并保存规则约束”。逐项核对表格、字段、范围、分子、分母、空值及精度；为9项选择真实来源并明确确认，写明依据，保存新规则快照。没有来源或有歧义时先补充规则，不直接确认。
4. 查看三方对照。有冲突时按原文修正最终方案，再点“保存方案并检查规则”。真正要改规则时必须保存新快照，再绑定、检查和确认；不能仅勾选知晓。符合规则也仍需最终人工确认。
5. 确认后由既有引擎运行，显示4÷10=40%、报告50%、计算值减报告值为−10个百分点；分母证据包含两条评价空值。页签可查看原始行和规则，链接可定位原句、规则段落及源行。
6. 刷新或重启后台后回看同一任务，规则快照、方案、修改记录和结果保留。修改资料或保存新规则后，旧记录保留并提示待重新检查／复核。

真实已保存任务：

<http://127.0.0.1:5173/app/projects/9445b0f2-add6-4a6c-8d5d-27ac81cb3c6d/ai-verification?task=4f4c971c-171e-4fbd-b1b2-b31b3d4238e1>

### 离线测试与浏览器验收

- 后台运行 `test_rule_constraints.py`、`test_ai.py`、`test_ai_live_adapter.py`、`test_calculations.py`：**16项通过**，无真实模型请求。新增覆盖缺失／未确认规则、虚构原文、错误空值方案、改变其他约束、直接确认请求409、执行阶段伪造确认、确认后并发规则变更、旧历史兼容、不可覆盖、跨账户访问、重启恢复及模型无法映射后的人工补全。既有手动计数／比例、证据、严格数值比较和原AI工具约束回归通过。有1条既有Starlette/httpx弃用提示，不影响本次结果。
- 前端 `npm run build` 通过；`npm run lint` 通过，0警告。构建结果和视觉验收分别记录。
- 独立模拟服务使用 `tests/preview_rule_constraints.py`，SQLite在 `artifacts/rules-browser-data`，前端5174，明确显示“模拟模型验收 · 未调用真实AI”。模拟模型故意提出排除空值，真实后台阻止直接确认（409且不增加模型请求）；修正保留后真实计算40%，差−10个百分点。**这不是本轮真实模型的原建议。**
- 离线Chrome验收24条具名断言通过，包括桌面1440px、手机390px、冲突三方对照在手机纵向排列、证据表格自身滚动、原文定位、刷新与真实进程重启恢复。保存了一个独立的未执行错误任务供回看，原修正结果未覆盖。
- 真实Chrome验收20条具名断言通过：真实注册、建项目、上传新字段CSV和DOCX、指定规则、提取、检索、生成方案、逐项确认规则、执行计算、证据定位、390px、刷新及后台进程重启。**真实模型本次正确建议keep，无真实错误建议可供阻断；错误分支只计离线覆盖。**
- 重启后逐项比较保存的payload、规则快照、修改记录、trace、比较结果与请求次数，全部一致；上传CSV逐字节一致。对开发前数据库备份的逐表比较确认原有13账户、13项目、33资料、11计算及3个旧AI任务等所有原有行均未改写；本轮仅新增独立合成验收资料及结果。

浏览器脚本：`frontend/scripts/check-rule-constraints.cjs`，阶段为 `setup` → `plan` → `rules` → `execute` → 重启后 `verify-saved`；`review`只回看已保存的真实结果（离线模式另保留一个错误方案）。`live`会实际计费，脚本防止重复发起已完成阶段。Playwright路径使用本机 `PLAYWRIGHT_MODULE_PATH`，不额外改变产品依赖。

### 本轮真实调用与用量（上限6次）

本轮使用独立的 `artifacts/rule-constraints-v06/request-ledger.json`，每次HTTP尝试前持久预占计数，进程重启不重置，本轮上限6；每任务原有6次限制保持。没有连通性探针、失败、自动重试、模型切换或为了截图重复提取。**本轮实际4次，全部HTTP200。**

| 阶段 | 请求数 | 输入tokens | 输出tokens | 总tokens |
| --- | ---: | ---: | ---: | ---: |
| 提取50%陈述 | 1 | 292 | 101 | 393 |
| 规则查询工具调用 | 1 | 479 | 19 | 498 |
| 生成核验方案 | 1 | 1,092 | 526 | 1,618 |
| 已确认方案的计算工具调用 | 1 | 755 | 74 | 829 |
| **合计** | **4 / 6** | **2,618** | **720** | **3,338** |

上述均来自接口实际usage；本轮四次基础用量都存在。未返回或未采集的细项为未知，不当作0，不据此编造费用。截图、刷新、检查规则和保存快照不会调用模型。验收计数由临时进程变量启用，没有修改用户 `.env`；最后按普通启动方式重启后台并复验历史，计数记录仍保留，之后没有追加本轮模型调用。用户后续主动发起的新任务会产生新的实际用量。

### 截图

- [离线构造错误建议：规则冲突细节](artifacts/rule-constraints-v06/offline/blocked-conflict-detail.png)
- [离线冲突完整桌面](artifacts/rule-constraints-v06/offline/blocked-conflict-desktop.png)
- [离线冲突390px纵向布局](artifacts/rule-constraints-v06/offline/blocked-conflict-mobile.png)
- [离线修正后的40%结果](artifacts/rule-constraints-v06/offline/result-40-detail.png)
- [真实模型原建议（本次正确保留）](artifacts/rule-constraints-v06/live/original-plan-desktop.png)
- [真实40%结果细节](artifacts/rule-constraints-v06/live/result-40-detail.png)
- [真实40%结果完整桌面](artifacts/rule-constraints-v06/live/result-40-desktop.png)
- [真实40%结果390px](artifacts/rule-constraints-v06/live/result-40-mobile.png)
- [真实分母记录及空值证据](artifacts/rule-constraints-v06/live/evidence-desktop.png)
- [真实后台重启恢复390px](artifacts/rule-constraints-v06/live/restored-mobile.png)

截图和带会话的验收文件保留本机 `artifacts`，不上传Git。远程仓库的截图链接因此不会包含本机截图文件，应在本机打开或使用本轮交付的绝对路径。

### 提交与远程同步

- 后台：`3b5709e`，结构化规则、快照、确认／执行阻断、独立资料和离线回归。
- 前端：`f6dfebd`，原工作区三方对照、规则编辑确认、响应布局及分阶段验收脚本。
- 原远程仍为 `https://github.com/lepusahu762-hash/shuyouyiju`，目标分支仍为 [`codex/ai-assisted-verification`](https://github.com/lepusahu762-hash/shuyouyiju/tree/codex/ai-assisted-verification)。已普通推送开发分支及其完整既有历史，远程main保留在原 `e9675b3`；未强推、压缩历史、改可见性、邀请账号或删除分支。本记录的文档提交随最终推送同步，最终HEAD由本轮交付回复及本机 `artifacts/rule-constraints-v06/sync-result.json` 记录。
- 推送前扫描所有可达历史blob及待提交文件，对真实配置Key进行内存精确匹配，并检查常见密钥格式、私钥、运行数据路径和历史文件清单，未发现敏感内容进入历史。只有空密钥的 `.env.example` 和明确合成的测试账户常量；实际 `.env`、数据库、会话、上传原件、日志、验收账户文件均忽略，没有上传。原有历史提交完整保留。

### 仍有边界

规则结构化和原文对应含义仍由用户逐项确认；后台验证来源真实和明确约束一致，不声称能自动理解所有自然语言规则。仅支持现有等值／AND条件、计数／比例、空值策略和0–6位精度；无法表达的规则应保留待确认并阻止执行。指标／范围描述暂保守精确比对，不自动做语义同义匹配。沿用项目级保守失效策略，新规则可能使同项目其他旧结果一并待复核，未建设完整依赖／版本平台。没有扩展改写、导出、多模态、复杂统计或Agent平台。

真实模型本轮没有给出错误空值建议，所以不宣称真实模型错误分支验收；该分支已由离线模型、直接HTTP及后台执行防线测试覆盖。真实服务故障、限流和密钥错误本轮未付费制造，仍由既有离线适配器测试覆盖。没有重复进行其他无关页面的大批量验收。未部署公网。

---

## 历史 v0.5 · 上轮真实接通与早期模拟记录

交付日期：2026-11-12。原仓库 `D:\Desktop\chuanzhibei\shuyouyiju`，沿用 React / TypeScript / Vite、FastAPI、SQLite 和 `backend/.venv`（Python 3.13.11）。未重建项目、未修改首页、未删除或迁移原有账户和上传文件。本次检查未发现仓库及已检查父目录中的 AGENTS.md；已读 README、CALCULATION_PREVIEW、产品需求及实际代码。

**真实 AI 已于本轮联调接通。** 当前从本机 `backend/.env` 读取 `qwen3.7-plus` / `cn-beijing`，已完成9次真实模型请求及三项浏览器验收，详见下方“真实百炼联调验收”。文末原始 v0.5 模拟记录保留为历史，不能与本轮真实记录混用。

## 真实百炼联调验收 · 2026-11-12

本轮在原有 v0.5 上完成真实联调，没有新增业务页面、变更技术栈或替换用户资料。Git 开始时干净，保留原账户、资料、手动计算和历史。新增一个独立合成演示账户和项目，演示资料来自 `artifacts/ai-demo`。所有下述截图为**真实百炼模型 + 原有确定性统计引擎**，与文末 `artifacts/ai-v05` 的历史模拟截图分别保存。

### 配置及 qwen3.7-plus 参数核对

- 使用 `backend/.venv/Scripts/python.exe`（Python 3.13.11）。`pydantic-settings` 实际读取 `backend/.env`；模型/地址/Key/地域没有同名进程环境变量覆盖。仅检查Key是否存在，没有输出完整Key、整个.env或认证请求头，未修改用户填写的配置。
- 实际模型 `qwen3.7-plus`，地域 `cn-beijing`，Base URL `https://dashscope.aliyuncs.com/compatible-mode/v1`，北京官方兼容端点。通过现有 `app.main:app` 启动的 `BailianProvider` 调用；前端5173复用原服务，`/api/ai/config` 返回 `test_mode=false`。独立模拟服务5174没有参与本轮真实流程。
- 重新核对 [深度思考](https://help.aliyun.com/zh/model-studio/deep-thinking)：Qwen3.7 Plus 默认开启思考，但支持 `enable_thinking=false`。本流程显式关闭思考，采用 `stream=false`，不保存或显示 reasoning_content。
- 核对 [结构化输出](https://help.aliyun.com/zh/model-studio/qwen-structured-output)：Qwen3.7 Plus 系列支持 JSON Object。本流程设置 `response_format={"type":"json_object"}`，提示词含 JSON 关键词，后台再进行 Pydantic/原文/字段校验，没有把 JSON Object 当成严格 Schema 保证。
- 核对 [Function Calling](https://help.aliyun.com/zh/model-studio/qwen-function-calling)：Qwen3.7 Plus 系列支持工具调用。本轮实际成功使用指定函数 `tool_choice`、`tool_calls`、`tool_call_id`，查询规则后带真实工具响应继续生成方案；只开放规则查询和已确认方案指纹对应的计算能力，不执行代码。
- 超时仍为45秒（httpx 客户端的网络阶段超时，非服务端生成时长承诺），显式非思考模式避免默认思考增加等待；本轮真实请求耗时约1.76–10.95秒，没有触发超时。没有新增重试、提高超时或切换模型。
- 结构化输出文档建议不设 `max_tokens`，以免 JSON 截断。本应用为了保留已约定的输出成本上限，继续显式设置2500 tokens；这是有意保留的取舍，并非认定截断后仍然有效。`finish_reason=length` 时拒绝结果，绝不把半截 JSON 当作核验通过，也不自动无上限重试。本轮全部9次请求实际接受了这些参数，没有截断，结构化和工具输出均通过服务端校验。

### 真实场景、请求次数与 token 用量

| 场景 | 真实请求数 | 输入 tokens | 输出 tokens | 合计 tokens | 实际结果 |
| --- | ---: | ---: | ---: | ---: | --- |
| 72% 单条主流程 | 4 | 2,687 | 750 | 3,437 | 真实提取、规则工具、方案确认及计算工具完成；144÷180=80%，差8个百分点 |
| 80% 一致流程 | 4 | 2,701 | 739 | 3,440 | 范围/精度确认一致后显示与数据一致，差0个百分点 |
| 比去年提升8个百分点 | 1 | 286 | 84 | 370 | 提取为百分点变化，选择后显示证据不足；不虚构去年数据，不生成通过或计算记录 |
| **本轮合计** | **9 / 最多12** | **5,674** | **1,573** | **7,247** | **9次均HTTP 200；无失败、无模型重试、无独立连通性探针** |

用量来自每次真实接口返回的 `usage.prompt_tokens` / `completion_tokens` / `total_tokens`，全部9次均有这三项。没有把未返回的缓存、推理等详细用量填成0，这些细项本轮未采集。接口缺失基础用量时，代码以 `null` 表示未知；控制台账单与费用不由上述token汇总推算。

本轮增加了可选的本地验收计数文件：在每次真实HTTP尝试前落盘预占次数，按任务之外的整轮总量限制为12；失败、重启和新建任务不能重置计数。文件为 `artifacts/ai-live/request-ledger.json`，只含模型、状态、时间、请求ID和基础用量，不含报告内容、Key或headers。每任务最多6次的原有约束继续保留。达到预算或计数文件异常时直接阻止出站请求，没有静默重试。

验收过程中通过**临时进程环境变量**启用 `SYJ_AI_REQUEST_AUDIT_PATH`（指向上述绝对路径）和 `SYJ_AI_REQUEST_BUDGET=12`，没有写入或覆盖用户.env。验收完成后停止额外模型调用；交付时回到常规后台启动方式，不带专项验收覆盖。计数文件和本轮9次用量记录仍保留。后续用户主动开始的新任务依旧有每任务6次上限，属于新的实际模型用量；回看旧结果不调用模型。

### 实际操作与人工修正

通过浏览器注册独立合成账户、创建项目，上传200条CSV和报告/规则DOCX；指定规则后从72%和80%两个原段落分别提取候选。模型实际查到的规则是上传 DOCX 的 `body:2`，并正确建议了“记录状态=有效”的范围条件和“反馈选项=满意”的分子条件，精度0位。

**发现并保留了一项模型建议偏差：两次方案都建议 `null_policy=exclude`，但真实规则明确要求保留空值。** 人工在已有“手动调整字段、条件与精度”区域将其改为 `keep`，写明采用保留空值、不去重、ROUND_HALF_UP四舍五入，确认所选规则和待确认事项后才执行。原 `payload.plan` 仍保留模型的排除建议，`payload.confirmed_plan` 保存最终保留策略，工具只能执行后者。本轮不是无需人工修正的自动通过；合成数据恰好无空值，因此不能据此推断模型空值语义已可靠。

后台调用既有引擎读取完整200行，分母180、分子144、排除20；证据25行一页。通过浏览器实际检查了报告原句高亮、实际规则段落高亮、证据源行链接，确认没有示例内容替代真实来源。重启真实后台后又刷新三个任务，方案、结果、规则快照、请求计数和调用摘要均与保存时一致，原上传CSV与演示文件逐字节相同；没有增加第10次请求。

### 回归与本轮改动

- 离线预检：AI流程模拟测试和新增适配器/计数测试，共6项通过，未发真实模型请求。模拟客户端只在测试注入；新增适配器测试以 `httpx.MockTransport` 验证 qwen3.7-plus、非思考、JSON、指定工具、45秒超时及跨实例持久上限。
- 相关后台回归：`tests/test_ai.py`、`tests/test_ai_live_adapter.py`、`tests/test_calculations.py` 共**11项通过**；包括账户隔离、历史恢复和原手动核验。仍有1条既有 TestClient/httpx 弃用提示。
- 前端 `npm run build` 通过；`npm run lint` 通过，0警告。没有修改前端业务页面，只增加分阶段真实验收脚本。
- 浏览器：`frontend/scripts/check-ai-live.cjs` 使用实际 Chrome/Playwright操作，真实流程及保存恢复检查共28条具名断言通过，无浏览器运行时异常。1440px桌面与390px手机已截图及检查，无页面级横向溢出。
- 代码变更集中在可选整轮请求预算/无密钥审计、未知用量的明确表示、避免测试读取本机.env中的真实凭据，以及可恢复的分阶段真实验收脚本。没有改写统计答案、硬编码业务字段或扩大工具范围。验收脚本对独立合成资料的预期字段和值进行断言，并通过UI完成明确的人工修正，没有伪造工具输出。

真实服务429、鉴权失败、超时和故意破坏的模型输出没有制造付费请求；这些仍是离线模拟覆盖。换列名的新资料本轮未再做真实调用，保留前轮模拟覆盖。没有重复付费评测或为了补截图重新提取。模型建议仍需人工复核，关键词检索覆盖和更广泛数据场景未在本轮宣称通过。

### 回看与截图

预览：[http://127.0.0.1:5173](http://127.0.0.1:5173)。可以用你已有账户上传合成资料重现，也可以查看本轮已保存的演示项目。独立演示账户的本地登录说明在 `artifacts/ai-live/演示账户.txt`（未提交Git，不含模型密钥）；登录后项目名为“真实AI验收 · 合成满意率200条”。从“恢复最近的AI方案”打开72%/80%/百分点任务，或者进入原计算历史，**仅回看不会追加模型调用**。

本轮真实截图（与历史模拟文件分开）：

- [72%真实候选](artifacts/ai-live/live-candidates-72.png)
- [72%模型原建议与真实规则](artifacts/ai-live/live-plan-72.png)
- [72%人工确认后的方案](artifacts/ai-live/live-confirmed-plan-72.png)
- [72%差异结果（桌面）](artifacts/ai-live/live-result-72-desktop.png)
- [72%差异结果（390px）](artifacts/ai-live/live-result-72-mobile.png)
- [真实规则引用](artifacts/ai-live/live-rule-citations.png)
- [报告原句定位](artifacts/ai-live/live-report-source.png)
- [规则原文定位](artifacts/ai-live/live-rule-source.png)
- [原始行证据](artifacts/ai-live/live-row-evidence.png)
- [原始数据行定位](artifacts/ai-live/live-row-source.png)
- [80%一致结果](artifacts/ai-live/live-result-80-desktop.png)
- [无去年基期证据](artifacts/ai-live/live-insufficient-points-desktop.png)
- [刷新恢复与调用摘要（390px）](artifacts/ai-live/live-restored-audit-mobile.png)

基础用量汇总：`artifacts/ai-live/usage-summary.json`；每次出站记录：`request-ledger.json`；浏览器状态和逐项检查：`browser-run.json`。后两类均为本机运行资料，不提交Git。提交中只有代码、测试和不含真实密钥的说明。

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

未实现：完整报告自动核验、复杂统计/分组图表、AI 自动改写、导出、PDF/OCR、邮件功能、RAG向量服务、Agent自治执行或公网部署。没有独立的完整版本管理或持久任务队列。关键词检索可能漏召回；字段映射与语义解释仍须人工检查。

## 首次 v0.5 交付时的验收记录（历史模拟，真实进展见文首新增章节）

| 项目 | 结果 |
| --- | --- |
| 后台测试 | 完整15项通过；后续规则版本/地址校验调整后的相关5项再通过。覆盖账户、资料、原手动计算，以及AI模拟协议、真实规则检索、72/80比较、换列名、缺规则、冲突未确认、假引用、篡改工具、非法JSON、超时/限流、取消、6次上限、持久化、失效和跨账户访问 |
| 前端构建 | `npm run build` 通过 |
| 前端 lint | `npm run lint` 通过，0警告 |
| 浏览器 | Chrome + Playwright，21项通过；1440px桌面、768px平板、390px手机无页面横向溢出，原始数据表自身滚动；追加实测了390px规则选择与展开字段/条件编辑；注册、原资料接口、规则指定、单条72/80、无基期证据、来源高亮、刷新、原历史复用、未配置提示已实测 |
| 进程重启 | 实际重启隔离测试后台后，390px深层页面刷新恢复80%、8个百分点、规则原文快照、确认方案、4次模拟请求计数及过期状态，不增加模型请求 |
| 真实模型验收 | **未执行，0次调用**。缺少本地Key及完整模型配置；72/80/基期不足/换字段这些语义流程尚未由真实模型验证。不能把模拟通过记为真实AI成功 |

已知依赖提示：Starlette TestClient 对使用 httpx 发出1条弃用警告，不影响本次测试。本轮未升级认证或无关依赖。上传文档即使含有指令也不会增加工具权限；测试拒绝修改工具计划和虚构引用。本轮已补验真实模型的中文提取和工具选择；服务商取消行为、真实429/超时及更多字段/数据场景尚未真实制造测试，账单以控制台为准。

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

## 首次 v0.5 模拟截图和记录（历史）

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
