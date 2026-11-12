// Reuses saved real outcomes; blocks every model task write. Never pays for screenshots.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/retrieval-v10/live');
const state=JSON.parse(fs.readFileSync(path.join(out,'browser-run.json'),'utf8'));
const base='http://127.0.0.1:5173',checks=[];
const check=(name,v)=>{assert.ok(v,name);checks.push(name);console.log('PASS',name)};
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const ctx=await browser.newContext({storageState:path.join(out,'session.json'),viewport:{width:1440,height:1050},reducedMotion:'reduce'});
 let writes=0;await ctx.route('**/api/ai-tasks/**',route=>{if(route.request().method()!=='GET'){writes++;return route.abort()}return route.continue()});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.goto(base+state.route+'?task='+state.tid);await page.locator('.ai-result').waitFor();
 await page.getByRole('tab',{name:'规则原文',exact:true}).click();await page.locator('.rule-retrieval-evidence article').first().waitFor();
 check('实际任务显示新检索版本及三个独立段落',await page.locator('.rule-retrieval-evidence').innerText().then(t=>t.includes('bm25-context-v2'))&&await page.locator('.rule-retrieval-evidence article').count()===3);
 await page.locator('.rule-retrieval-evidence details').first().evaluate(el=>el.open=true);
 await page.locator('.ai-evidence-card').screenshot({path:path.join(out,'retrieved-rules-desktop.png')});
 for(const link of await page.locator('.rule-retrieval-evidence article>a').all()){
   const p=await ctx.newPage();await p.goto(base+await link.getAttribute('href'));await p.locator('.linked-source-paragraph').waitFor();await p.close();
 }check('三个规则段落各自可定位真实原文',true);
 await page.setViewportSize({width:390,height:844});check('390px规则原文无页面溢出',await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
 await page.evaluate(()=>{document.activeElement?.blur();const e=document.querySelector('.ai-evidence-card');window.scrollTo({top:e.getBoundingClientRect().top+scrollY-215,behavior:'instant'})});await page.screenshot({path:path.join(out,'rules-mobile-viewport-390.png')});
 await page.locator('.ai-evidence-card').screenshot({path:path.join(out,'retrieved-rules-mobile-390.png')});
 await page.getByRole('tab',{name:'比较结果',exact:true}).click();await page.locator('.ai-evidence-card').screenshot({path:path.join(out,'verified-result-mobile-390.png')});
 await page.setViewportSize({width:1440,height:1050});await page.locator('.ai-evidence-card').screenshot({path:path.join(out,'verified-result-desktop.png')});await page.evaluate(()=>{document.activeElement?.blur();const e=document.querySelector('.ai-evidence-card');window.scrollTo({top:e.getBoundingClientRect().top+scrollY-140,behavior:'instant'})});await page.screenshot({path:path.join(out,'result-desktop-viewport.png')});
 await page.goto(base+`/app/projects/${state.pid}/materials`);await page.getByLabel('检索已指定规则',{exact:true}).waitFor();
 await page.getByLabel('检索已指定规则',{exact:true}).fill('纳入记录满意率的分母和空值');await page.getByRole('button',{name:'查找规则原文',exact:true}).click();await page.locator('.rule-library .rule-retrieval-evidence article').first().waitFor();
 check('资料页查找带回相邻空值限制',await page.locator('.rule-library .rule-retrieval-evidence').innerText().then(t=>t.includes('不得排除')));
 await page.locator('.rule-library').screenshot({path:path.join(out,'materials-rule-search-desktop.png')});
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'字段与规则',exact:true}).click();check('390px资料规则检索无页面溢出',await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
 await page.locator('.rule-library').screenshot({path:path.join(out,'materials-rule-search-mobile-390.png')});
 await page.getByLabel('检索已指定规则',{exact:true}).fill('订单退款率');await page.getByRole('button',{name:'查找规则原文',exact:true}).click();await page.locator('.rule-library .rule-retrieval-evidence .calc-empty-small').waitFor();
 check('无指标依据明确停止并提示补充',await page.locator('.rule-library .rule-retrieval-evidence article').count()===0);
 // Read older task snapshots with the original synthetic owner's existing cookie.
 const oldDir=path.join(root,'artifacts/rule-constraints-v06/live'),old=JSON.parse(fs.readFileSync(path.join(oldDir,'browser-run.json'),'utf8'));
 const legacy=await browser.newContext({storageState:path.join(oldDir,'session.json')});
 const oldTask=await legacy.request.get(base+'/api/ai-tasks/'+old.tid);check('旧AI任务可读取且未补写检索版本',oldTask.ok()&&!(await oldTask.json()).payload.retrieval);
 const oldPage=await legacy.newPage();await oldPage.goto(base+old.route+'?task='+old.tid);await oldPage.getByRole('tab',{name:'规则原文',exact:true}).click();check('旧任务显示历史检索快照',await oldPage.locator('.rule-retrieval-evidence').innerText().then(t=>t.includes('历史检索快照')));await legacy.close();
 const pdfDir=path.join(root,'artifacts/pdf-exports-v09/final-browser'),pdf=JSON.parse(fs.readFileSync(path.join(pdfDir,'state.json'),'utf8'));
 const historical=await browser.newContext({storageState:path.join(pdfDir,'session.json')});
 const v=await historical.request.get(base+`/api/projects/${pdf.pid}/revisions/${pdf.versions[0].id}`);check('既有修订版本仍可读取',v.ok());
 const file=await historical.request.get(base+`/api/projects/${pdf.pid}/exports/${pdf.exports[0].id}/file`);
 check('既有PDF受保护下载且字节不变',file.ok()&&crypto.createHash('sha256').update(await file.body()).digest('hex')===pdf.exports[0].sha256);await historical.close();
 check('截图回看无AI写请求和前端运行错误',writes===0&&errors.length===0);
 fs.writeFileSync(path.join(out,'readonly-checks.json'),JSON.stringify(checks,null,2));
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e.message);process.exit(1)});
