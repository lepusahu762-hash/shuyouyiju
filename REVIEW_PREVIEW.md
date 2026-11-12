# 单条百分比修订、版本保存与确定性复核 · 2026-11-12

在原目录 `D:\Desktop\chuanzhibei\shuyouyiju`、原分支 `codex/ai-assisted-verification`、基线 `4a9876ef073df93c9123fb07492600f88a375c75` 上增量实现。开始时工作区干净；保留既有 React / TypeScript / Vite、FastAPI、SQLite、项目虚拟环境和模型配置。仓库及此前检查的祖先目录未发现 AGENTS.md。阅读相关产品需求、运行说明、AI规则与现有计算代码后实现。

**本轮是实际后台保存和计算，不是界面预览。真实模型请求0次，没有修改百炼配置；没有新增模型 token 用量，计费用量不适用。** 验收数据全部为明确标注的独立合成资料。

## 打开与演示

- 前端：<http://127.0.0.1:5173/>；后台：<http://127.0.0.1:8000/api/health>。
- 从50%开始的新核验依据：<http://127.0.0.1:5173/app/projects/a941a8e3-a799-4bdc-97f3-0446ca084a39/review?check=55095704-59c3-48f2-b6ab-e5cf3715b0da&target=0>。
- 已完成的v5及其复核：<http://127.0.0.1:5173/app/projects/a941a8e3-a799-4bdc-97f3-0446ca084a39/review?check=e3fec028-1240-47e8-af0b-27ac8c66fec9&target=0&revision=a560b13d-e986-4f65-849f-a12b73be5868>。
- 本机专用合成账户凭据在忽略文件 `artifacts/revisions-v08/browser/演示账户.txt`；不在本文、截图或Git内提供密码。上述项目受账户权限保护，请使用对应合成账户；用户自己的账户可按相同步骤在自己的项目演示。

演示顺序：

1. 打开新核验依据链接，或从手动/AI核验中一条实际保存结果点击“去修订这条原句”。原句包含50%和另一个25%；选择第一处50%，系统不会替换25%。原报告只读。
2. 点击“接受数值建议”，得到40%草稿；保存修订版本，状态为“待复核”，不会立即显示一致。
3. 展开当前方案，核对纳入标记、分子条件、保留空值、精度及规则原文。勾选确认，点击“确认此版本方案”，再点击“执行确定性复核”。后台重新计算完整表格4÷10=40%，仅所选百分比显示一致。
4. 改为45%后保存、确认并复核，得到差异−5个百分点。保留50%并填写原因、保存后仍需复核，得到差异−10个百分点，原差异不会被消除。
5. 把“本期”改成“去年”并保存，显示“待人工核验”，后台拒绝确认及执行旧方案。当前能力不自动理解语义变化。
6. 从右侧版本列表查看旧版、其原因和对应复核。恢复旧内容需要再次保存，产生新版本并回到待复核；不能覆盖或删除旧版。
7. 证据页签查看原计算、此版本复核、分页原始行、规则快照与原文定位。刷新或重新登录可恢复选定版本，查看历史不调用模型。

