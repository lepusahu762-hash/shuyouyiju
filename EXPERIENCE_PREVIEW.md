# 全站体验、视觉与性能验收 · v0.14 · 2026-11-13

本轮从原目录 `D:\Desktop\chuanzhibei\shuyouyiju`、原分支 `codex/ai-assisted-verification`、实际HEAD `e1ba0eb8978355b64aec4b945ea079d07226b407` 开始，初始工作区干净。已核对README、完整产品需求、页面与规则/分析/核验/修订相关实现。项目及祖先目录未找到AGENTS.md。沿用原React/TypeScript/Vite与FastAPI/SQLite；没有初始化新项目、修改模型配置或清库。

## 实际修复

1. **失败输入丢失**：分析提问原先在请求完成前清空。现在只有收到提交成功后才清空同一段输入，失败保留输入和重试提示；注册失败也验证保留字段。
2. **窄屏溢出**：320px个人资料列和项目header长名挤出操作按钮，现修复列最小宽度、长中文换行和手机header重复项目名；当前项目仍显示在项目上下文。表格和放大图片保留内部滚动，没有用body裁切掩盖溢出。
3. **主要层次**：模型配置、请求账本、原始JSON、来源ID和指纹收进详情；结果、问题、原文与下一步优先显示。未配置/模拟状态仍明确提示。手机按钮与页签可换行并提高触控高度。
4. **规则确认**：九项按数据指标、范围条件、空值精度分组；来源下拉缩短摘要，完整原文和连续引用可展开。勾选不自动恢复，修改值会清旧确认；后台来源/并发/冲突/失效逻辑未改。
5. **修订长文**：原稿保持只读与完整文本，长段在可聚焦、可键盘滚动区域阅读，避免手机修订操作被长原稿推远；保存/复核业务不变。
6. **能力说明**：首页、案例、帮助、工作空间明确真实支持范围。文字单条修订/PDF已接通；图片PDF、模板保存、隔离案例副本、个人汇总导出仍未接通。首页增长率、任意加权示例不能当工作区能力。
7. **导航与容错**：保留旧运行/任务/来源链接；证据和帮助页签支持方向/Home/End键。菜单/弹窗保留Escape关闭与焦点恢复。页面包加载失败显示重新加载和返回入口。

没有扩展统计方法、修订/导出后台、自动改写或其他新业务。准确的11页及八项能力表见 [RELEASE_READINESS.md](RELEASE_READINESS.md)。

## 性能：先测量，再修改

基线为本轮修改前生产构建；最终为当前生产构建。Windows本机Chrome **157.0.8103.51** headless、1440×1080、减少动效、每页三个全新浏览器context、同一后台/同组合成历史、无网络/CPU节流；测量时不并行跑其他浏览器验收。未使用Lighthouse，没有性能分数。

体积为页面实际加载的全部JS/CSS资源分别用Node gzipSync压缩后求和，单位字节；是本地压缩估算，**不是Vite preview实际线上传输量**。ready为页面特定内容选择器出现后的`performance.now()`，不是FCP、load事件或所有证据已可交互。具体资源和三次样本在本机忽略目录 `artifacts/experience-v14/perf-before.json`、`perf-after.json`；汇总为`performance-summary.json`。

| 生产页 | JS估算gzip 前→后（字节） | JS减少 | CSS估算gzip 前→后（字节） | 首次接口请求 前→后 | 内容就绪中位数 前→后（ms） | FCP中位数 前→后（ms） |
| --- | --- | --- | --- | --- | --- | --- |
| 首页 | 140096 → 81797 | 41.6% | 23546 → 9804 | 0 → 0 | 169.6 → 241.0 | 172 → 92 |
| 资料与口径 | 140096 → 94273 | 32.7% | 23546 → 23904 | 8 → 7 | 273.3 → 320.6 | 88 → 92 |
| 数据分析 | 140096 → 96825 | 30.9% | 23546 → 24963 | 11 → 11 | 392.1 → 425.9 | 88 → 104 |
| 文字核验 | 140096 → 99291 | 29.1% | 23546 → 24099 | 8 → 7 | 300.1 → 403.8 | 84 → 96 |
| 修改与交付 | 140096 → 89039 | 36.4% | 23546 → 25085 | 7 → 6 | 299.6 → 417.5 | 88 → 100 |

做了以下必要优化：

