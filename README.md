# 数有依据 · shuyouyiju

React + TypeScript + Vite 前端，Python + FastAPI 后台。当前 v0.3 已支持真实测试账户、个人项目、上传与预览资料、保存字段说明和统计口径。首页保留合成示例；计算引擎、AI、规则检索与报告核验尚未接入。

## 目录

```text
frontend/                  原有前端，继续增量开发
backend/
  app/                     认证、项目、资料 API 和只读解析器
  tests/                   持久化、解析、权限和异常测试
  scripts/make_fixtures.py  浏览器验收用的合成文件生成器
  requirements.in          直接依赖范围
  requirements.txt         本次实际安装的完整锁定版本
  .env.example             后台环境变量示例
  .venv/                   项目虚拟环境（不提交）
  data/                    SQLite + originals 原文件（不提交）
docs/shuyouyiju_product_spec_v1.md
WORKSPACE_PREVIEW.md        本轮交付与验收报告
frontend/HOMEPAGE_PREVIEW.md 上轮历史记录
artifacts/                 本地验收截图、结果、日志（不提交）
```

## Windows PowerShell 启动

已在原仓库 `D:\Desktop\chuanzhibei\shuyouyiju` 安装依赖并建立 `backend\.venv`。本机普通 `python` 指向 **Python 3.8.10**，不适合当前依赖；项目虚拟环境基于 `C:\Users\LENOVO\miniconda3\python.exe` 的 **Python 3.13.11**。请明确使用下面的虚拟环境解释器，避免调用系统旧版 Python。

终端一，启动后台：

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\backend'
& '.\.venv\Scripts\python.exe' -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

终端二，启动前端：

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\frontend'
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

- 首页：<http://127.0.0.1:5173/>
- 登录／注册：<http://127.0.0.1:5173/auth>
- 我的工作空间：<http://127.0.0.1:5173/app>
- 后台健康检查：<http://127.0.0.1:8000/api/health>
- API 文档：<http://127.0.0.1:8000/docs>

首次使用请注册自己的测试账户。邮件验证与找回密码未实现，没有邮件发送流程。端口被占用时先检查已有服务；已运行本项目时可以直接打开页面。两个终端使用 Ctrl+C 停止，不删除 `backend/data`，下次启动会继续使用原数据。请统一使用 127.0.0.1 或 localhost，两个主机名的浏览器 Cookie 不共用。

## 新机器安装

使用 Python 3.12/3.13（本次实际验证 3.13.11）及 Vite 8 支持的 Node.js 版本。以下建环境命令仅在 `.venv` 尚不存在时执行；换机器后重新创建，不复制旧虚拟环境。

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\backend'
& 'C:\Users\LENOVO\miniconda3\python.exe' -m venv .venv
& '.\.venv\Scripts\python.exe' -m pip install -r requirements.txt
# 可选：需要覆盖默认配置时复制一次，已有 .env 时先保留原配置。
Copy-Item .env.example .env
Set-Location '..\frontend'
npm ci
```

在其他电脑上，将创建虚拟环境的解释器路径换成当地 Python 3.12/3.13 的完整路径。无需执行 Activate.ps1，因此不依赖 PowerShell 激活脚本策略。

## 数据与认证

- SQLite：`backend/data/shuyouyiju.sqlite3`，存账户、服务器会话、项目、文件元数据、解析结果、字段与统计口径。
- 原件：`backend/data/originals/<资料 UUID>.<扩展名>`，上传后单独保存，SHA-256 记录完整性；预览、检查、字段说明和规则编辑不改写原件。同名上传新增资料。
- FastAPI Users 15.0.5 管理注册、密码校验和会话；密码使用库默认的 Argon2id 安全哈希。会话使用数据库策略和 HttpOnly / SameSite=Lax Cookie，默认 7 天；退出会在服务器撤销令牌。
- 每个项目、文件、预览、下载、重试和保存接口均检查当前用户归属。私有资源越权访问返回 404，未登录返回 401。写接口要求 `X-Requested-With: shuyouyiju`，校验浏览器 Origin；认证入口有本进程限频。
- 前端统一请求同源 `/api`，Vite 开发与预览代理至 `127.0.0.1:8000`。生产托管需同时配置 API 反向代理和 SPA `index.html` 回退，才能直接访问／刷新 `/auth`、`/app` 和项目深层路径。
- 当前按本机、单后台进程运行。HTTPS 环境应设置 `SYJ_COOKIE_SECURE=true` 并配置真实允许来源。当前内置解析任务和启动中断恢复按单进程设计，不要增加多个 Uvicorn worker。
- 备份应停止后台后整体复制 `backend/data`，包含 SQLite 与原件；更改 `SYJ_DATA_DIR` 会切换到另一份数据，不会自动迁移已有项目。

环境变量完整示例见 [backend/.env.example](backend/.env.example)。`.env`、虚拟环境、用户数据与验收输出已被 Git 忽略。

## 本轮能力和限制

| 材料 | 实际支持 |
| --- | --- |
| CSV | UTF-8/BOM、GB18030、UTF-16 BOM，常见分隔符；失败时可指定编码与分隔符重试；首记录作为表头 |
| XLSX | 工作表选择、列名、数据行数、分页预览；首行作为表头；公式显示原文，不执行计算 |
| DOCX | 正文和正文表格中的非空段落，保留可定位来源标识；不提取图片、文本框、页眉页脚或批注 |
| 粘贴文本 | 原文保存为 UTF-8，每个非空行建立稳定段落标识 |
| 字段与规则 | 字段含义、单位；对象范围、期间、指标定义、异常处理决定、补充说明；真实保存且有并发版本冲突提示 |
| 数据问题 | 空值及坐标、重复／空表头、不齐行、公式等可明确识别的提示；不自动清洗，不评判统计结论 |

默认每份 20 MiB，每项目 20 份，每表 50000 数据行、200 列，每文件 100 万单元格；XLSX 最多 30 个工作表。报告最多 100 万字符／20000 段；粘贴最多 20000 行。限制可在环境变量允许的范围内调整，页面上传限制读取后台真实配置。PDF、图片、XLS 和宏文件未接通。

文件使用 UUID + 内容哈希；表格行列和报告段落使用 `资料ID:v1:来源位置` 标识。新上传文件会产生新资料 ID，重试保留原 ID。本轮没有完整历史版本、原文编辑和版本对比功能。

## 检查命令

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\frontend'
npm run build
npm run lint
Set-Location '..\backend'
& '.\.venv\Scripts\python.exe' -m pytest tests -q
```

本次后台 5 项测试通过；依赖 Starlette 对当前 TestClient 使用 httpx 发出一条弃用警告，未影响测试。前端构建和 lint 通过，lint 无警告。浏览器验收方法、截图与边界见 [WORKSPACE_PREVIEW.md](WORKSPACE_PREVIEW.md) 和 [backend/README.md](backend/README.md)。

## 下一阶段

接入计算引擎、真实 AI、规则检索、结论核验、修订复核与交付。邮件验证、找回密码、PDF/OCR、完整版本历史尚未实现；页面明确显示状态。首页示例继续使用合成材料与本地演示逻辑，不会生成真实业务结果。