合成资料生成：

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\backend'
& '.\.venv\Scripts\python.exe' scripts/make_revision_demo.py
```

输出至忽略目录 `artifacts/revision-demo`：12行CSV、报告DOCX、规则DOCX及说明。10条纳入，其中4条满意、4条不满意、2条评价空值；另2条不纳入。规则保留空值，分母10，不是8。先在资料页上传并指定规则，再保存已确认约束，用手动计算与单条核验建立依据即可，全程可以不调用模型。

## 实际功能与持久化

- 项目原路由 `/app/projects/{id}/review` 接通；`check`定位真实NumericCheck，`target`明确百分比出现位置，`revision`定位不可覆盖修订。登录返回目标保留经过校验的参数。手动核验与AI历史结果均提供入口，旧路由继续可用。
- 原稿、目标数字及位置、实际计算记录、规则快照和原句来源同时存入修订依据。项目其他计算不会被自动套用。规则与计算冲突的手动结果不能作为接受数值建议的依据。
- 只读原稿与可编辑修订稿对照；接受建议、手动编辑、保留原因、撤回草稿、追加保存、恢复旧内容为新版本。保存、确认和复核三步分离。保留原句不消除差异或证据不足。
- 新增四张独立表：`revision_threads`、`report_revisions`、`revision_confirmations`、`revision_rechecks`。启动时仅创建缺失表，没有覆盖旧表或清库。保存版本有父版本、恢复来源、原依据快照和时间；没有覆盖/删除接口。
- 版本保存以预期head检查冲突；确认绑定修订内容指纹、当前上下文和不可覆盖规则快照。执行再次校验归属、当前head、规则、字段、参数、方案及报告来源。规则冲突、资料变化或旧确认绕过均在后台拒绝。
- 复用全工作表计算引擎及Decimal严格比较，保存新CalculationRun与分页证据；复核比较单独关联修订文本，不伪装为改写过的原报告。计算、证据和复核事件在同一事务提交；保存前失败不会遗留孤立运行。同一确认的网络重试幂等复用已完成结果。
- 原核验和旧复核结果保持原保存状态；另外显示当前过期原因。资料与规则继续采用原有保守依赖策略，项目资料集合变化也会失效。保存新修订后，先前版本的确认不能执行；历史一致结果只代表当时对应版本。
- 历史未关联规则快照的核验保持可读，不补记通过新版检查；必须先保存规则、建立新核验依据，才能创建符合本轮要求的修订。

新增接口全部校验账户项目归属：

| 接口 | 用途 |
| --- | --- |
| GET `/api/projects/{pid}/revision-sources` | 分页选择真实核验原句，不从任意最近计算推断依据 |
| GET `/api/projects/{pid}/revision-source/{check_id}` | 原句、目标百分比、原依据、当前规则、每页10个版本 |
| POST `/api/projects/{pid}/revisions` | 追加不可覆盖版本，检查预期head；恢复也追加 |
| GET `/api/projects/{pid}/revisions/{id}` | 精确版本、依据、确认与对应复核 |
| POST `/api/projects/{pid}/revisions/{id}/confirm` | 显式确认当前版本与规则，冲突返回409 |
| POST `/api/projects/{pid}/revisions/{id}/recheck` | 重新校验、计算与比较，原子保存；不调用模型 |

## 验收记录

- 后台最终相关测试：18项（修订6项、原计算/规则/账户12项），使用临时SQLite和NoModel调用防护。覆盖40%待复核→一致、45%差异、保留原句、多个数字、期间/对象/其他数字变化、恢复、乐观冲突、规则变化、直接请求绕过、跨账户、事务中断回滚、幂等、资料变化、旧历史兼容及重启恢复。仅有既有Starlette/httpx TestClient弃用警告。
- 前端 `npm run build`、`npm run lint` 通过，`git diff --check` 通过。没有增加前端运行依赖。
- 真实浏览器：Chrome / Playwright，连接本机实际FastAPI和SQLite，无接口mock，最终43项有记录检查。实际完成原结果入口、多数字选定、接受/保存/复核、45%、保留50%、期间变化阻断、恢复新版本、原始行和规则引用、刷新、退出重登、桌面1440和手机390布局、后台实际重启恢复、规则变化后台409和界面过期、追加规则快照后重新确认复核。没有前端运行异常，页面无横向溢出；表格在自身区域滚动。
- 中途检查脚本把登录返回参数的顺序误当作差异，改为逐项检查参数后通过。重启后第一次过早打开页面遇到服务启动窗口，待健康检查可用后重新检查通过；应用没有伪造恢复成功。最终代码又实际重启并确认快照与两次复核完整恢复。
- 开发前数据库快照对照：已有14个账户、14个项目、36份资料、12条计算、10条数字核验、1份规则快照、4条AI任务均未改变；36份既有原文件SHA256一致。本轮新增的合成账户和资料独立保存，未改写用户数据。原AI请求计数与trace完整保留，新AI任务及模型请求均为0。
- 本轮没有进行真实模型验收，也没有把NoModel防护/离线测试称为AI接通成功。既有模型服务接通记录仍按AI_PREVIEW历史轮次说明。

关键截图均来自实际浏览器，文件在本机忽略目录：

| 文件 | 内容 |
| --- | --- |
| `artifacts/revisions-v08/browser/revision-final-1440.png` | 原稿/修订稿、v1–v5和真实40%复核 |
| `artifacts/revisions-v08/browser/revision-result-1440.png` | 实际比较结果、公式与单条范围 |
| `artifacts/revisions-v08/browser/revision-mobile-390.png` | 手机纵向完整布局 |
| `artifacts/revisions-v08/browser/revision-result-mobile-390.png` | 手机比较结果及证据 |
| `artifacts/revisions-v08/browser/revision-semantic-mobile-390.png` | 改变期间后待人工核验 |
| `artifacts/revisions-v08/browser/revision-stale-1440.png` | 规则变化后旧确认和结果过期 |

可复现检查：项目backend虚拟环境运行 `pytest tests/test_revisions.py tests/test_calculations.py tests/test_rule_constraints.py tests/test_accounts.py -q --basetemp ../artifacts/pytest-revisions-new`；frontend运行build和lint。浏览器脚本 `frontend/scripts/check-revisions.cjs` 的 `main` 会创建独立合成账户与真实资料，`resume` 应在实际重启后台并就绪后运行一次，`inspect` 只回看已有记录。默认结果位置不可覆盖旧验收；需要新一轮合成验收时设置 `QA_REVISION_OUTPUT` 为新的artifacts子目录。Playwright通过 `PLAYWRIGHT_MODULE_PATH` 指向已安装的测试运行库；没有加入生产依赖。

## 边界与后续

仅支持阿拉伯数字加%/％的单条百分比；精度按原引擎规则严格比较，差异使用百分点。自动复核只允许原句中所选百分比变化，**其余文字的任何改变，包括可能不影响含义的标点或空格，也会保守转待人工核验**。改变对象、期间、指标或范围需重新建立核验依据，不能勾选确认绕过。当前规则与原依据方案变化时，也要求先建立新核验；未开发自动语义映射。

没有实现整篇自动改写、文件版本系统、批量修订、PDF/DOCX/XLSX导出、对话分析、图像核验、外网部署或新模型调用。导出区域保持禁用并说明原因。当前仅本机Chrome桌面与390px验收，没有执行Safari、真实移动设备或多人压力测试。全站其余页面未重做。

## 本地启动

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\backend'
& '.\.venv\Scripts\python.exe' -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

另一个PowerShell：

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\frontend'
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

保留原backend/.env及data，不需要清库或重配模型。只能运行一个后台实例。本次提交和远程同步结果在交付消息提供；不推送数据库、会话、密钥、原件或artifacts。
