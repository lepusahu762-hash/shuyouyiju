# 数有依据后台 · 单条修订、确定性复核与PDF导出

运行方法、Python 环境和完整配置见[仓库 README](../README.md)。该目录使用项目 `.venv`，SQLite 和原件默认在 `data/`。本轮新增 `revision_threads`、`report_revisions`、`revision_confirmations`、`revision_rechecks` 四张独立表，由启动时创建，原 `rule_snapshots` 继续复用，既有表、账户和原件保留；没有修改既有表结构。后续改变已有表结构时应加入迁移脚本，不能把 `create_all` 当作迁移机制。

## 代码与持久化

- `config.py`：`SYJ_` 环境变量，自动读取本目录 `.env`，数据目录与解析限制。
- `auth.py`：FastAPI Users + SQLAlchemy 用户库 + DatabaseStrategy 会话，Argon2id 密码哈希。邮箱统一小写并去除前后空格；密码 8–72 字符且包含英文字母和数字。
- `models.py` / `database.py`：用户、访问令牌、项目、资料模型；SQLite WAL、外键和 busy timeout。
- `projects.py`：项目归属校验、创建、检索、重命名和版本化规则保存。
- `materials.py`：受保护的上传、原件下载、状态、分页预览、重试、字段说明。
- `parsers.py`：只读 CSV/XLSX/DOCX/粘贴文本解析；ZIP、XML、行列、字符和容量限制。
- `main.py`：应用工厂、生命周期、错误清理、Origin/自定义头校验及注册登录限频。
- `calculations.py`：完整工作表的等值／AND 条件统计，精确分数、规则快照、分页证据、单条百分比比较及历史失效检查。新增 `calculation_runs`、`calculation_evidence` 和 `numeric_checks` 三张表，既有表与用户数据保持保留。
- `rule_constraints.py`：9项必填规则约束、逐项原文来源及确认、不可覆盖快照、条件语义归一化和方案冲突检查。规则快照追加前核对预期版本和资料指纹，所有接口校验归属；没有覆盖／删除快照接口。
- `revisions.py`：原稿与目标数字绑定、追加修订/恢复、版本冲突、显式规则确认、执行前再检查、原计算引擎重新计算和事务内复核保存。没有模型客户端；接口与限制见 [REVIEW_PREVIEW.md](../REVIEW_PREVIEW.md)。
- `ai.py`：原AI建议、编辑草稿、最终方案、规则快照及修改事件分别保存；确认与执行前后都检查当前规则，不信任模型变更口径。旧任务显示未执行新版规则检查，不回填通过状态。API清单及真实／离线验收见 [AI_PREVIEW.md](../AI_PREVIEW.md)。

上传先持久保存原件及元数据，响应真实 `uploaded` 状态；后台任务依次进入 `parsing` → `ready` / `failed`，前端轮询。解析失败保留原件，单独重试使用相同资料标识。后台启动将遗留 `uploaded/parsing` 标记为中断失败并提供重试说明，避免永久假装正在解析。仅运行一个后台实例；该阶段尚无持久任务队列。

规则及字段说明使用整型版本号检测并发保存，冲突返回 409，前端保留未保存输入。检查异常只输出提示；用户填写处理决定时也不会自动填补或删除原值。

## HTTP 接口

所有写请求带 `X-Requested-With: shuyouyiju`。浏览器请求通过前端同源代理；API 文档的交互工具默认不带该头，可用于查看结构，调用写接口时需自己补充该头。登录表单使用 `application/x-www-form-urlencoded` 的 `username` / `password`；注册为 JSON。

| 方法和路径 | 功能 |
| --- | --- |
| GET `/api/health` | 服务版本、邮件验证状态、实际限制 |
| POST `/api/auth/register` | 邮箱密码注册，不发邮件 |
| POST `/api/auth/login` | 登录并设置 HttpOnly Cookie |
| GET `/api/auth/me` | 当前账户 |
| POST `/api/auth/logout` | 撤销服务端会话并清 Cookie |
| GET / POST `/api/projects` | 当前用户列表（可选 q 搜索）／创建 |
| GET / PATCH `/api/projects/{id}` | 查看／重命名 |
| PUT `/api/projects/{id}/rules` | 按版本保存口径 |
| GET / POST `/api/projects/{id}/assets` | 列表／multipart 上传 |
| POST `/api/projects/{id}/reports` | 保存粘贴报告 |
| GET `/api/assets/{id}` | 元数据、解析摘要、字段说明 |
| GET `/api/assets/{id}/preview` | sheet / offset / limit 分页，默认 50、最大 100 |
| GET `/api/assets/{id}/original` | 带权限检查的原件下载 |
| POST `/api/assets/{id}/retry` | 仅失败资料可重试，可传 CSV 编码与分隔符 |
| PUT `/api/assets/{id}/fields` | 按版本保存字段，校验列 ID 属于当前资料 |

