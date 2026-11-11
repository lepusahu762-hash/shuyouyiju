# 数有依据后台 · v0.3

运行方法、Python 环境和完整配置见[仓库 README](../README.md)。该目录使用项目 `.venv`，SQLite 和原件默认在 `data/`。启动创建所需数据表；本轮为初始数据库结构，后续改变结构应加入迁移脚本，不能把 `create_all` 当作迁移机制。

## 代码与持久化

- `config.py`：`SYJ_` 环境变量，自动读取本目录 `.env`，数据目录与解析限制。
- `auth.py`：FastAPI Users + SQLAlchemy 用户库 + DatabaseStrategy 会话，Argon2id 密码哈希。邮箱统一小写并去除前后空格；密码 8–72 字符且包含英文字母和数字。
- `models.py` / `database.py`：用户、访问令牌、项目、资料模型；SQLite WAL、外键和 busy timeout。
- `projects.py`：项目归属校验、创建、检索、重命名和版本化规则保存。
- `materials.py`：受保护的上传、原件下载、状态、分页预览、重试、字段说明。
- `parsers.py`：只读 CSV/XLSX/DOCX/粘贴文本解析；ZIP、XML、行列、字符和容量限制。
- `main.py`：应用工厂、生命周期、错误清理、Origin/自定义头校验及注册登录限频。

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

未提供邮件验证、找回密码、第三方登录、AI 或计算接口。原件目录没有被挂载为公开静态目录。

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
