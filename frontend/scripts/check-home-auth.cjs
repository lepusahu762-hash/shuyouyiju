// Run with PLAYWRIGHT_MODULE_PATH pointing to an installed Playwright package,
// or install Playwright in your development environment. No production dependency.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5173';
const out = path.resolve(process.env.QA_PUBLIC_OUTPUT || path.join(__dirname, '../artifacts/home-auth'));
const results = [];
function check(name, condition) { assert.ok(condition, name); results.push(name); }
async function main() {
 fs.mkdirSync(out, {recursive:true});
 const browser = await chromium.launch({headless:true, ...(process.env.BROWSER_EXECUTABLE ? {executablePath:process.env.BROWSER_EXECUTABLE} : {})});
 const context = await browser.newContext({viewport:{width:1440,height:1000}, reducedMotion:'reduce'});
 const page = await context.newPage();
 const errors = []; const consoleErrors = []; const submissions = [];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error') consoleErrors.push(m.text())});
 page.on('request',r=>{if(r.method()==='POST'||r.resourceType()==='fetch'||r.resourceType()==='xhr')submissions.push(r.url())});
 const text = selector => page.locator(selector).innerText();
 try {
  await page.goto(base);
  check('首页所有内容区按顺序出现', (await page.locator('main > section').evaluateAll(nodes=>nodes.map(n=>n.id||'cta').join(',')))==='top,analysis,verification,evidence,review,cases,faq,cta');
  const brokenAnchors=await page.locator('a[href^="#"]').evaluateAll(nodes=>nodes.filter(n=>!document.getElementById(n.hash.slice(1))).map(n=>n.hash));
  check('所有首页锚点目标存在',brokenAnchors.length===0);
  for(const id of ['analysis','verification','evidence','demo','review','cases','faq']) {
   await page.evaluate(id=>{location.hash=id},id);
   await page.waitForFunction(id=>{const el=document.getElementById(id);return el.getBoundingClientRect().top>=document.querySelector('.site-header').getBoundingClientRect().bottom},id);
   check(`${id} 锚点未被导航遮挡`,true);
  }
  await page.getByRole('button',{name:'有效答题有多少？',exact:true}).click();
  check('示例问题切换为人数图表',(await text('.chart-heading')).includes('有效答题数'));
  await page.getByRole('button',{name:'查看A 学院计算依据：60份',exact:true}).click();
  check('人数图表与依据联动',(await text('.chart-basis')).includes('60 份'));
  await page.getByRole('button',{name:'各学院满意率？',exact:true}).click();
  await page.getByRole('button',{name:'查看C 学院计算依据：77.14%',exact:true}).click();
  check('图表与公式共享满意率计算',(await text('.chart-basis')).includes('54 ÷ 70 = 77.14%'));
  await page.locator('.report-sentence').nth(1).click();
  check('报告第二句显示缺少依据',(await text('.finding-float')).includes('还缺一份依据'));
  await page.locator('.report-sentence').nth(0).click();
  check('报告第一句显示分母差异',(await text('.finding-float')).includes('80%'));
  for(const [scope,value] of [['全校','80%'],['A 学院','75%'],['B 学院','90%'],['C 学院','77.14%']]) {
   await page.getByLabel('证据统计范围').selectOption(scope);
   check(`${scope} 数值正确`,(await text('.metric-main strong'))===value);
   if(scope!=='全校') {
    check(`${scope} 原句保留全校且标记待复核`,(await text('#claim-satisfaction')).includes('全校') && (await text('.result-heading')).includes('待复核'));
    check(`${scope} 仅高亮选中源行`,(await page.locator('.source-table tbody .row-linked').count())===1 && (await text('.source-table tbody .row-linked')).includes(scope));
   }
  }
  await page.locator('#claim-comparison').click();
  check('范围切换不能使缺失同比通过',(await text('#linked-evidence')).includes('证据不足') && (await text('.rule-card')).includes('两期数据'));
  await page.getByRole('button',{name:'重置示例',exact:true}).click();
  check('重置恢复全校80%及差异状态',(await text('.metric-main strong'))==='80%' && (await text('.result-heading')).includes('存在差异'));
  await page.locator('#claim-sample').click();
  check('样本结论显示200和180及一致状态',(await text('.sample-metrics')).includes('200') && (await text('.sample-metrics')).includes('180') && (await text('.result-heading')).includes('与数据一致'));
  check('样本联动至纳入规则',(await text('.rule-card')).includes('样本纳入规则'));
  await page.getByRole('button',{name:'接受修改',exact:true}).click();
  check('接受修改进入待复核',(await text('.revision-action')).includes('待复核') && !(await text('.revision-action')).includes('一致'));
  await page.getByRole('button',{name:'复核示例',exact:true}).click();
  check('复核后显示本地计算结果',(await text('.revision-feedback')).includes('144 ÷ 180 = 80%') && (await text('.revision-action')).includes('与示例数据一致'));
  check('缺失同比仍未解决',(await text('.review-demo .sample-note')).includes('仍然证据不足'));
  await page.getByRole('button',{name:'重置修订',exact:true}).click();
  check('修订可以重新体验',await page.getByRole('button',{name:'接受修改',exact:true}).isVisible());
  await page.getByRole('button',{name:'体验经营月报',exact:true}).click();
  check('经营月报展示20%增长',(await text('.case-answer')).includes('20%'));
  await page.getByRole('button',{name:'占比变化',exact:true}).click();
  check('占比切换显示10个百分点',(await text('.case-answer')).includes('10 个百分点'));
  await page.keyboard.press('Escape');
  check('Escape关闭案例并归还焦点',await page.getByRole('button',{name:'体验经营月报',exact:true}).evaluate(el=>el===document.activeElement));
  await page.getByRole('button',{name:'体验活动反馈',exact:true}).click();
  check('加权整体满意率76%',(await text('.case-answer')).includes('76%'));
  await page.getByRole('button',{name:'直接平均比例',exact:true}).click();
  check('直接平均80%同时显示差异',(await text('.case-answer')).includes('80%') && (await text('.case-dialog .status')).includes('不能代表整体'));
  await page.getByRole('button',{name:'返回首页案例',exact:true}).click();
  await page.getByRole('button',{name:'体验校园调查',exact:true}).click();
  check('校园案例定位可操作证据区',await page.locator('#demo').evaluate(el=>el===document.activeElement));
  for(const faq of await page.locator('.faq-list summary').all()) {await faq.click();check('FAQ可展开说明',(await faq.locator('..').getAttribute('open'))!==null);await faq.click();}

  await page.getByRole('link',{name:'新建我的项目',exact:true}).first().click();
  check('新建项目进入独立auth页',new URL(page.url()).pathname==='/auth');
  await page.reload();
  check('auth直接刷新正常',await page.locator('#auth-form').isVisible());
  await page.locator('.auth-submit').click();
  check('空表单提示邮箱和密码错误',(await page.locator('.field-error').count())===2);
  check('首个错误字段获得焦点',await page.locator('#email').evaluate(el=>el===document.activeElement));
  await page.getByLabel('邮箱',{exact:true}).fill('invalid');
  await page.getByLabel('密码',{exact:true}).fill('Example123');
  await page.locator('.auth-submit').click();
  check('邮箱格式错误就地显示',(await text('#email-error')).includes('完整邮箱'));
  await page.getByLabel('邮箱',{exact:true}).fill('demo@example.com');
  await page.getByRole('button',{name:'显示密码',exact:true}).click();
  check('显示密码开关有效',(await page.locator('#password').getAttribute('type'))==='text');
  await page.getByRole('button',{name:'隐藏密码',exact:true}).click();
  await page.getByRole('group',{name:'登录或注册'}).getByRole('button',{name:'注册',exact:true}).click();
  check('注册切换保留邮箱并清除密码',(await page.locator('#email').inputValue())==='demo@example.com' && (await page.locator('#password').inputValue())==='');
  await page.locator('#password').fill('123');await page.locator('#confirm').fill('456');await page.locator('.auth-submit').click();
  check('注册短密码和不匹配校验',(await text('#password-error')).includes('8–72') && (await text('#confirm-error')).includes('不一致'));
  await page.locator('#password').fill('abcdefgh');await page.locator('#confirm').fill('abcdefgh');await page.locator('.auth-submit').click();
  check('注册密码字母数字组合校验',(await text('#password-error')).includes('英文字母和数字'));
  await page.locator('#password').fill('Example123');await page.locator('#confirm').fill('Example123');
  await page.getByRole('button',{name:'显示确认密码',exact:true}).click();
  check('确认密码显示开关有效',(await page.locator('#confirm').getAttribute('type'))==='text');
  check('表单未将密码写入浏览器存储',await page.evaluate(()=>localStorage.length===0 && sessionStorage.length===0));
  await page.reload();
  check('注册模式刷新保留，字段不持久化',await page.locator('#confirm').isVisible() && (await page.locator('#email').inputValue())==='');
  await page.getByRole('link',{name:'体验示例',exact:true}).click();
  check('认证页返回示例锚点',new URL(page.url()).hash==='#demo');
  await page.goBack();
  check('浏览器后退回到注册页',await page.locator('#confirm').isVisible());
  await page.getByRole('link',{name:'返回首页',exact:true}).click();
  await page.locator('#hero-title').waitFor();
  check('返回首页正常',new URL(page.url()).pathname==='/' && await page.locator('#hero-title').isVisible());
  await page.getByRole('link',{name:'登录',exact:true}).click();
  await page.locator('#auth-title').waitFor();
  check('导航登录入口正常',await page.locator('#auth-title').isVisible());

  const layouts=[];
  for(const width of [320,390,768,1024,1440]) {
   await page.setViewportSize({width,height:width<680?844:1000});
   for(const [route,name] of [['/','homepage'],['/auth','login'],['/auth?mode=register','register']]) {
    await page.goto(base+route);await page.locator(name==='homepage'?'#hero-title':'#auth-title').waitFor();await page.evaluate(()=>document.fonts.ready);
    const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    check(`${name} ${width}px 无横向溢出`,dimensions.width===dimensions.scroll);layouts.push({route,...dimensions});
    if([390,768,1440].includes(width))await page.screenshot({path:path.join(out,`${name}-${width}.png`),fullPage:true});
    if(name==='homepage' && width===1440){for(const id of ['analysis','verification','evidence','review'])await page.locator('#'+id).screenshot({path:path.join(out,`${id}-detail.png`)});}
   }
  }
  for(const width of [320,390,768,1024]) {
   await page.setViewportSize({width,height:900}); await page.goto(base);
   await page.locator('.report-sentence').nth(1).click({timeout:3000});
   check(`${width}px叠层未遮挡报告句子`,(await text('.finding-float')).includes('还缺一份依据'));
   await page.getByRole('button',{name:'接受修改',exact:true}).click();
   check(`${width}px修改操作可用`,(await text('.revision-action')).includes('待复核'));
  }
  await page.setViewportSize({width:390,height:844});await page.goto(base);
  await page.getByRole('button',{name:'打开导航菜单'}).click();
  check('手机菜单可展开',await page.locator('#mobile-nav').isVisible());
  await page.locator('#mobile-nav').getByRole('link',{name:'证据追溯',exact:true}).click();
  check('手机锚点跳转并关闭菜单',!await page.locator('#mobile-nav').count() && new URL(page.url()).hash==='#evidence');
  await page.locator('#claim-comparison').click();await page.getByRole('button',{name:'查看对应依据'}).click();
  check('手机可定位对应证据',await page.locator('#linked-evidence').evaluate(el=>el===document.activeElement));
  await page.getByRole('button',{name:'体验活动反馈',exact:true}).click();
  check('手机弹窗无横向溢出',await page.locator('.case-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth));
  await page.keyboard.press('Escape');
  check('减少动画偏好已生效',await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches && getComputedStyle(document.documentElement).scrollBehavior==='auto'));
  await page.goto(base+'/not-a-page');
  check('未知路由有返回入口',await page.getByRole('link',{name:'返回首页',exact:true}).isVisible());
  check('没有运行时错误',errors.length===0);check('控制台仅有未登录会话检查的预期401',consoleErrors.every(line=>line.includes('401 (Unauthorized)')));
  const report={checkedAt:new Date().toISOString(),base,browser:await browser.version(),checks:results,layouts,errors,consoleErrors,submissions};
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2));
  console.log(`PASS: ${results.length} checks. Screenshots and report: ${out}`);
 } finally {await browser.close();}
}
main().catch(error=>{console.error(error);console.error(`Completed ${results.length} checks before failure`);process.exitCode=1});