- 按路由动态导入页面，不在首页加载全部工作区代码；CSS随工作模块加载。各工作页有共享样式，分别压缩与新增可访问性样式使其CSS估算略增，保留真实结果。
- 仅合并同时发生、没有自定义options的默认GET；完成或失败后删除in-flight条目。没有长期缓存、没有合并写入、没有合并带取消信号的调用。
- 修订恢复等待选定版本后挂载导出区，避免一次初始恢复重复读取导出记录。资料/核验页的并发项目GET也消除了重复；最终抽样五页没有重复URL。
- 首次尝试React.lazy/Suspense发现页面内容出现延迟，已换成普通加载状态加动态import；失败仍由错误边界承接。中间试验保存在本地，不作为最终成绩。
- 原有行证据每页25条、分组每页20条、会话/问题每页20条、规则段落每页50条、修订/导出列表每页10条继续保留；未引入不必要的虚拟列表框架。

**可证实的是资源体积和重复请求改善，不能据此声称加载速度全面提升。** 最终三次样本就绪中位数比最初基线更慢；同一实现前一轮复测曾较快，说明本机小样本时序波动明显。首页FCP也可能先呈现加载态，不代表工作内容已就绪。新增路由资源请求也有代价。本轮保留最终不利数据，没有挑选最佳样本；未做弱网、CPU节流、真实用户交互延迟、50,000行压力测试或跨设备性能测试。

## 实际检查与结果

| 类别 | 已实际执行 | 结果/界限 |
| --- | --- | --- |
| 生产构建 | `npm run build`（TypeScript+Vite） | 通过 |
| lint | `npm run lint` | 通过 |
| 请求合并离线回归 | `node scripts/test-api.cjs` | 并发GET合并、settled重新读、失败重试、独立POST和带signal请求分别处理均通过；无网络 |
| 后台相关回归 | `test_analysis_pause.py`、`test_rule_onboarding.py` | 5项通过；含基础/分组空值暂停、旧记录不改写、直接排名、独立规则来源/确认/并发/失效/跨账户保护 |
| 全站布局 | 11业务页＋独立规则、暂停分析、图片模式，共14状态×4宽度 | 320/390/768/1440px共56组无页面横向溢出，四项目页签和当前页正确；最终长原稿调整再单独复查四宽度 |
| 生产交互 | 新合成账户真实注册、项目创建、退出重登；未登录返回规则锚点；手机菜单和示例弹窗焦点；帮助/证据键盘页签 | 通过。该账户只创建空项目，未新增AI任务或覆盖旧规则 |
| 失败反馈 | 浏览器离线注入注册503、提问503、页面JS包失败 | 输入保留、错误/重试/返回正确；这是模拟故障测试，未冒充真实模型或后台故障 |
| 生产路由/来源 | 分析直接访问刷新、选B组定位源行刷新、规则段落定位、四页签实际点击、旧calculations运行及ai-verification任务链接刷新 | 通过；已有会话、结果和引用恢复，不重算、不调用模型 |
| 规则编辑 | 原文/连续引用展开、九项未自动勾选、改值清确认 | 通过；未为截图保存新快照 |
| 既有业务回看 | 正常/暂停分析、文字任务新旧引用、图片历史、已保存修订和PDF | 使用原有只读脚本通过；已有PDF实际在生产页面渲染、下载SHA256与原记录相同，390px放大仅内部滚动，可关闭 |
| 原数据完整性 | 升级前SQLite backup逐表原行比较、原文件SHA256 | 原18张表的原行无改写/丢失；79个原件、图片预览、PDF均未变；只新增独立合成验收账户、会话和空项目 |

首次pytest默认临时目录遇Windows权限错误（3项通过、2项setup未执行），改用本轮独立`--basetemp`后5项通过；没有改权限或清理其他目录。仍有依赖Starlette/httpx的弃用警告，不影响此次用例。

本轮真实模型请求 **0次**。没有接口token用量可报告（未请求，不是接口返回0）；截图中的调用次数属于旧任务。没有修改`.env`、模型参数或后端逻辑；本轮未额外重启后台，不能把此前重启验收算作本轮执行。刷新/退出重登已实际验证。没有覆盖所有弹窗、全部屏幕阅读器/真实触控/跨浏览器，也没有重新生成/复核所有历史任务。

## 实际截图

截图均来自本机运行的生产构建、真实保存的独立合成资料/记录，未用设计稿代替。完整PNG保存在忽略的`artifacts/experience-v14`，不把账户会话、原件或私人PDF推到Git。

