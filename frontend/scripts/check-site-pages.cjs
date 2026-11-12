// Read-only route and responsive regression. Optional QA_SITE_SAVED_RUN points
// to a prior synthetic run and its adjacent session.json; no model or write calls.
// Run with PLAYWRIGHT_MODULE_PATH and BROWSER_EXECUTABLE when they are not on PATH.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5173';
const output = path.resolve(process.env.QA_SITE_OUTPUT || path.join(__dirname, '../../artifacts/site-pages'));
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };

async function expectNoOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    viewport: innerWidth,
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  check(`${label} 页面无横向溢出`, dimensions.client === dimensions.scroll);
  return dimensions;
}

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const runtimeErrors = [];
  const writes = [];
  const layouts = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  page.on('request', request => { if (request.method() !== 'GET' && request.method() !== 'HEAD') writes.push(request.method()); });

  try {
    const publicPages = [
      { route: '/', selector: '#hero-title', name: '首页' },
      { route: '/cases', selector: '.site-page-heading h1', name: '案例体验' },
      { route: '/guide', selector: '.site-page-heading h1', name: '使用帮助' },
      { route: '/auth', selector: '#auth-title', name: '登录注册' },
    ];

    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: width < 680 ? 844 : 1000 });
      for (const route of publicPages) {
        await page.goto(base + route.route);
        await page.locator(route.selector).waitFor({ state: 'visible' });
        await page.evaluate(() => document.fonts.ready);
        const dimensions = await expectNoOverflow(page, `${route.name} ${width}px`);
        layouts.push({ route: route.route, width, ...dimensions });

        if (route.route === '/cases') {
          await page.screenshot({ path: path.join(output, `cases-${width}.png`), fullPage: true });
          if (width === 390) {
            check('手机公共导航保持可见', await page.locator('.compact-public-nav').isVisible());
            await page.getByRole('button', { name: /经营月报/ }).click();
            check('案例切换更新预览内容', (await page.locator('.case-preview h2').innerText()) === '经营月报');
          }
        }
        if (route.route === '/guide') {
          if (width === 1440 || width === 390) await page.screenshot({ path: path.join(output, `guide-${width}.png`), fullPage: true });
          if (width === 390) {
            await page.getByRole('tab', { name: '使用边界', exact: true }).click();
            check('帮助分类页签切换内容', (await page.locator('.guide-content h2').innerText()) === '使用边界');
          }
        }
        if (route.route === '/' && width === 1440) await page.screenshot({ path: path.join(output, 'homepage-1440.png'), fullPage: true });
        if (route.route === '/' && width === 390) {
          await page.getByRole('button', { name: '打开导航菜单', exact: true }).click();
          check('手机首页菜单含案例和帮助入口', await page.locator('#mobile-nav a[href="/cases"]').isVisible() && await page.locator('#mobile-nav a[href="/guide"]').isVisible());
          await page.getByRole('button', { name: '关闭导航菜单', exact: true }).click();
          check('手机首页菜单可收起', await page.locator('#mobile-nav').count() === 0);
        }
        if (route.route === '/auth' && (width === 1440 || width === 390)) {
          await page.screenshot({ path: path.join(output, `auth-${width}.png`), fullPage: true });
          if (width === 390) {
            await page.reload();
            await page.locator('#auth-form').waitFor({ state: 'visible' });
            check('登录页直接刷新正常', await page.locator('#auth-title').isVisible());
          }
        }
      }
    }

    const projectId = '11111111-1111-4111-8111-111111111111';
    const taskId = '22222222-2222-4222-8222-222222222222';
    const runId = '33333333-3333-4333-8333-333333333333';
    const assetId = '44444444-4444-4444-8444-444444444444';
    const paragraphId = `${assetId}:v1:body:10`;
    const projectPath = `/app/projects/${projectId}`;
    const targets = [
      ['/app', '/app'],
      ['/app/templates', '/app/templates'],
      ['/app/me', '/app/me'],
      [`${projectPath}/materials`, `${projectPath}/materials`],
      [`${projectPath}/materials?asset=${assetId}&paragraph=${encodeURIComponent(paragraphId)}&offset=50`, `${projectPath}/materials?asset=${assetId}&paragraph=${encodeURIComponent(paragraphId)}&offset=50`],
      [`${projectPath}/materials?asset=${assetId}&sheet=s1&row=10`, `${projectPath}/materials?asset=${assetId}&row=10&sheet=s1`],
      [`${projectPath}/analysis`, `${projectPath}/analysis`],
      [`${projectPath}/calculations?run=${runId}#calculation-history`, `${projectPath}/calculations?run=${runId}#calculation-history`],
      [`${projectPath}/verify`, `${projectPath}/verify`],
      [`${projectPath}/ai-verification?task=${taskId}`, `${projectPath}/ai-verification?task=${taskId}`],
      [`${projectPath}/review`, `${projectPath}/review`],
    ];
    for (const [target, expected] of targets) {
      await page.goto(base + target);
      await page.locator('#auth-title').waitFor({ state: 'visible' });
      const url = new URL(page.url());
      check(`未登录访问 ${target.split('?')[0]} 保留白名单返回目标`, url.pathname === '/auth' && url.searchParams.get('next') === expected);
    }

    if (process.env.QA_SITE_SAVED_RUN) {
      const savedPath = path.resolve(process.env.QA_SITE_SAVED_RUN);
      const { pid, tid } = JSON.parse(fs.readFileSync(savedPath, 'utf8'));
      assert.ok(pid && tid, '合成任务元数据必须含项目和任务ID');
      const privateContext = await browser.newContext({ storageState: path.join(path.dirname(savedPath), 'session.json'), reducedMotion: 'reduce' });
      const privatePage = await privateContext.newPage();
      privatePage.on('pageerror', error => runtimeErrors.push(error.message));
      privatePage.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.method()); });
      await privatePage.route('**/api/**', route => ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.abort());
      const response = await privateContext.request.get(`${base}/api/ai-tasks/${tid}`);
      assert.equal(response.status(), 200, '需要有效的合成演示会话');
      const before = await response.json();
      assert.ok(before.run_id, '回看任务必须已有保存结果，不创建新任务');
      const root = `/app/projects/${pid}`;
      const pages = [
        ['/app', 'workspace', '.projects-toolbar'],
        ['/app/templates', 'templates', '.template-grid'],
        ['/app/me', 'personal', '.personal-panel'],
        [`${root}/materials`, 'materials', '.material-columns'],
        [`${root}/analysis?run=${before.run_id}`, 'analysis', '.result-card'],
        [`${root}/verify?task=${tid}`, 'verify', '.ai-result'],
        [`${root}/review`, 'review', '.review-layout'],
      ];
      for (const width of [1440, 768, 390]) {
        await privatePage.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
        for (const [route, name, selector] of pages) {
          await privatePage.goto(base + route);
          await privatePage.locator(selector).waitFor({ state: 'visible' });
          await privatePage.evaluate(() => document.fonts.ready);
          layouts.push({ route, width, ...await expectNoOverflow(privatePage, `${name} ${width}px`) });
          if (route.startsWith(root)) {
            check(`${name} ${width}px 四个项目页签可用`, await privatePage.locator('.project-nav a').count() === 4);
            check(`${name} ${width}px 当前页签明确`, await privatePage.locator('.project-nav [aria-current="page"]').count() === 1);
          }
          await privatePage.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: true });
          if (width === 1440 && name === 'verify') {
            check('桌面核验分为报告、事项和证据三个区域', await privatePage.locator('.ai-workspace').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length === 3));
            await privatePage.locator('.ai-evidence-card').screenshot({ path: path.join(output, 'verify-result-detail.png') });
          }
          if (width === 390 && ['analysis', 'verify', 'review'].includes(name)) {
            await privatePage.screenshot({ path: path.join(output, `${name}-390-top.png`) });
            if (name === 'verify') {
              // Give a tall evidence card enough paint area for a complete detail capture.
              // The actual responsive assertions above use the 390x844 viewport.
              await privatePage.setViewportSize({ width: 390, height: 1200 });
              await privatePage.locator('.ai-evidence-card').screenshot({ path: path.join(output, 'verify-result-390-detail.png') });
              await privatePage.setViewportSize({ width: 390, height: 844 });
            }
          }
        }
      }
      await privatePage.goto(base + `/app/templates`);
      await privatePage.getByRole('button', { name: '月度报表', exact: true }).click();
      check('模板分类过滤可用', await privatePage.locator('.template-item').count() === 1);
      await privatePage.locator('.template-item summary').click();
      check('模板结构可展开', await privatePage.locator('.template-item details').getAttribute('open') !== null);
      check('未接通的模板操作禁用', !(await privatePage.getByRole('button', { name: '使用模板', exact: true }).isEnabled()));
      await privatePage.goto(base + '/app/me');
      await privatePage.getByRole('tab', { name: '导出记录', exact: true }).click();
      check('个人空间不伪造导出记录', (await privatePage.locator('.personal-panel').innerText()).includes('不会显示虚构记录'));
      await privatePage.goto(base + `${root}/review`);
      await privatePage.locator('.review-layout').waitFor();
      check('修订保存与导出操作禁用', !(await privatePage.getByRole('button', { name: '保存修订', exact: true }).isEnabled()) && !(await privatePage.getByRole('button', { name: '预览并导出', exact: true }).isEnabled()));
      for (const label of ['资料与口径', '数据分析', '结论核验', '修改与交付']) {
        await privatePage.locator('.project-nav').getByRole('link', { name: new RegExp(label) }).click();
        await privatePage.locator('.project-nav [aria-current="page"]').waitFor();
        check(`项目页签点击进入${label}`, (await privatePage.locator('.project-nav [aria-current="page"]').innerText()).includes(label));
      }
      for (const [route, , selector] of pages) {
        await privatePage.goto(base + route); await privatePage.reload();
        await privatePage.locator(selector).waitFor();
        check(`${route.split('?')[0]} 直接访问及刷新`, true);
      }
      await privatePage.goto(base + `${root}/calculations?run=${before.run_id}`);
      await privatePage.locator('.result-card').waitFor();
      check('旧计算运行链接保留原结果', (await privatePage.locator('.computed-value').innerText()).includes(before.run.result.display_value));
      await privatePage.goto(base + `${root}/ai-verification?task=${tid}`);
      await privatePage.locator('.ai-result').waitFor();
      check('旧AI任务链接恢复已保存结果', (await privatePage.locator('.ai-result').innerText()).includes(before.check.result.calculated_value));
      const reportLink = await privatePage.locator('.ai-source-location').getAttribute('href');
      await privatePage.goto(base + reportLink);
      await privatePage.locator('.linked-source-paragraph').waitFor();
      check('报告原句定位继续可用', true);
      await privatePage.goto(base + `${root}/verify?task=${tid}`);
      await privatePage.getByRole('tab', { name: '规则原文', exact: true }).click();
      const ruleLink = await privatePage.locator('.ai-rule > a').first().getAttribute('href');
      await privatePage.goto(base + ruleLink);
      await privatePage.locator('.linked-source-paragraph').waitFor();
      check('规则原文定位继续可用', true);
      await privatePage.goto(base + `${root}/verify?task=${tid}`);
      await privatePage.getByRole('tab', { name: '原始数据', exact: true }).click();
      await privatePage.getByRole('button', { name: '定位源行 10', exact: true }).click();
      const rowLink = await privatePage.locator('.record-focus a').getAttribute('href');
      await privatePage.goto(base + rowLink);
      await privatePage.locator('.linked-source-row').waitFor();
      check('原始空值行定位继续可用', true);
      await privatePage.getByRole('button', { name: '字段与规则', exact: true }).click();
      await privatePage.locator('.rule-library input').first().waitFor();
      check('资料页规则资料指定读取真实状态', await privatePage.locator('.rule-library input:checked').count() === 1);
      const after = await (await privateContext.request.get(`${base}/api/ai-tasks/${tid}`)).json();
      check('回看未改变模型请求数、结果、规则与调用记录', before.request_count === after.request_count && JSON.stringify(before.payload) === JSON.stringify(after.payload) && JSON.stringify(before.trace) === JSON.stringify(after.trace) && JSON.stringify(before.check) === JSON.stringify(after.check));
      await privateContext.close();
    }
    check('没有触发写接口', writes.length === 0);
    check('没有前端运行时异常', runtimeErrors.length === 0);
    const report = { checkedAt: new Date().toISOString(), base, browser: await browser.version(), checks, layouts, runtimeErrors, writes };
    fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(report, null, 2));
    console.log(`PASS: ${checks.length} checks. Screenshots and report: ${output}`);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  console.error(`Completed ${checks.length} checks before failure`);
  process.exitCode = 1;
});
