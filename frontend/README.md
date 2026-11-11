# 数有依据前端 · v0.4

在原有 React + TypeScript + Vite 项目上增量开发，继续使用既有字体、蓝色按钮、首页及认证页设计。没有新建重复前端，没有引入生产依赖。

## 运行

```powershell
Set-Location 'D:\Desktop\chuanzhibei\shuyouyiju\frontend'
# 新环境首次安装
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

真实账户和项目操作需要同时启动 `../backend`。后台虚拟环境、依赖、启动及存储说明见[仓库 README](../README.md)。开发和预览的 `/api` 均代理到 `http://127.0.0.1:8000`，浏览器使用同源 HttpOnly 会话。

```powershell
npm run build
npm run lint
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

生产产物 `dist/` 需要静态托管；API 路径代理至后台，其余页面路径配置 SPA 回退。Vite dev/preview 已支持以下路径直接进入和刷新：

| 路由 | 页面 |
| --- | --- |
| `/` | 完整首页、合成示例、案例和 FAQ |
| `/auth` | 真实邮箱密码登录 |
| `/auth?mode=register` | 真实测试账户注册，未验证邮箱 |
| `/app` | 私有工作空间，项目创建、搜索、重命名和打开 |
| `/app/projects/:projectId/materials` | 私有资料与口径页 |
| `/app/projects/:projectId/calculations` | 真实记录数／比例、证据定位、单条数字核验和历史 |

私有页面先检查当前账户；未登录跳转 `/auth?next=...`，只允许白名单内部路径作为返回目标。界面保护之外，后台仍逐请求检查用户和资源归属。

## 主要文件

- `src/api.ts`：类型、接口错误、真实上传进度、合法返回路径。
- `src/components/WorkShell.tsx`：账户加载、退出和工作区壳层。
- `src/pages/WorkspacePage.tsx`：真实列表与项目表单。
- `src/pages/MaterialsPage.tsx`：资料状态轮询、工作表／分页预览、报告来源、上传和重试。
- `src/components/MaterialEditors.tsx`：字段说明、统计规则、未保存提醒、并发版本处理。
- `src/Work.css`：桌面三栏、平板重排、手机列表／预览／规则切换；表格在自身区域滚动。
- `src/pages/CalculationsPage.tsx`：紧凑计算工作区、条件确认、结果和历史；`CalculationConditions` / `CalculationEvidence` / `NumericConclusionCheck` 分别负责受控筛选、分页来源和报告比较。
- `src/calculationTypes.ts`、`src/Calculations.css`：计算类型、状态说明与工作区响应式样式。
- `src/pages/AuthPage.tsx`：真实认证接口、输入校验和测试阶段说明。
- `src/pages/HomePage.tsx` 及原示例组件：延续完整首页，FAQ 已同步当前真实能力。

上传原件不被预览和说明编辑改写。计算由后台读取完整解析数据；证据每页 25 条，报告段落每页 20 段，历史／核验每页 10 条。来源按钮可定位保存行，并跳回资料页相应分页、高亮当前原行。当前资料变化时要以旧运行的保存快照为准。

所有状态来自实际请求；接口断开不会提示已保存。修改设置自动取消确认，并提示当前结果是旧运行；重新载入口径后再确认运行。新增数据分析仅支持记录计数与比例，不调用 AI，完整报告核验与修改交付继续标注尚未接入。

## 验收

`scripts/check-workspace.cjs`：真实账户、项目、上传、规则、隔离、错误、响应式布局以及重启后的恢复。`scripts/check-home-auth.cjs`：公开首页交互、锚点、认证页校验／返回及响应式回归；已移除上轮“认证未接通”的过期断言。

Playwright 环境与命令见[后台测试说明](../backend/README.md#测试与重启复核)。本轮截图和实际结果见 [WORKSPACE_PREVIEW.md](../WORKSPACE_PREVIEW.md)。[HOMEPAGE_PREVIEW.md](HOMEPAGE_PREVIEW.md) 保留 v0.2 历史验收记录，不代表当前后台状态。

v0.4 使用 `scripts/check-calculations.cjs seed`，重启同一后台后 `node scripts/check-calculations.cjs restart`。本轮实际结果、合成材料、演示顺序和桌面／手机截图见 [CALCULATION_PREVIEW.md](../CALCULATION_PREVIEW.md)。首页未重做，本轮没有重复跑整套首页交互检查。
