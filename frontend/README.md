# 数有依据 · 前端

在原有 React + TypeScript + Vite 工程上开发。当前完成完整滚动首页与独立登录／注册界面，版本 v0.2，更新于 2026-11-11。

## 启动

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\frontend'
# 新环境首次运行
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

首页：<http://127.0.0.1:5173/>  
登录：<http://127.0.0.1:5173/auth>  
注册：<http://127.0.0.1:5173/auth?mode=register>

此地址仅用于本机预览。端口被占用时先检查是否已有本项目服务，不要终止未知进程。开发服务关闭后按上述命令重启。

```powershell
npm run build
npm run lint
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

生产产物位于 `dist/`。Vite 的开发与预览服务器支持 `/auth` 直接访问和刷新。部署到静态服务器时，需要将不存在的文件路径回退到 `index.html`，例如 Nginx 的 `try_files $uri $uri/ /index.html;`。尚未部署到公网。

## 当前功能

- 首页：居中首屏、数据分析、结论核验、宽幅证据追溯、修改与复核、三类案例、FAQ、最终入口、页脚。
- 预设问题切换图表，点选柱形显示对应公式。
- 点选报告原句，联动数字、来源字段与规则；切换学院后相关原句标记待复核。
- 接受修订后为待复核，用户再次操作后执行本地示例数值复核。
- 经营月报演示增长率与百分点；活动反馈演示加权与简单平均。
- `/auth`：邮箱密码登录状态；邮箱、密码、确认密码注册状态；密码显示、输入校验、错误提示、返回入口。
- 手机菜单、键盘焦点、原生可关闭对话框、减少动画偏好、未知路由返回页。

## 原型边界

首页所有材料均为合成示例。数字由 `src/demoData.ts` 中的固定材料在本地计算，解释与核验场景为预设示例。表格中的来源位置是演示材料位置，当前未读取实际 CSV 或 Word 文件。

没有调用 AI、后端核验、上传解析、邮件、认证、数据库、云端保存或导出服务。登录和注册表单只校验格式；不发送或存储邮箱与密码，不创建账户或会话，不显示成功。没有第三方登录或找回密码入口。

首页交互保留在页面内存，刷新会重置；登录／注册模式通过 URL 保留，表单内容不持久化。案例目前在首页内体验，独立案例页、工作空间和四个核心操作页不在本轮范围。

## 代码位置

- `src/App.tsx`：两个公开页面的路径分发与未知路径处理。
- `src/pages/HomePage.tsx`：首页编排、导航、FAQ、页脚。
- `src/pages/AuthPage.tsx`：认证表单与校验。
- `src/components/FeatureDemos.tsx`：分析、核验、修订演示。
- `src/components/EvidenceDemo.tsx`：结论、范围、计算、数据、规则联动。
- `src/components/Cases.tsx`：三类案例及弹窗交互。
- `src/components/ui.tsx`：共享品牌、图标、状态、文案组件。
- `src/demoData.ts`：保留上一轮校园调查数据，补充两类合成案例。
- `src/App.css`、`src/index.css`：布局、设计变量、响应式与减少动画偏好。

本轮未新增生产依赖，沿用原有包配置与锁文件。

## 浏览器验收

验收脚本：`scripts/check-home-auth.cjs`。需要开发环境提供 Playwright 和浏览器。可设置 `PLAYWRIGHT_MODULE_PATH` 指向已安装的 Playwright 包，`BROWSER_EXECUTABLE` 指向 Chrome/Chromium 可执行文件；`PREVIEW_URL` 默认为 `http://127.0.0.1:5173`。

```powershell
node scripts/check-home-auth.cjs
```

该脚本执行核心交互、表单、路由、锚点和响应式检查，并保存完整截图。截图、运行报告输出在 `artifacts/home-auth/`，已加入 Git 忽略。详细本轮交付记录见 [HOMEPAGE_PREVIEW.md](HOMEPAGE_PREVIEW.md)。
