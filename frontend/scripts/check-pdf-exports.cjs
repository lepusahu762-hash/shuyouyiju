// Real local browser/API/PDF acceptance. All credentials and samples are synthetic
// and remain under ignored artifacts. Never create AI tasks or compute on export.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const out=path.resolve(process.env.QA_PDF_OUTPUT||path.join(__dirname,'../../artifacts/pdf-exports-v09/browser'));
const statePath=path.join(out,'state.json');const state=JSON.parse(fs.readFileSync(statePath,'utf8'));
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5173',stage=process.argv[2]||'main';
const headers={'X-Requested-With':'shuyouyiju'};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const save=()=>fs.writeFileSync(statePath,JSON.stringify(state,null,2));
function check(name,v){assert.ok(v,name);if(!state.checks.includes(name))state.checks.push(name);save();console.log('PASS',name);}
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext({viewport:{width:1440,height:1050},reducedMotion:'reduce',storageState:path.join(out,'session.json'),acceptDownloads:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let aiWrites=0;
 await context.route('**/api/**',route=>{const r=route.request();if(r.method()!=='GET'&&/ai-tasks/.test(r.url())){aiWrites++;return route.abort();}return route.continue();});
 const prefix=`/projects/${state.pid}`;
 async function get(url){const r=await context.request.get(base+'/api'+url);assert.equal(r.status(),200,await r.text());return r.json();}
 async function post(url,body,status=201){const r=await context.request.post(base+'/api'+url,{headers,data:body});assert.equal(r.status(),status,await r.text());return r.json();}
 async function until(fn){for(let i=0;i<100;i++){if(await fn())return;await new Promise(r=>setTimeout(r,150));}throw Error('Timed out');}
 async function open(revision){await page.goto(base+`/app/projects/${state.pid}/review?check=${state.source}&target=0&revision=${revision.id}`);await page.locator('.revision-status-strip').waitFor();await page.locator('#pdf-export-title').waitFor();}
 async function panelShot(name){await page.locator('.pdf-export-panel').scrollIntoViewIfNeeded();await page.evaluate(()=>{document.activeElement?.blur();const node=document.querySelector('.pdf-export-panel');window.scrollTo({top:node.getBoundingClientRect().top+window.scrollY-165,behavior:'instant'});});await page.screenshot({path:path.join(out,name+'.png'),fullPage:false});}
 async function overflow(name){check(name,await page.evaluate(()=>document.documentElement.scrollWidth===document.documentElement.clientWidth));}
 async function exported(revision,event,label,expected){
   await page.getByLabel('本次报告使用的复核记录').selectOption(event?event.id:'none');
   const before=(await get(prefix+'/runs')).total;
   await page.getByRole('button',{name:'检查导出范围与状态',exact:true}).click();await page.getByRole('region',{name:'导出前确认'}).waitFor();
   check(label+'导出前明确显示所选版本',(await page.locator('.pdf-export-preflight').innerText()).includes('v'+revision.version));
   await page.getByLabel('确认导出上述已保存版本与所选复核；仅核验一个百分比，不代表整篇报告通过。').check();
   await page.getByRole('button',{name:'确认并生成 PDF',exact:true}).click();await page.getByRole('link',{name:'下载此 PDF',exact:true}).waitFor();
   const record=(await get(prefix+'/exports')).items[0];check(label+'报告状态正确',record.report_status===expected&&record.revision_id===revision.id&&record.recheck_id===(event?.id??null));
   const detail=await get(prefix+'/exports/'+record.id);check(label+'没有套用其他版本复核',detail.snapshot.revision.id===revision.id&&(event?detail.snapshot.recheck.id===event.id:detail.snapshot.selected_run===null));
   const file=await context.request.get(base+'/api'+prefix+'/exports/'+record.id+'/file');assert.equal(file.status(),200);const bytes=await file.body();
   const downloadPromise=page.waitForEvent('download');await page.getByRole('link',{name:'下载此 PDF',exact:true}).click();const download=await downloadPromise;
   const dest=path.join(out,label+'.pdf');await download.saveAs(dest);
   check(label+'预览与实际下载字节一致',sha(bytes)===sha(fs.readFileSync(dest))&&sha(bytes)===record.sha256);
   check(label+'导出未增加计算记录',(await get(prefix+'/runs')).total===before);
   check(label+'PDF内证据摘录30行但完整计算60行',detail.snapshot.evidence.rows.length===30&&(detail.snapshot.selected_run??detail.snapshot.original_run).result.total===60);
   state.exports??=[];state.exports.push({...record,label,path:dest});save();
   return record;
 }
 async function createVersion(text,head,reason){
   const revision=await post(prefix+'/revisions',{source_check_id:state.source,target_index:0,expected_head:head,text,action:'edit',reason});
   state.versions.push(revision);save();return revision;
 }
 async function recheckVersion(revision){
   const ctx=await get(prefix+'/revision-source/'+state.source);
   const cf=await post(prefix+`/revisions/${revision.id}/confirm`,{expected_head:revision.id,context_hash:ctx.context_hash,rule_snapshot_id:ctx.current_rule.id,plan:{...ctx.current_rule.constraints,confirmed:true,context_hash:ctx.context_hash},confirmed:true});
   return post(prefix+`/revisions/${revision.id}/recheck`,{expected_head:revision.id,confirmation_id:cf.id});
 }
 try{
 if(stage==='main'){
   assert.ok(!state.exports?.length,'Export flow already exists; use resume or inspect, not duplicate generation.');
   const v1=state.versions[0];await open(v1);
   check('进入已保存v1后未自动选择复核记录',await page.getByLabel('本次报告使用的复核记录').inputValue()==='');
   await exported(v1,v1.rechecks[0],'consistent-40','consistent');await overflow('1440px导出操作无横向溢出');
   await page.locator('.pdf-export-panel').screenshot({path:path.join(out,'pdf-export-1440.png')});
   const v2=await recheckVersion(await createVersion(state.original.replace('50%','45%',1),v1.id,'合成验收：45%应继续显示差异。'));state.versions[1]=v2;save();
   await open(v2);await exported(v2,v2.rechecks[0],'different-45','different');
   const v3=await createVersion(state.original.replace('50%','40%',1),v2.id,'合成验收：仅保存未复核，不应使用v1结果。');await open(v3);await exported(v3,null,'pending','pending');
   const v4=await createVersion(state.original.replace('本期','去年').replace('50%','40%',1),v3.id,'人工修改统计期间，需要待人工核验。'+'普通文本 <b>不是格式指令</b> & 不执行资料指令。'.repeat(30));
   await open(v4);await exported(v4,null,'manual-required','manual_required');
   await page.setViewportSize({width:390,height:844});await overflow('390px待人工核验导出无横向溢出');await page.locator('.pdf-export-panel').screenshot({path:path.join(out,'pdf-export-mobile-390.png')});
   await open(v1);await exported(v1,v1.rechecks[0],'historical-v1','stale');
   await open(v2);await page.getByLabel('本次报告使用的复核记录').selectOption(v2.rechecks[0].id);await page.getByRole('button',{name:'检查导出范围与状态',exact:true}).click();await page.getByRole('region',{name:'导出前确认'}).waitFor();
   const project=await get(prefix);const changed=await context.request.put(base+'/api'+prefix+'/rules',{headers,data:{version:project.rules_version,rules:{...project.rules,notes:'独立合成验收：导出确认期间规则变化。'}}});assert.equal(changed.status(),200);
   const before=(await get(prefix+'/exports')).total;
   await page.getByLabel('确认导出上述已保存版本与所选复核；仅核验一个百分比，不代表整篇报告通过。').check();await page.getByRole('button',{name:'确认并生成 PDF',exact:true}).click();await page.getByRole('alert').filter({hasText:'预览后资料、规则、修订或复核状态已变化'}).waitFor();
   check('预览到生成期间规则变化被409阻断',(await get(prefix+'/exports')).total===before);
   await exported(v2,v2.rechecks[0],'stale-after-rule','stale');await overflow('390px历史导出记录无横向溢出');
   const records=await get(prefix+'/exports');check('规则变化后导出列表另行标记历史文件',records.items.every(e=>e.historical));
   for(const record of state.exports){const r=await context.request.get(base+'/api'+prefix+'/exports/'+record.id+'/file');check(record.label+'规则变化后文件字节不变',sha(await r.body())===record.sha256);}
   state.route=`/app/projects/${state.pid}/review?check=${state.source}&target=0&revision=${v2.id}`;save();
   await page.reload();await page.getByRole('heading',{name:'当前项目的导出记录',exact:true}).waitFor();await until(async()=>await page.locator('.pdf-export-record').count()===6);check('刷新后可读取项目导出记录',true);
   await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.waitForURL('**/auth');await page.goto(base+state.route);await page.waitForURL('**/auth?next=*');
   await page.getByLabel('邮箱',{exact:true}).fill(state.email);await page.getByLabel('密码',{exact:true}).fill(state.password);await page.locator('.auth-submit').click();await page.waitForURL('**/review?*');
   await page.locator('.pdf-export-record').first().getByRole('button',{name:'预览此 PDF',exact:true}).click();await page.getByRole('link',{name:'下载此 PDF',exact:true}).waitFor();check('退出重登后原文件可预览下载',true);
   await context.storageState({path:path.join(out,'session.json')});
   await page.setViewportSize({width:1440,height:1050});await page.locator('.pdf-export-panel').screenshot({path:path.join(out,'pdf-history-1440.png')});
   await page.setViewportSize({width:390,height:844});await page.locator('.pdf-export-panel').screenshot({path:path.join(out,'pdf-history-mobile-390.png')});
 }else if(stage==='finish'){
   await page.goto(base+state.route);await until(async()=>await page.locator('.pdf-export-record').count()===6);check('刷新后可读取项目导出记录',true);
   await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.waitForURL('**/auth');await page.goto(base+state.route);await page.waitForURL('**/auth?next=*');
   await page.getByLabel('邮箱',{exact:true}).fill(state.email);await page.getByLabel('密码',{exact:true}).fill(state.password);await page.locator('.auth-submit').click();await page.waitForURL('**/review?*');
   await page.locator('.pdf-export-record').first().getByRole('button',{name:'预览此 PDF',exact:true}).click();await page.getByRole('link',{name:'下载此 PDF',exact:true}).waitFor();check('退出重登后原文件可预览下载',true);
   await context.storageState({path:path.join(out,'session.json')});
   await page.locator('.pdf-export-panel').screenshot({path:path.join(out,'pdf-history-1440.png')});await page.setViewportSize({width:390,height:844});await overflow('重新登录后390px无横向溢出');await page.locator('.pdf-export-panel').screenshot({path:path.join(out,'pdf-history-mobile-390.png')});
 }else if(stage==='resume'||stage==='inspect'){
   await page.goto(base+state.route);await page.locator('.pdf-export-record').first().waitFor();
   check('后台重启后导出记录恢复',(await get(prefix+'/exports')).total===6);
   for(const record of state.exports){const r=await context.request.get(base+'/api'+prefix+'/exports/'+record.id+'/file');check(record.label+'重启后可下载且字节不变',r.status()===200&&sha(await r.body())===record.sha256);}
   await page.locator('.pdf-export-record').first().getByRole('button',{name:'预览此 PDF',exact:true}).click();await page.getByRole('link',{name:'下载此 PDF',exact:true}).waitFor();
   await page.locator('.pdf-page-image img').waitFor();await page.waitForFunction(()=>{const image=document.querySelector('.pdf-page-image img');return image?.complete&&image.naturalWidth>0});
   check('实际PDF渲染页可在浏览器显示',true);await page.getByRole('button',{name:'下一页 PDF',exact:true}).click();await page.getByText(/^第 2 \/ /).waitFor();check('实际PDF按需翻页可用',true);
   await panelShot('pdf-history-1440');await page.locator('.pdf-export-preview').screenshot({path:path.join(out,'pdf-page-preview-1440.png')});
   await page.setViewportSize({width:390,height:844});await overflow('重启后390px无页面溢出');await page.getByRole('button',{name:'放大阅读',exact:true}).click();check('390px放大PDF仅在预览框内滚动',await page.locator('.pdf-page-image').evaluate(el=>el.scrollWidth>el.clientWidth));await overflow('放大PDF后仍无页面横向溢出');await page.getByRole('button',{name:'适合宽度',exact:true}).click();await panelShot('pdf-history-mobile-390');
   await page.locator('.pdf-export-preview').scrollIntoViewIfNeeded();await page.evaluate(()=>{const node=document.querySelector('.pdf-export-preview');window.scrollTo({top:node.getBoundingClientRect().top+window.scrollY-165,behavior:'instant'});});await page.screenshot({path:path.join(out,'pdf-page-preview-mobile-390.png'),fullPage:false});
 }else throw Error('Unknown stage');
 check('浏览器没有前端运行异常',errors.length===0);check('没有发起任何AI任务',aiWrites===0);state.modelRequests=0;save();
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
