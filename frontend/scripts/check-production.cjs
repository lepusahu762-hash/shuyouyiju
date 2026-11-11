// Start npm run preview (4173). Reuses only this QA run's test session.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(process.env.QA_OUTPUT || path.join(__dirname,'../../artifacts/workspace'));
const base=process.env.PRODUCTION_URL || 'http://127.0.0.1:4173';
(async()=>{
 const state=JSON.parse(fs.readFileSync(path.join(out,'run.json')));
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 const checks=[];
 try {
  const context=await browser.newContext({storageState:path.join(out,'session.json')});const page=await context.newPage();
  const response=await context.request.get(base+'/api/auth/me');assert.equal(response.status(),200);checks.push('生产预览 API 代理和 HttpOnly 会话正常');
  for(const width of [390,1440]) {
   await page.setViewportSize({width,height:900});
   for(const [route,selector] of [['/app','.projects-table'],[state.route,'.material-columns']]) {
    await page.goto(base+route);await page.locator(selector).waitFor();await page.reload();await page.locator(selector).waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));checks.push(`${width}px ${route} 生产路由直接访问/刷新及页面宽度正常`);
   }
  }
  const publicContext=await browser.newContext();const publicPage=await publicContext.newPage();
  for(const [route,selector] of [['/','#hero-title'],['/auth','#auth-title'],['/auth?mode=register','#confirm']]) {await publicPage.goto(base+route);await publicPage.locator(selector).waitFor();await publicPage.reload();await publicPage.locator(selector).waitFor();checks.push(route+' 生产公开路由和刷新正常');}
  await publicPage.goto(base+state.route);await publicPage.waitForURL('**/auth?next=*');assert.equal(new URL(publicPage.url()).searchParams.get('next'),state.route);checks.push('生产私有路由跳登录并保留返回目标');
  fs.writeFileSync(path.join(out,'production-checks.json'),JSON.stringify({checkedAt:new Date().toISOString(),base,checks},null,2));console.log(`PASS: ${checks.length} production checks`);
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
