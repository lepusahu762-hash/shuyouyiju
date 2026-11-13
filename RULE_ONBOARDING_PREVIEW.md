# 遇空值暂停修复与独立规则确认 · v0.13

日期：2026-11-13（Asia/Shanghai）。原目录、原分支 `codex/ai-assisted-verification`，开始 HEAD `088a5824afd1f6a808c8a893a5a9fa0930a9261c`，开始工作区干净。没有重置仓库、清库、改模型配置或新增依赖。项目及祖先未发现 AGENTS.md。

## 修复内容和业务语义

原分组引擎对每组单独计算，基础空值策略暂停了整体及B组，但A组仍保存正式50%；排名只读取组状态，因此错误回答“A最低”。任务状态completed又表示后台执行结束，不能代表数值可用于比较。

本轮以**整体统计状态completed**作为分组比较的必要前提。整体遇空值暂停或没有有效分母时，所有组只保留诊断计数与行证据，不返回正式展示值、未舍入数值、精确分数或最高最低/并列结论。图表无正式柱值、排序禁用，数据表与会话清楚标注诊断用途。任务“执行结束”和统计“可比较”分别判断。

`/runs/:id`、分页`/runs/:id/groups`、会话列表/单条读取、直接POST最高最低请求都执行相同防线。旧暂停结果在读取时复制并安全展示；存储不迁移、不重算。旧错误排名保留在返回数据的`historical_answer`供审计，主要回答改为不可排名；原数据库值不写回。新分组方法记录`record-single-group-v2`，旧v1历史链接仍兼容。

## 资料页独立确认规则

- `/app/projects/:pid/materials#confirm-rules`提供“确认统计规则”，仅需表格与已指定规则文本/DOCX。无需报告结论、图片或AI核验任务，不产生模型调用。
- 原任务内`RuleSetup`和独立入口共用`RuleSnapshotEditor`及原受保护快照接口，不另建规则体系。选择表格、工作表、比例/计数、指标、范围、分母和分子条件、空值策略及精度，为九项约束分别选真实段落并逐项确认。
- 规则原文和连续引用可展开；超过4000字需人工选取连续条款，后台继续校验真实来源。规则资料按50段分页，可跨页选段落，来源标识和原文位置保留。歧义不为空时不能保存已确认快照。
- 快照不可覆盖，保留变更原因、前版关系、内容/资料指纹。来源伪造、跨账户、旧head及资料并发变化继续由后台拒绝。读取接口补充`current_valid`，不是用“有快照”冒充“有效快照”。
- “已指定规则资料”“已保存项目统计说明（文字备注）”“已确认结构化规则”单独展示。只指定资料不会显示已保存说明；保存说明不等于确认规则。新增“补充规则说明”复用原文本保存接口，仍须另行指定和确认。
- 同页指定规则资料会递增项目规则并发计数。页面同步该版本；只有文字备注未改变时才带入新计数，保留草稿。其他页面真的改过文字说明仍409拒绝，不覆盖它。
- 数据分析按真实状态依次引导上传表格、补充并指定规则说明、确认当前有效快照、开始提问。入口保留项目，登录返回目标允许安全的`#confirm-rules`；确认后可直接进入分析。历史仍可查看。

## 可运行预览与从零操作

前端 <http://127.0.0.1:5173>，后台健康检查 <http://127.0.0.1:8000/api/health>。沿用README中的PowerShell启动命令和`backend/.venv/Scripts/python.exe`。

1. 在`/auth?mode=register`注册独立账户，创建“分析数据”项目。
2. 上传CSV或XLSX。没有表格时，分析页会引导回资料页上传。
3. 点“补充规则说明”，填规则名称及正文并保存。在“统计规则与依据库”勾选该文本；手机切换“字段与规则”可找到。可另存项目统计说明，但它不是已确认规则。
4. 点资料页“确认统计规则”（也可从分析页引导进入）。选择表格与工作表，按原文设置九项约束，为每项选择真实规则段落，展开核对原文并逐项勾选。填写本次确认依据；有歧义先解决。
5. 点“保存已确认规则快照”，成功后点“进入数据分析”。不需要先发起任何文字/图片核验任务。
6. 新建分析会话，提问分组问题，同意发送必要字段和规则，检查模型方案并确认计算。数字来自原完整工作表引擎。
7. 点击图表或数据表中的组，在证据中查看分子、分母、原始行；切“规则来源”定位原文。刷新、排序和回看不调用模型。

