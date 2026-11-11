# 数有依据 v0.3：真实账户、工作空间与资料持久化

交付日期：2026-11-11（Asia/Shanghai）。原仓库：`D:\Desktop\chuanzhibei\shuyouyiju`。本轮沿用原 `frontend/`，在根目录新增 `backend/`，没有新建第二套前端。已读取产品 MD、根 README、前端 README、HOMEPAGE_PREVIEW.md 以及实际代码后增量实现。

## 可运行预览

- 开发首页：<http://127.0.0.1:5173/>
- 真实注册／登录：<http://127.0.0.1:5173/auth>
- 工作空间：<http://127.0.0.1:5173/app>
- 生产构建预览：<http://127.0.0.1:4173/>
- 后台健康检查：<http://127.0.0.1:8000/api/health>

交付时本地服务正在运行。建议注册自己的测试账户；验收截图中的账户和数据是本次创建的合成测试记录。后台未接通邮件验证，不会发送邮件，不显示虚假邮件发送提示。关闭服务后的 Windows PowerShell 启动和安装说明见 [README.md](README.md)。

## 已完成模块

1. FastAPI + SQLite 持久化：账户、可撤销会话、项目、文件元数据、解析结果、字段说明、统计规则；原文件独立保存。项目虚拟环境 Python 3.13.11，完整依赖锁定与 `.env.example` 已整理。
2. 现有 `/auth` 接通 FastAPI Users 15.0.5：注册、登录、当前账户、退出；Argon2id 密码哈希；HttpOnly/SameSite Cookie；后台逐请求检查归属。未登录保留合法内部返回目标，拒绝外部跳转。
3. `/app` 工作空间：空状态、真实项目列表、名称、目标、创建／修改时间、资料数；新建、搜索、重命名、打开；分析数据和核验报告两种目标。
4. `/app/projects/:projectId/materials`：桌面左侧列表、中间预览、右侧字段及口径；平板重排；手机三视图切换。表格与报告预览分页，表格自身滚动。
5. CSV/XLSX 上传与解析、工作表选择、真实列名／行数／预览；DOCX 正文与表格段落定位；粘贴报告保存；上传进度、等待／解析／成功／失败状态，单个失败文件重试。
6. 空值、重复／空表头等明确数据问题，保留原始值，用户记录处理决定；字段含义、单位及统计口径真实保存，冲突返回错误并保留输入。
7. 原件 UUID、SHA-256、行／列／段落稳定来源 ID、受保护的原件下载，给下一阶段的证据计算与原文定位预留关联。
8. 首页 FAQ 与认证提示同步当前能力；原首页示例与真实工作流程保持清楚边界。

## 实际检查结果

构建与视觉检查分别执行：

| 检查 | 实际结果 |
| --- | --- |
| TypeScript + Vite 生产构建 | 通过；JS gzip 90.83 kB，CSS gzip 13.99 kB |
| 前端 lint | 通过，无错误或警告 |
| 后台 pytest | 5 项通过，含多组权限、持久化、解析和错误断言；1 条依赖弃用警告 |
| 浏览器真实工作流程 | 55 项断言通过 |
| 真正停止／重启后台后的复核 | 8 项通过；服务进程从 4964 更换为 27348，同一个 data 目录 |
| 首页／认证公开页面回归 | 90 项通过，涵盖示例交互、锚点、输入校验、返回入口和响应式 |
| 生产构建预览 | 9 项通过，涵盖真实 API 代理、会话、公开／私有路径直接进入及刷新 |
| 响应式测量 | 320、390、768、1024、1440 px；工作区和资料页无页面级横向溢出，数据表自身滚动 |
| 实际截图检查 | Chrome 157.0.8103.40；已查看桌面工作空间、CSV/XLSX/DOCX 预览、平板资料页、手机预览／规则页及登录页，未见文字重叠 |

