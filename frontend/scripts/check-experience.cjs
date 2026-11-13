// Production-only UX/performance audit. Saved synthetic records; model writes blocked.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/experience-v14'),base=process.env.PREVIEW_URL||'http://127.0.0.1:4173',stage=process.argv[2]||'audit';
const finalAudit=stage.startsWith('audit-final');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const normal=read('artifacts/rules-onboarding-v13/browser-run.json'),pause=read('artifacts/rules-onboarding-v13/pause/browser-run.json'),text=read('artifacts/retrieval-v10/live/browser-run.json'),img=read('artifacts/image-v11/browser-state.json'),pdf=read('artifacts/pdf-exports-v09/final-browser/state.json');
const cases=[
 ['home','/','#hero-title'],['cases','/cases','.case-preview'],['guide','/guide','.guide-content'],['auth','/auth','#auth-title'],
 ['workspace','/app','.projects-table','rules-onboarding-v13'],['templates','/app/templates','.template-grid','rules-onboarding-v13'],['personal','/app/me','.personal-panel','rules-onboarding-v13'],
 ['materials',`/app/projects/${normal.pid}/materials`,'.material-columns','rules-onboarding-v13'],
 ['rules',`/app/projects/${normal.pid}/materials#confirm-rules`,'.standalone-rule','rules-onboarding-v13'],
 ['analysis',`/app/projects/${normal.pid}/analysis?session=${normal.sid}&turn=${normal.turn}`,'.analysis-chart','rules-onboarding-v13'],
 ['paused',`/app/projects/${pause.pid}/analysis?session=${pause.sid}&turn=${pause.rank}`,'.analysis-chart','rules-onboarding-v13/pause'],
 ['verify',text.route+'?task='+text.tid,'.ai-result','retrieval-v10/live'],
 ['image',img.route+'&imageTask='+img.tasks['50'].id,'.image-verification-grid','image-v11'],
 ['review',`/app/projects/${pdf.pid}/review?check=${pdf.source}&target=0&revision=${pdf.versions[0].id}`,'.revision-status-strip','pdf-exports-v09/final-browser'],
];
fs.mkdirSync(out,{recursive:true});
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),report={stage,base,browser:await browser.version(),conditions:'Windows local Chrome headless, production Vite preview, cold context per navigation, no network or CPU throttling, reduced motion',checks:[],layouts:[],performance:[],errors:[],blockedWrites:[]};
 function check(n,v){assert.ok(v,n);report.checks.push(n);console.log('PASS',n)}
 async function context(c,width=1440){const ctx=await browser.newContext({viewport:{width,height:width<700?844:1080},reducedMotion:'reduce',...(c[3]?{storageState:path.join(root,'artifacts',c[3],'session.json')}:{})});await ctx.route('**/api/**',route=>{const r=route.request();if(r.method()!=='GET'&&r.method()!=='HEAD'){report.blockedWrites.push(r.method()+' '+new URL(r.url()).pathname);return route.abort()}return route.continue()});return ctx}
 try{
  if(stage.startsWith('perf-')){
   const selected=cases.filter(c=>['home','analysis','materials','verify','review'].includes(c[0]));
   for(const c of selected)for(let i=0;i<3;i++){
    const ctx=await context(c),page=await ctx.newPage();const apis=[];page.on('request',r=>{if(r.url().includes('/api/'))apis.push(new URL(r.url()).pathname+new URL(r.url()).search)});
    await page.goto(base+c[1]);await page.locator(c[2]).waitFor();const ready=await page.evaluate(()=>performance.now());await page.waitForLoadState('networkidle');
    const metrics=await page.evaluate(()=>{const r=performance.getEntriesByType('resource'),n=performance.getEntriesByType('navigation')[0];return {domContentLoadedMs:n.domContentLoadedEventEnd,loadMs:n.loadEventEnd,fcpMs:performance.getEntriesByName('first-contentful-paint')[0]?.startTime??null,js:r.filter(x=>/\.js(?:\?|$)/.test(x.name)).map(x=>({name:new URL(x.name).pathname,bytes:x.decodedBodySize})),css:r.filter(x=>/\.css(?:\?|$)/.test(x.name)).map(x=>({name:new URL(x.name).pathname,bytes:x.decodedBodySize}))}});
    const disk=kind=>metrics[kind].reduce((a,r)=>a+zlib.gzipSync(fs.readFileSync(path.join(root,'frontend/dist',r.name))).length,0);report.performance.push({page:c[0],iteration:i+1,readyMs:ready,...metrics,jsGzipBytes:disk('js'),cssGzipBytes:disk('css'),apiCount:apis.length,duplicateApis:apis.filter((x,i)=>apis.indexOf(x)!==i),apis});await ctx.close();
   }
  }else{
   for(const width of (process.env.SYJ_WIDTHS?process.env.SYJ_WIDTHS.split(',').map(Number):[320,390,768,1440]))for(const c of cases.filter(c=>!process.env.SYJ_PAGES||process.env.SYJ_PAGES.split(',').includes(c[0]))){
    const ctx=await context(c,width),page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(c[0]+': '+e.message));await page.goto(base+c[1]);await page.locator(c[2]).waitFor();if(c[0]==='rules'){await page.locator('.standalone-rule .rule-setup').evaluate(el=>el.open=true)}await page.waitForLoadState('networkidle');
    const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflowElements:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>innerWidth+2&&getComputedStyle(e).position!=='absolute'}).slice(0,12).map(e=>({tag:e.tagName,cls:e.className,right:Math.round(e.getBoundingClientRect().right)}))}));report.layouts.push({page:c[0],...layout});console.log(c[0],width,layout.scrollWidth===width?'OK':'OVERFLOW '+layout.scrollWidth);
    if(width===390||width===1440){await page.evaluate(()=>{document.activeElement?.blur();scrollTo({top:0,behavior:'instant'})});await page.screenshot({path:path.join(out,`${stage}-${c[0]}-${width}.png`),fullPage:true})}
    if(finalAudit){if(layout.scrollWidth===width)check(`${c[0]} ${width}px无页面横向溢出`,true);if(c[1].startsWith('/app/projects'))check(`${c[0]} ${width}px四页签及当前位置`,await page.locator('.project-nav a').count()===4&&await page.locator('.project-nav [aria-current=page]').count()===1);}
    await ctx.close();
   }
   if(finalAudit)check('全部页面宽度均通过',report.layouts.every(x=>x.scrollWidth===x.width));check('没有前端运行异常',report.errors.length===0);
  }
  check('未触发业务写请求或模型调用',report.blockedWrites.length===0);
 }finally{fs.writeFileSync(path.join(out,stage+'.json'),JSON.stringify(report,null,2));await browser.close()}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
