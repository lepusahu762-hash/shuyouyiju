// Read-only saved demo check. Blocks EVERY mutation; no paid stage or shared account in Git.
const {launch}=require('./browser-runtime.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/unified-demo-v15'),s=JSON.parse(fs.readFileSync(path.join(out,'state.json'),'utf8')),base=process.env.PREVIEW_URL||'http://127.0.0.1:4173';
(async()=>{const browser=await launch(),ctx=await browser.newContext({storageState:path.join(out,'session.json'),viewport:{width:1440,height:1080},reducedMotion:'reduce'}),p=await ctx.newPage(),checks=[],errors=[];let blocked=0;
const check=(n,v)=>{assert.ok(v,n);checks.push(n);console.log('PASS',n)};
p.on('pageerror',e=>errors.push(e.message));await ctx.route('**/api/**',r=>{if(r.request().method()!=='GET'){blocked++;return r.abort()}return r.continue()});
const get=async u=>{const r=await ctx.request.get(base+'/api'+u);assert.equal(r.status(),200);return r.json()};
const route=u=>base+`/app/projects/${s.pid}/`+u;
async function shot(n){await p.evaluate(()=>{document.activeElement?.blur();scrollTo({top:0,behavior:'instant'})});await p.screenshot({path:path.join(out,n+'.png'),fullPage:true})}
const versions=async()=>({analysis:await get('/analysis-turns/'+s.turn),text:await get('/ai-tasks/'+s.textTask),image:await get('/image-tasks/'+s.imageTask),revision:await get(`/projects/${s.pid}/revisions/${s.revision.id}`),exports:await get(`/projects/${s.pid}/exports`)});
try{
const saved=await versions();check('所有结果仍为当前规则且原文字差异保留',!saved.analysis.stale&&!saved.text.stale&&!saved.image.stale&&saved.text.check.result.status==='different'&&saved.revision.rechecks[0].result.status==='consistent');
for(const width of [1440,390]){await p.setViewportSize({width,height:width===390?844:1080});
for(const [name,url,selector]of[
 ['materials',route('materials'),'.material-columns'],['analysis',route(`analysis?session=${s.sid}&turn=${s.turn}`),'.analysis-chart'],['text',route('verify?task='+s.textTask),'.ai-result'],['image',route(`verify?mode=image&imageTask=${s.imageTask}`),'.image-number'],['review',base+s.reviewRoute,'.revision-recheck']]){
 await p.goto(url);await p.locator(selector).waitFor();await p.evaluate(()=>document.fonts.ready);check(`${name} ${width}px 无页面横向溢出`,await p.evaluate(()=>document.documentElement.scrollWidth===document.documentElement.clientWidth));await shot(`replay-${name}-${width}`);
 await p.reload();await p.locator(selector).waitFor();check(`${name} ${width}px直接刷新恢复`,true);
}
}
await p.setViewportSize({width:1440,height:1080});await p.goto(route(`analysis?session=${s.sid}&turn=${s.turn}`));await p.getByRole('button',{name:'选择分组 B（text）',exact:true}).click();await p.locator('.analysis-evidence').getByText('已选 B（text）：分子1／分母4',{exact:false}).waitFor();await p.getByRole('button',{name:'定位源行 8',exact:true}).click();await p.getByRole('link',{name:'在资料页定位当前原始行 ↗',exact:true}).click();await p.locator('.linked-source-row').waitFor();check('图表B组关联4条记录并定位原始行8',new URL(p.url()).searchParams.get('row')==='8');await shot('source-row-desktop');
await p.goto(route('verify?task='+s.textTask));await p.getByRole('tab',{name:'规则原文',exact:true}).click();await p.locator('.ai-rule').first().getByRole('link',{name:/定位.*规则原文/}).click();await p.locator('.linked-source-paragraph').waitFor();check('文字规则引用定位实际保存规则段落',new URL(p.url()).searchParams.get('asset')===s.rule.id);await shot('source-rule-desktop');
await p.goto(route('verify?task='+s.textTask));await p.locator('.ai-source-location').click();await p.locator('.linked-source-paragraph').waitFor();check('报告原句可定位',new URL(p.url()).searchParams.get('asset')===s.report.id);await shot('source-report-desktop');
await p.goto(base+s.reviewRoute);await p.getByRole('button',{name:/预览.*PDF/}).first().click();await p.locator('.pdf-page-image img').waitFor();await shot('replay-pdf-1440');await p.setViewportSize({width:390,height:844});await shot('replay-pdf-390');
fs.writeFileSync(path.join(out,'replayed-snapshots.json'),JSON.stringify(saved,null,2));check('只读检查无写请求或模型调用入口',blocked===0);check('无前端运行异常',errors.length===0);fs.writeFileSync(path.join(out,'replay-result.json'),JSON.stringify({checks,blocked,errors},null,2));
}finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