v0.4 计算接口（每一项均检查项目所有者，原件目录仍未公开挂载）：

| 方法和路径 | 功能 |
| --- | --- |
| GET `/api/projects/{id}/calculation-context` | 当前项目口径／资料签名的 hash，运行时防止用过期确认 |
| POST `/api/projects/{id}/runs` | 按确认的字段条件计算并保存快照，返回真实完成／证据不足／需要确认状态 |
| GET `/api/projects/{id}/runs` | 分页历史，默认 20、最大 50；附当前过期状态 |
| GET `/api/runs/{id}` | 运行、来源和当时口径快照 |
| GET `/api/runs/{id}/evidence` | 分页证据；group 为 all / denominator / numerator / excluded / unmatched；默认 25、最大 100 |
| POST `/api/runs/{id}/checks` | 关联同项目报告段落并保存一次百分比核验 |
| GET `/api/runs/{id}/checks` | 分页核验，默认 10、最大 50；保留原始判定和当前过期状态 |

运行不提供修改／覆盖接口。核验每次新增，人工勾选不是通过结果。`scope` 与 `numerator` 是等值条件数组，每组最多 10 个，组内 AND，分子继续从分母中筛选。`kind` 为 text / number / boolean；text 区分大小写和空格，number 明确转为有限十进制值，不执行公式；boolean 仅匹配真实布尔单元格。数值型 CSV 文本可用 number 方式比较；CSV 的字符串 true 不会冒充布尔值。

空值定义为 null、空串或纯空白。`null_policy=exclude` 对范围和分子涉及的所有字段检查空值后排除整条记录；keep 保留空值记录但空值不匹配条件；block 遇空值时保留诊断分组，停止产出有效值。前端与结果说明披露其对分母的影响。诊断“有空值”与“非数值”计数可能重叠，四类最终分组互不重叠且合计等于全表记录数。

精确值由整数分子／分母保存。十进制展开使用 80 位有效数字，展示用 0–6 位小数、ROUND_HALF_UP；核验重新从精确分数计算后严格比较，不采用容差。差异为“计算值 − 报告值”，单位百分点。报告值必须为 0–100，且原段落能找到相同的阿拉伯数字百分号表达；不自动识别中文数字、图中文字或复杂上下文。符号保留，负百分比不会误当作正值。

失效检查比较当时的整个项目资料签名（原文件 SHA、解析结果指纹、字段说明与版本）和项目规则／版本。新增资料也会保守标记失效。证据接口读取运行时保存的行，不重新套用当前口径。未来替换解析结果后，旧证据仍不变；没有构建完整版本管理。

未提供邮件验证、找回密码或第三方登录。已有受控AI单条核验接口；本轮导出不会调用模型。