| 页面 | 桌面1440px | 手机390px |
| --- | --- | --- |
| 首页 | [桌面](artifacts/experience-v14/audit-final-home-1440.png) | [手机](artifacts/experience-v14/audit-final-home-390.png) |
| 资料与规则编辑 | [桌面](artifacts/experience-v14/audit-final-rules-1440.png) | [手机](artifacts/experience-v14/audit-final-rules-390.png) |
| 分组分析 | [桌面](artifacts/experience-v14/audit-final-analysis-1440.png) | [手机](artifacts/experience-v14/audit-final-analysis-390.png) |
| 暂停状态 | [桌面](artifacts/experience-v14/audit-final-paused-1440.png) | [手机](artifacts/experience-v14/audit-final-paused-390.png) |
| 文字核验 | [桌面](artifacts/experience-v14/audit-final-verify-1440.png) | [手机](artifacts/experience-v14/audit-final-verify-390.png) |
| 图片核验 | [桌面](artifacts/experience-v14/audit-final-image-1440.png) | [手机](artifacts/experience-v14/audit-final-image-390.png) |
| 修订与交付（最终长文布局） | [桌面](artifacts/experience-v14/audit-final-review-review-1440.png) | [手机](artifacts/experience-v14/audit-final-review-review-390.png) |
| 已保存PDF | 项目内受保护预览与原SHA对照已检查 | [放大预览](artifacts/experience-v14/pdf-existing-390.png) |

## 可直接照走的检查路线

当前生产预览：<http://127.0.0.1:4173/>。原开发预览：<http://127.0.0.1:5173/>。后台：<http://127.0.0.1:8000/api/health>。均仅本机地址。

1. 首页看居中首屏、交错功能区、证据示例、FAQ；手机打开菜单和案例弹窗，用Escape关闭。
2. 进入`/cases`切换示例，确认“仅示例”的增长率/任意加权边界；进入`/guide#limits`查看准确八能力表。
3. 登录`/app`，创建项目或打开原项目；确认列表数量来自账户；模板/个人空间未接通项有说明。
4. 资料与口径上传CSV/XLSX，用“补充规则说明”保存文本并指定为规则资料；点击“确认统计规则”，选表/工作表、填写条件与空值精度、逐项关联真实原文并勾选、保存快照，再进入分析。该步骤不需报告或AI核验任务。
5. **零调用回看**：打开已存在会话及已保存问题，选A/B组、对照数据表、定位源行/规则并刷新；查看暂停记录不应出现确定排名。新建问题会请求模型，本轮验收未做。
6. 结论核验回看既有文字任务与图片任务，切换比较、原始数据、规则，展开审计；勿点提取/识别/新请求。图片50%、计算40%的已有记录仍准确显示差10个百分点。
7. 修改与交付打开一条实际报告原句、目标数字和已保存版本，查看对应复核、历史和过期提示；原稿长文可内部滚动。已有PDF点“预览此PDF”，翻页、下载、关闭；读取不生成新文件。
8. 手机按同一路线检查；退出重登保留合法项目返回目标。截图/回看不需要重复调用模型。

新机器没有本机历史。合成资料可用`backend/scripts/make_analysis_demo.py`等原生成器准备，但需要通过真实用户操作建立自己的项目。当前截图只证明本机已保存记录可回看，不是评委机器已预置。

## 启动与复查

先确认已有服务，避免重复占端口。后台使用项目虚拟环境，不使用系统旧版Python：

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\backend'
& '.\.venv\Scripts\python.exe' -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

另开PowerShell启动生产预览：

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\frontend'
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

本轮脚本需要本机已保存的合成验收state（含私有会话，不提交）；`check-experience.cjs`/`check-experience-links.cjs`只读业务请求，`check-experience-interactions.cjs`另含合成注册/项目写入及本地故障注入，不要当无副作用脚本反复运行。新机器缺state会明确失败，不能伪造测试通过。实际浏览器调用依赖Playwright与本地Chrome路径，可通过`PLAYWRIGHT_MODULE_PATH`提供本机Playwright模块。

```powershell
# 在frontend，先准备本机Playwright及已保存合成状态。
node scripts/test-api.cjs
node scripts/check-experience.cjs audit-final
node scripts/check-experience-links.cjs
node scripts/check-experience.cjs perf-after
node scripts/summarize-experience.cjs

# 在backend，使用新的独立临时目录（不要复用有重要文件的目录）。
& '.\.venv\Scripts\python.exe' -m pytest tests/test_analysis_pause.py tests/test_rule_onboarding.py -q --basetemp=../artifacts/experience-v14/pytest-new-check
```

## 同步与交付边界

源码/文档按实际模块保留提交，推送前检查工作区与全可达历史的配置密钥、token/private-key模式、数据库/上传/会话文件，核对私有仓库和原分支，仅普通推送开发分支。同步结果在交付消息给出具体提交；不重写历史、不改main、不邀请评委、不公网部署。

评委访问/运行主机/模型费用安排/赛事材料格式仍需另外落实，详见 [RELEASE_READINESS.md](RELEASE_READINESS.md)。本轮不把“全站界面框架完成”表述为八项业务全部完成。