测试包含：注册 → 登录 → 退出 → 错误密码 → 重复邮箱 → 再次登录；项目创建／搜索／改名；两个目标；上传 CSV、双工作表 XLSX、DOCX；粘贴正文；字段和规则保存后刷新；损坏 XLSX 失败及单独重试；未支持 PDF 提示；接口不可用及恢复重试；第二账户对项目、文件、预览、原件下载和写接口的拒绝访问；HttpOnly Cookie 与退出后的服务端令牌撤销。

重启验证使用真正停止并重新启动的 Uvicorn 进程，未清空 SQLite。检查会话仍有效、项目名与资料数保留、口径和字段保留、DOCX 段落 ID 与正文一致、原 CSV 下载字节完全相同，并重新直接访问／刷新工作空间和项目路径。

测试文件预期与实际相符：CSV 3 行 3 列，有重复“人数”表头和 B3 空值；XLSX“学院调查”3 行、“备注”1 行；DOCX 提取 4 个非空正文／表格段落，含跳过空段后保留的 `body:4`；粘贴两段文本保留 `line:1` 与 `line:3`。

后台唯一警告：`StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated; install httpx2 instead.` 这是当前依赖 TestClient 的弃用提醒，5 项测试均通过。没有宣称后台测试无警告。

本轮未执行公网部署、多进程／多机负载测试、大规模性能测试及真实邮件验证；这些不属于当前已接通能力。默认按本机单个后台进程运行，格式与容量边界见 README。

## 截图与检查输出

截图已复制到原仓库 `artifacts/`，不提交用户资料或会话到 Git。

- [工作空间·桌面](artifacts/workspace/workspace-1440.png)
- [工作空间·手机](artifacts/workspace/workspace-390.png)
- [空工作空间](artifacts/workspace/workspace-empty.png)
- [资料页·桌面 XLSX](artifacts/workspace/materials-1440.png)
- [CSV 空值与重复表头](artifacts/workspace/materials-csv-desktop.png)
- [DOCX 段落与来源](artifacts/workspace/materials-report-desktop.png)
- [资料页·平板](artifacts/workspace/materials-768.png)
- [资料预览·手机](artifacts/workspace/materials-390.png)
- [资料列表·手机](artifacts/workspace/materials-files-mobile.png)
- [字段与规则·手机](artifacts/workspace/materials-rules-mobile.png)
- [登录页](artifacts/public-v03/login-1440.png)
- [注册页](artifacts/public-v03/register-1440.png)
- [当前完整首页](artifacts/public-v03/homepage-1440.png)
- [工作流程断言结果](artifacts/workspace/seed-checks.json)、[重启复核](artifacts/workspace/restart-checks.json)、[进程重启记录](artifacts/workspace/restart-evidence.json)、[生产预览检查](artifacts/workspace/production-checks.json)、[公开页面回归](artifacts/public-v03/checks.json)。

复现脚本保留在 `frontend/scripts/` 与 `backend/scripts/`。测试账户、会话文件及 SQLite 不提交。截图展示的是合成验收数据，不是预设业务假结果。

## 提交记录

- `2b174a4`：记录原完整首页和认证界面基线。
- `d43c851`：真实账户、持久会话与私有项目后台。
- `639e58e`：原件保存、解析来源、资料状态与字段规则接口。
- `6e2e87c`：前端真实认证、工作空间和资料页。
- 本报告与验收脚本另存于最终 `test/docs` 提交，可用 `git log -5 --oneline` 查看。

仓库原先没有配置提交身份，本轮仅在提交命令中使用 `Codex <codex@local.invalid>`，未改全局 Git 配置，未推送远端。

## 待接通

计算引擎、真实 AI 问答、规则检索、结论核验、修订复核和交付仍在开发；本轮只保存后续所需输入和来源关联。邮件验证、找回密码、第三方登录、PDF/OCR、XLS、完整历史版本、原文编辑和导出尚未实现，不展示成功结果。字段和口径由用户人工填写，不自动猜测，不自动修改原文件。