本机已完成两个独立空账户的上述全过程：

- 正常案例：`/app/projects/dc8cac1a-8429-4cbf-9b94-be9aa4385159/analysis?session=661d216e-59da-4835-b7eb-edc4a654fa64`。
- 暂停案例：`/app/projects/5722110d-7b5c-4834-a809-e335ba7e8d25/analysis?session=6e122dec-9062-4944-a46a-3a15d0700a1a`；会话内可回看“哪个最低？”的真实后台拒绝排名回答。

登录信息仅存本机忽略目录`artifacts/rules-onboarding-v13/演示账户.txt`及`pause/演示账户.txt`，没有写入Git。其他账户不可访问这些项目；也可用自己的账户按上面步骤演示。

### 合成资料

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\backend'
& '.\.venv\Scripts\python.exe' scripts/make_analysis_demo.py
& '.\.venv\Scripts\python.exe' scripts/make_rule_onboarding_demo.py
```

均为明确标注的独立合成资料，生成到忽略的`artifacts/analysis-demo`和`artifacts/rule-onboarding-demo`。字段与已知答案只在生成器、测试及验收断言，不在产品判断中。

正常12行案例：范围“纳入状态=有效”，分子“反馈等级=满意”，基础空值保留，0位精度，按“所属学院”分组，分组空值保留。A=3/6=50%，B=1/4=25%，总体4/10=40%；另2条范围外记录，不平均组比例。

暂停4行案例：A有效满意、A有效一般、B有效满意、B有效空评价。范围“状态=有效”，分子“评价=满意”，基础空值暂停，分组“组别”，分组空值保留。整体暂停，A和B都不展示正式比例，最高最低只回答不可比较。排查计数沿用原空值检查：分子2、诊断分母3、暂排除1，不代表正式2/3满意率。

## 实际验收结果

### 离线与确定性测试

- 相关后台合集44项通过：分析、计算、规则、AI协议、图片、修订及PDF。最终诊断读取保护小改后，新增暂停专项5项再次通过；不把重复执行相加为49个不同测试。
- 专项覆盖基础/分组字段空值暂停、keep/exclude和并列正常值、直接POST最高/最低、旧错误存储读时保护且不写回、归属404、独立来源422、未确认/并发409和资料变化失效。
- 前端`npm run build`和`npm run lint`通过，无前端warning。后台仅现有Starlette对httpx的弃用warning，无业务测试失败。
- 网页额外验证：先编辑文字草稿再指定规则资料，能保存且不丢草稿；另一个网页修改说明后，原页保存409且保留原页草稿。清空文字说明后重载，虽然仍指定规则资料，仍显示“尚无统计说明”，没有确认快照。
- 旧文字AI任务及规则定位、旧图片结果和行定位、原分析分组/排序、既有修订和PDF受保护读取通过浏览器必要回归；下载的既有PDF SHA256一致。没有重跑原所有业务写流程或再次调用旧任务模型。

复现后台检查（必须在backend目录运行）：

```powershell
& '.\.venv\Scripts\python.exe' -m pytest tests/test_analysis_pause.py tests/test_rule_onboarding.py tests/test_analysis.py tests/test_calculations.py tests/test_rule_constraints.py tests/test_ai.py tests/test_images.py tests/test_revisions.py tests/test_exports.py -q --basetemp ../artifacts/rules-onboarding-v13/pytest-repeat
```

### 真实模型与网页验收

沿用真实百炼`qwen3.7-plus`、`cn-beijing`。本轮**2/4次**，失败0、自动重试0；累计输入4121、输出510、合计4631 tokens，均来自接口usage。

|真实请求|模型原建议|人工修改|确定性结果|输入/输出/总tokens|
|---|---|---|---|---|
|正常12行|ratio，所属学院分组，分组空值keep；探索条件纳入状态=有效，引用实际规则段落|无|确认后A50%、B25%、总体40%，真实行和规则定位通过|2069 / 268 / 2337|
|暂停4行|ratio，组别分组，分组空值keep；探索条件状态=有效，引用实际规则段落|无|继承已确认基础block；整体及全部组暂停，无正式比例|2052 / 242 / 2294|

随后网页追问“哪个最低？”直接读取暂停运行，0次模型请求、无重算，明确不能排名。模型只提出分组方案，基础null_policy来自用户独立确认快照；暂停不是依赖模型自觉遵守。

两例的注册、创建、上传CSV和XLSX、粘贴规则文本、指定规则资料、九项来源确认、保存快照、提问和确认计算**全部通过网页控件操作**。验收脚本`frontend/scripts/check-rule-onboarding.cjs`的业务API辅助函数只GET；没有接口POST/数据库写入预置规则快照。人工确认属于实际方案确认，不当作模型自动确认。

1440×1080桌面、390×844手机实际Chrome检查通过，无页面横向溢出和前端运行异常。两例均实际刷新、后台重启、退出重登后恢复同一规则ID、方案、结果和调用数；登录保护保留独立确认目标。恢复和截图没有新增请求。

调用账本、完整原响应与确认、网页断言、截图均在本机忽略目录`artifacts/rules-onboarding-v13`。脚本使用`PLAYWRIGHT_MODULE_PATH`指向本机Playwright，Chrome执行路径见脚本；`setup → model → execute → readonly → restart`分段，保存状态防止再次付费。`SYJ_BROWSER_CASE=pause`切换独立暂停案例；`rank`读取已有结果。已有完成状态不要重跑`setup/model/execute`，用`readonly`回看。真实服务器本轮仅临时设置统一预算4和同一路径账本，未修改`.env`。

### 实际截图

以下均为本机真实网页截图，不是设计稿；相对路径位于忽略目录，不推送含账户画面的文件：

- 正常结果桌面：`artifacts/rules-onboarding-v13/final-desktop.png`。
- 正常结果手机：`artifacts/rules-onboarding-v13/final-mobile.png`；局部`analysis-mobile-detail.png`。
- 独立规则编辑桌面/手机：`artifacts/rules-onboarding-v13/pause/rule-confirm-desktop.png`、`rule-confirm-mobile.png`（后者同pause目录）。原文详情已折叠，页面保留逐项确认。
- 暂停追问与图表：`artifacts/rules-onboarding-v13/pause/paused-rank-desktop.png`、`paused-rank-mobile.png`；局部`paused-desktop-detail.png`、`paused-mobile-detail.png`。
- 正常真实方案和规则引用：`real-plan-desktop.png`、`real-rules-desktop.png`（均在本轮根目录）。

## 数据保留、同步与边界

开发前备份后，逐行核对原18张表中所有原记录均未改写/删除；72个原件、图片预览和PDF逐个SHA256相同。只增加独立合成账户、项目、资料、快照及运行。证据详见本机`preservation.json`。不提交数据库、会话、密钥、运行资料和截图。代码按模块保留本地提交，推送原开发分支，最终远端核对见交付说明；不改main或仓库可见性，不强推。

模块提交：`b48cfa7`修复整体暂停与旧历史比较；`9a97dfc`接通独立规则编辑、引导、来源确认和网页验收脚本。仓库原地址`https://github.com/lepusahu762-hash/shuyouyiju`，目标仍为`codex/ai-assisted-verification`。源码及全部可达历史blob扫描未检出本机配置密钥、令牌或私钥；API确认仓库仍私有，main保持`e9675b3804ae0627f1905d051fc8ce85517ea944`。

本轮没有新增统计方法、模型功能或新业务页面。规则语义仍由用户逐项对照原文确认，后台不宣称自动理解任意自然语言规则。复杂指标/多字段分组/预测/因果分析仍不支持。暂停结果需明确调整并重新确认有效规则后重新运行；旧历史不会因查看而自动修正为通过。既有图片核验PDF、整篇报告核验等未接通能力继续保持原边界。