## 测试与重启复核

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\backend'
& '.\.venv\Scripts\python.exe' -m pytest tests -q
& '.\.venv\Scripts\python.exe' scripts/make_fixtures.py '..\artifacts\workspace\fixtures'
```

pytest 使用隔离的临时数据库及文件目录，不操作正常账户数据。包括账户与密码哈希、Cookie 撤销、项目和资料跨账户隔离、重建 app 后恢复、规则冲突、CSV 编码／空值／重复表头、XLSX 多工作表、DOCX 段落、原件字节、异常文件、上传大小、解析中断恢复等断言。

浏览器检查需要前后端已运行。若本机开发工具已提供 Playwright，可通过 `PLAYWRIGHT_MODULE_PATH` 指定它；否则在独立开发工具环境安装 Playwright，不要求成为产品生产依赖。

```powershell
Set-Location '..\frontend'
$env:PLAYWRIGHT_MODULE_PATH = 'C:\Users\LENOVO\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'
$env:BROWSER_EXECUTABLE = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:QA_OUTPUT = 'D:\Desktop\chuanzhibei\shuyouyiju\artifacts\workspace'
node scripts/check-workspace.cjs seed
# 在后台终端 Ctrl+C，按 README 重新启动后台，使用同一 data 目录。
node scripts/check-workspace.cjs restart
node scripts/check-home-auth.cjs
```

浏览器脚本新增合成测试账户和测试项目，不清理或修改其他账户。`QA_OUTPUT` 中的 `session.json` 含测试会话，属于本地忽略文件，不提交、不公开。`run.json`、截图和检查 JSON 支持重启复核。连续运行过快触发认证限频时，按错误提示等待一分钟。

本轮优先使用 `frontend/scripts/check-calculations.cjs seed` 和 `restart` 两个阶段，生成材料用 `backend/scripts/make_calculation_demo.py`。默认输出 `artifacts/calculation-v04`，可用 `QA_OUTPUT` 覆盖；`QA_FIXTURES` 默认指向 `artifacts/calculation-demo`。seed 完成后手动 Ctrl+C 停止后台并按 README 启动同一目录，再运行 restart；restart 也会实测 390px 手机的证据定位与核验。不要上传或提交其 session/run 文件。

本机遗留的 pytest 临时目录可能有其他执行账户的 ACL。遇到 WinError 5 时指定全新、位于仓库忽略目录的临时路径，不修改旧临时目录权限：

```powershell
$testRun = Join-Path (Resolve-Path '..\artifacts') ('pytest-' + [guid]::NewGuid().ToString())
& '.\.venv\Scripts\python.exe' -m pytest tests -q --basetemp $testRun
```


## 单条结论 PDF（本轮）

新增 `pdf_exports` 独立表（仅创建缺失表）和 `data/exports/<UUID>.pdf`；没有重置数据或改变既有修订表。`exports.py`负责明确选择、归属检查、快照确认、生成及读取，`pdf_report.py`负责ReportLab中文排版。预览哈希绑定当前资料、规则、修订head和复核事件；生成时获取SQLite写锁再校验，变化返回409。原始资料按普通文本转义，不解释其中的HTML或指令。

安装本轮依赖仍用项目虚拟环境：

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\backend'
& '.\.venv\Scripts\python.exe' -m pip install -r requirements.txt
```

ReportLab生成PDF，PyMuPDF按需将已保存PDF的一页渲染为PNG，pypdf用于验收。Windows默认使用本机宋体 `C:/Windows/Fonts/simsun.ttc`；未把字体文件提交到仓库。其他系统请提供合法可嵌入的中文TrueType字体，必要时在已有 `backend/.env` 添加 `SYJ_PDF_FONT_PATH=字体完整路径` 后重启；Linux默认也检查WenQuanYi。缺字体时保留失败记录并给出重试说明，不伪造成功。商用分发需自行确认所选字体及依赖许可证。

接口与完整验收记录见 [PDF_EXPORT_PREVIEW.md](../PDF_EXPORT_PREVIEW.md)。相关检查：

```powershell
& '.\.venv\Scripts\python.exe' -m pytest tests/test_exports.py tests/test_revisions.py -q --basetemp '..\artifacts\pytest-pdf-new'
```

临时目录应使用尚不存在的新路径。独立浏览器验收通过 `scripts/seed_pdf_demo.py` 建立明确标注的合成项目，不写入既有用户项目；账户、会话、PDF和截图均保存在Git忽略的artifacts中。不要提交或公开这些本地文件。已有导出记录下载遇到文件丢失或校验失败会报错，恢复备份后再试，不根据当前资料重建旧PDF。


## 版本化本地规则检索

`app/rule_retrieval.py` 保留 `keyword-bigram-v1`，新增 `bm25-context-v2`，使用Python标准库，无新增依赖。新任务payload保存策略与本次实际查询、真实段落、适用信息及耗时；工具trace记录来源ID。原任务不补写，旧方案及快照仍可读取。GET规则检索仍先校验账户/项目，限定指定规则资料。长段引用保存时必须为原段落中的连续原文；界面为节选提供条款选择，不能提交省略标记。

离线复现与逐题评测在 [RETRIEVAL_PREVIEW.md](../RETRIEVAL_PREVIEW.md)。本轮相关后台27项通过；前端构建/lint通过，真实请求9次，已保存完整用量。独立合成结果可提交，artifacts中的账号/会话/原件不能提交。验收用共享账本通过临时进程环境配置，用户的backend/.env保持原样；正常任务仍有最多6次请求和既有工具上限。
