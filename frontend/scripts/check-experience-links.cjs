// Production navigation / saved PDF checks. Every business write is blocked.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/experience-v14'),base=process.env.PREVIEW_URL||'http://127.0.0.1:4173';
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const normal=read('artifacts/rules-onboarding-v13/browser-run.json'),text=read('artifacts/retrieval-v10/live/browser-run.json'),pdf=read('artifacts/pdf-exports-v09/final-browser/state.json');
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),checks=[],errors=[];let writes=0;
 const check=(n,v)=>{assert.ok(v,n);checks.push(n);console.log('PASS',n)};
 async function context(dir){const c=await browser.newContext({storageState:path.join(root,'artifacts',dir,'session.json'),viewport:{width:1440,height:1080},reducedMotion:'reduce'});await c.route('**/api/**',r=>{if(r.request().method()!=='GET'){writes++;return r.abort()}return r.continue()});return c}
 try{
  const ctx=await context('rules-onboarding-v13'),page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  const route=`/app/projects/${normal.pid}/analysis?session=${normal.sid}&turn=${normal.turn}`;
  await page.goto(base+route);await page.locator('.analysis-chart').waitFor();await page.reload();await page.locator('.analysis-chart').waitFor();
  check('生产分析直达及刷新恢复会话与图表',page.url()===base+route);
  await page.getByRole('button',{name:'选择分组 B（text）',exact:true}).click();await page.locator('.analysis-evidence tbody tr').first().waitFor();
  await page.getByRole('button',{name:'定位源行 8',exact:true}).click();const source=await ctx.newPage();await source.goto(base+await page.locator('.record-focus a').getAttribute('href'));await source.locator('.linked-source-row').waitFor();await source.reload();await source.locator('.linked-source-row').waitFor();check('生产图表点击定位源行且刷新保留',true);await source.close();
  await page.getByRole('tab',{name:'规则来源',exact:true}).click();const rule=await ctx.newPage();await rule.goto(base+await page.locator('.rule-retrieval-evidence article>a').first().getAttribute('href'));await rule.locator('.linked-source-paragraph').waitFor();check('生产规则引用定位真实段落',true);await rule.close();
  const response=await ctx.request.get(base+`/api/analysis-turns/${normal.turn}`);assert.ok(response.ok());const saved=await response.json();
  await page.goto(base+`/app/projects/${normal.pid}/calculations?run=${saved.run.id}#calculation-history`);await page.locator('#calculation-result-title').waitFor();await page.reload();await page.locator('#calculation-result-title').waitFor();check('旧calculations运行链接及历史锚点刷新可用',await page.locator('.analysis-chart').count()>0);
  for(const [label,selector] of [['资料与口径','.material-columns'],['数据分析','.analysis-onboarding'],['结论核验','.ai-service-banner'],['修改与交付','#pdf-export-title']]){await page.locator('.project-nav').getByRole('link',{name:label,exact:false}).click();await page.locator(selector).waitFor();check('四页签实际导航：'+label,await page.locator('.project-nav [aria-current=page]').innerText().then(t=>t.includes(label)))}
  await ctx.close();
  const old=await context('retrieval-v10/live'),op=await old.newPage();op.on('pageerror',e=>errors.push(e.message));
  await op.goto(base+`/app/projects/${text.pid}/ai-verification?task=${text.tid}`);await op.locator('.ai-result').waitFor();await op.reload();await op.locator('.ai-result').waitFor();check('旧ai-verification任务链接及刷新可用',await op.locator('.ai-service-banner').evaluate(e=>!e.open));await old.close();
  const pc=await context('pdf-exports-v09/final-browser'),pp=await pc.newPage();pp.on('pageerror',e=>errors.push(e.message));
  await pp.goto(base+`/app/projects/${pdf.pid}/review?check=${pdf.source}&target=0&revision=${pdf.versions[0].id}`);await pp.locator('.revision-status-strip').waitFor();await pp.reload();await pp.locator('.revision-status-strip').waitFor();
  check('长原稿区域可以键盘聚焦并独立滚动',await pp.locator('.revision-original').evaluate(e=>e.tabIndex===0&&e.scrollHeight>e.clientHeight));await pp.locator('.revision-original').focus();await pp.keyboard.press('End');check('原稿键盘滚动可用',await pp.locator('.revision-original').evaluate(e=>e.scrollTop>0));
  const record=pp.locator('.pdf-export-record').filter({has:pp.locator(`a[href*="/${pdf.exports[0].id}/file"]`)});await record.getByRole('button',{name:'预览此 PDF',exact:true}).click();await pp.locator('.pdf-page-image img').waitFor();
  check('生产修订恢复及已保存PDF实际渲染',await pp.locator('.pdf-page-image img').evaluate(e=>e.complete&&e.naturalWidth>0));
  const download=await Promise.all([pp.waitForEvent('download'),pp.getByRole('link',{name:'下载此 PDF',exact:true}).click()]);
  const file=await download[0].path();check('浏览器下载PDF字节等于原已保存文件',crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')===pdf.exports[0].sha256);
  await pp.setViewportSize({width:390,height:844});await pp.getByRole('button',{name:'放大阅读',exact:true}).click();check('390px PDF放大在自身区域滚动',await pp.evaluate(()=>document.documentElement.scrollWidth===innerWidth)&&await pp.locator('.pdf-page-image').evaluate(e=>e.scrollWidth>e.clientWidth));
  await pp.locator('.pdf-export-preview').screenshot({path:path.join(out,'pdf-existing-390.png')});await pp.getByRole('button',{name:'关闭预览',exact:true}).click();check('PDF预览可关闭',await pp.locator('.pdf-page-image').count()===0);await pc.close();
  // A chunk outage is a local browser injection, never a backend/model failure.
  const broken=await browser.newContext(),bp=await broken.newPage();await broken.route('**/assets/HomePage-*.js',r=>r.abort());await bp.goto(base);await bp.getByRole('button',{name:'重新加载页面',exact:true}).waitFor();check('离线模拟页面包加载失败有重试与返回',await bp.getByRole('link',{name:'返回工作空间',exact:true}).count()===1);await broken.close();
  check('回看导航和PDF没有业务写请求或模型调用',writes===0);check('正常页面没有运行异常',errors.length===0);
 }finally{fs.writeFileSync(path.join(out,'links-checks.json'),JSON.stringify({base,checks,errors,writes},null,2));await browser.close()}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
