// Focused real-browser acceptance against the local API. No model requests.
// Synthetic credentials/session/output are ignored under artifacts/.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5173';
const out = path.resolve(process.env.QA_REVISION_OUTPUT || path.join(__dirname,'../../artifacts/revisions-v08/browser'));
fs.mkdirSync(out,{recursive:true});
const statePath = path.join(out,'state.json');
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath)) : {checks:[]};
const stage = process.argv[2] || 'main';
const headers = {'X-Requested-With':'shuyouyiju'};
const fields = ['asset_id','sheet_id','operation','metric','scope_description','scope','numerator','null_policy','precision'];
function save(){fs.writeFileSync(statePath,JSON.stringify(state,null,2));}
function check(name,value){assert.ok(value,name);if(!state.checks.includes(name))state.checks.push(name);save();console.log('PASS',name);}
async function main(){
 const browser = await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context = await browser.newContext({viewport:{width:1440,height:1050},reducedMotion:'reduce',...(state.pid?{storageState:path.join(out,'session.json')}:{})});
 let modelAttempts=0;const errors=[];
 await context.route('**/api/ai-tasks/**',route=>{if(route.request().method()!=='GET'){modelAttempts++;return route.abort();}return route.continue();});
 await context.route('**/api/projects/*/ai-tasks',route=>{if(route.request().method()!=='GET'){modelAttempts++;return route.abort();}return route.continue();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 async function get(url){const r=await context.request.get(base+'/api'+url);assert.equal(r.status(),200,await r.text());return r.json();}
 async function post(url,body,status=201){const r=await context.request.post(base+'/api'+url,{headers,data:body});assert.equal(r.status(),status,await r.text());return status===204?null:r.json();}
 async function until(fn){for(let i=0;i<100;i++){if(await fn())return;await new Promise(r=>setTimeout(r,150));}throw Error('Timed out');}
 async function view(){return get(`/projects/${state.pid}/revisions/${state.current}`);}
 async function shot(name,fullPage=true){await page.evaluate(()=>document.fonts.ready);if(fullPage) await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo({top:0,behavior:'instant'});});await page.screenshot({path:path.join(out,name+'.png'),fullPage});}
 async function noOverflow(label){check(label,await page.evaluate(()=>document.documentElement.scrollWidth===document.documentElement.clientWidth));}
 async function savedVersion(expected){await until(async()=>{const ctx=await get(`/projects/${state.pid}/revision-source/${state.source.id}`);if(!ctx.head_id||ctx.head_id===state.current)return false;state.current=ctx.head_id;save();return true;});await page.locator('.revision-status-strip').getByText(new RegExp(`v${expected} ·`)).waitFor();return view();}
 async function saveUI(expected){await page.getByRole('button',{name:/^(保存修订版本|恢复并保存为新版本)$/}).click();return savedVersion(expected);}
 async function recheckUI(expected){
  await page.getByLabel('我已核对：',{exact:false}).check();await page.getByRole('button',{name:'确认此版本方案',exact:true}).click();
  await page.getByText('当前版本与规则方案已确认，尚未复核。下一步运行后台计算。').waitFor();
  await page.getByRole('button',{name:'执行确定性复核',exact:true}).click();
  await page.locator('.revision-result').waitFor();await until(async()=>(await view()).rechecks.length>0);
  const v=await view();check(`v${v.version} 真实复核结果 ${expected}`,v.status===expected);return v;
 }
 try{
 if(stage==='main'){
  assert.ok(!state.pid,'This synthetic run already exists. Use resume after restart; do not overwrite it.');
  state.email=`revision-${Date.now()}@example.com`;state.password=require('node:crypto').randomBytes(24).toString('base64url')+'Aa1!';save();
  await post('/auth/register',{email:state.email,password:state.password});
  const login=await context.request.post(base+'/api/auth/login',{headers,form:{username:state.email,password:state.password}});assert.equal(login.status(),204);
  state.pid=(await post('/projects',{name:'独立合成验收 · 单条修订与复核',goal:'verify'})).id;save();
  const raw='编号,纳入标记,服务评价\n'+Array.from({length:10},(_,i)=>`${i+1},是,${i<4?'满意':i<8?'不满意':''}`).join('\n')+'\n11,否,满意\n12,否,不满意\n';
  const upload=await context.request.post(base+`/api/projects/${state.pid}/assets`,{headers,multipart:{file:{name:'独立合成修订12条.csv',mimeType:'text/csv',buffer:Buffer.from('\ufeff'+raw)}}});assert.equal(upload.status(),201);state.table=(await upload.json()).id;
  state.report=await post(`/projects/${state.pid}/reports`,{name:'独立合成报告50%',text:'本期纳入记录的满意率为50%，参考比例为25%。'});
  state.rule=await post(`/projects/${state.pid}/reports`,{name:'独立合成规则 · 保留空值',text:'合成测试：本期纳入标记为是的全部记录进入分母，服务评价为空也保留。分子为服务评价为满意的记录。单位为记录／行，不去重，显示和比较精度0位小数。'});
  await until(async()=>{const a=await get(`/projects/${state.pid}/assets`);return a.length===3&&a.every(v=>v.status==='ready');});
  const enabled=await context.request.put(base+`/api/projects/${state.pid}/rule-materials/${state.rule.id}`,{headers,data:{enabled:true}});assert.equal(enabled.status(),200);
  const table=await get('/assets/'+state.table);const cols=table.summary.sheets[0].columns;
  const spec={asset_id:table.id,sheet_id:'s1',operation:'ratio',metric:'纳入记录满意率',scope_description:'本期纳入标记为是的全部记录',scope:[{column_id:cols[1].id,kind:'text',value:'是'}],numerator:[{column_id:cols[2].id,kind:'text',value:'满意'}],null_policy:'keep',precision:0};
  const rp=(await get(`/assets/${state.rule.id}/preview`)).paragraphs[0];
  const head=await get(`/projects/${state.pid}/rule-snapshots`);
  state.snapshot=await post(`/projects/${state.pid}/rule-snapshots`,{previous_id:null,context_hash:head.context_hash,constraints:spec,sources:Object.fromEntries(fields.map(k=>[k,{asset_id:state.rule.id,paragraph_id:rp.id,quote:rp.text}])),confirmed_fields:fields,unresolved:[],change_reason:'独立合成浏览器验收，明确确认全部口径。'});
  const ctx=await get(`/projects/${state.pid}/calculation-context`);
  state.run=await post(`/projects/${state.pid}/runs`,{...spec,confirmed:true,context_hash:ctx.context_hash});
  const para=(await get(`/assets/${state.report.id}/preview`)).paragraphs[0];
  state.source=await post(`/runs/${state.run.id}/checks`,{report_asset_id:state.report.id,paragraph_id:para.id,reported_value:'50',precision:0,confirmed:true});save();
  check('独立合成原核验50%与4/10=40%存在差异',state.source.status==='different'&&state.source.result.difference_pp==='-10');
  state.rawSha=require('node:crypto').createHash('sha256').update(Buffer.from('\ufeff'+raw)).digest('hex');
  await context.storageState({path:path.join(out,'session.json')});
  await page.goto(base+`/app/projects/${state.pid}/calculations?run=${state.run.id}`);
  await page.getByRole('link',{name:'去修订这条原句 ↗',exact:true}).click();
  await page.locator('.revision-target').waitFor();
  check('从实际手动核验结果准确进入原句',new URL(page.url()).searchParams.get('check')===state.source.id);
  check('多数字段落未选位置时保存禁用',await page.getByRole('button',{name:'保存修订版本',exact:true}).isDisabled());
  await page.getByLabel('本次修改的目标百分比').selectOption('0');await page.locator('.revision-original mark').waitFor();
  check('高亮指定的50%而非同段25%',(await page.locator('.revision-original mark').innerText())==='50%');
  await page.getByRole('button',{name:'接受数值建议',exact:true}).click();
  check('建议只替换一个百分比',(await page.getByLabel('修订文本',{exact:true}).inputValue())==='本期纳入记录的满意率为40%，参考比例为25%。');
  const v1=await saveUI(1);state.v1=v1.id;save();check('接受并保存后真实状态待复核',v1.status==='pending'&&v1.rechecks.length===0);
  await shot('revision-pending-1440');
  const checked=await recheckUI('consistent');
  check('重新计算的分子分母为4和10',checked.rechecks[0].run.result.numerator===4&&checked.rechecks[0].run.result.denominator===10);
  await shot('revision-consistent-1440');
  await page.getByRole('tab',{name:'原始数据',exact:true}).click();await page.getByRole('button',{name:'定位源行 2',exact:true}).click();
  check('复核原始数据可定位源行',await page.getByText('已定位源行 2',{exact:true}).isVisible());
  await page.getByRole('tab',{name:'规则原文',exact:true}).click();check('复核引用真实规则原文',(await page.locator('.revision-evidence').innerText()).includes('服务评价为空也保留'));
  await page.getByLabel('修订文本',{exact:true}).fill('本期纳入记录的满意率为45%，参考比例为25%。');
  check('草稿修改后禁止套用已保存确认',await page.getByRole('button',{name:'执行确定性复核',exact:true}).isDisabled());
  await saveUI(2);const v2=await recheckUI('different');check('手动45%相差5个百分点',v2.rechecks[0].result.difference_pp==='-5');
  await page.getByRole('button',{name:'保留原句并说明',exact:true}).click();check('保留原句必须填写原因',await page.getByRole('button',{name:'保存修订版本',exact:true}).isDisabled());
  await page.getByLabel('修改说明',{exact:true}).fill('合成验收：保留原句，不等于消除差异。');await saveUI(3);const v3=await recheckUI('different');check('保留50%仍有10个百分点差异',v3.rechecks[0].result.difference_pp==='-10');
  await page.getByLabel('修订文本',{exact:true}).fill('去年纳入记录的满意率为40%，参考比例为25%。');await saveUI(4);
  check('改变期间后标为待人工核验',(await view()).status==='manual_required');
  check('改变期间后不允许确认旧方案',await page.getByRole('button',{name:'确认此版本方案',exact:true}).isDisabled());await shot('revision-semantic-block-1440');
  await page.locator('.revision-version-list button').filter({hasText:/^v1 /}).click();await until(async()=>(await page.getByLabel('修订文本',{exact:true}).inputValue()).includes('40%'));
  const viewedOld=await get(`/projects/${state.pid}/revisions/${state.v1}`);check('历史v1结果仍为一致但提示历史版本',viewedOld.rechecks[0].result.status==='consistent'&&viewedOld.rechecks[0].stale);
  await page.getByRole('button',{name:'恢复此内容为新版本',exact:true}).click();const v5=await saveUI(5);check('恢复旧内容追加v5待复核',v5.version===5&&v5.restored_from===state.v1&&v5.status==='pending');
  await recheckUI('consistent');
  const old=await get(`/projects/${state.pid}/revisions/${state.v1}`);check('旧版本和原核验记录未覆盖',old.text.includes('40%')&&old.rechecks[0].result.status==='consistent'&&(await get(`/runs/${state.run.id}/checks`)).items[0].result.difference_pp==='-10');
  await page.locator('.revision-version-list button').filter({hasText:/^原稿/}).click();check('原稿可只读查看',(await page.getByLabel('修订文本',{exact:true}).inputValue()).includes('50%'));
  await page.locator('.revision-version-list button').filter({hasText:/^v5 /}).click();await page.locator('.revision-status-strip').getByText('v5 · 单条数字与数据一致').waitFor();
  state.route=new URL(page.url()).pathname+new URL(page.url()).search;save();await page.reload();await page.locator('.revision-status-strip').getByText('v5 · 单条数字与数据一致').waitFor();check('刷新后修订版本和复核恢复',true);
  await page.setViewportSize({width:390,height:844});await noOverflow('390px页面没有横向溢出');await shot('revision-mobile-390');
  await page.getByRole('tab',{name:'复核结果',exact:true}).click();await page.locator('.revision-result').scrollIntoViewIfNeeded();await shot('revision-result-mobile-390',false);
  await page.getByRole('tab',{name:'原始数据',exact:true}).click();await page.locator('.calc-data-table').waitFor();await noOverflow('390px证据表在自身区域滚动');
  await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.waitForURL('**/auth');
  await page.goto(base+state.route);await page.waitForURL('**/auth?next=*');
  check('登录保护保留原句版本和目标参数',new URLSearchParams(new URL(page.url()).searchParams.get('next').split('?')[1]).get('revision')===state.current&&new URLSearchParams(new URL(page.url()).searchParams.get('next').split('?')[1]).get('target')==='0');
  await page.getByLabel('邮箱',{exact:true}).fill(state.email);await page.getByLabel('密码',{exact:true}).fill(state.password);await page.locator('.auth-submit').click();await page.waitForURL('**/review?*');await page.locator('.revision-status-strip').getByText('v5 · 单条数字与数据一致').waitFor();
  check('退出重新登录后恢复指定修订版本',true);
  await context.storageState({path:path.join(out,'session.json')});
  const originalFile=await context.request.get(base+`/api/assets/${state.table}/original`);check('上传原文件字节未变化',require('node:crypto').createHash('sha256').update(await originalFile.body()).digest('hex')===state.rawSha);
  await page.setViewportSize({width:1440,height:1050});await page.getByRole('tab',{name:'复核结果',exact:true}).click();await noOverflow('1440px页面没有横向溢出');await shot('revision-final-1440');
  state.beforeRestart=await view();save();
 } else if(stage==='finish'){
  await page.setViewportSize({width:390,height:844});await page.goto(base+state.route);await page.waitForURL('**/auth?next=*');
  const next=new URL(page.url()).searchParams.get('next');const params=new URLSearchParams(next.split('?')[1]);
  check('登录保护保留原句版本和目标参数',params.get('revision')===state.current&&params.get('target')==='0'&&params.get('check')===state.source.id);
  await page.getByLabel('邮箱',{exact:true}).fill(state.email);await page.getByLabel('密码',{exact:true}).fill(state.password);await page.locator('.auth-submit').click();await page.waitForURL('**/review?*');await page.locator('.revision-status-strip').getByText('v5 · 单条数字与数据一致').waitFor();
  check('退出重新登录后恢复指定修订版本',true);
  await context.storageState({path:path.join(out,'session.json')});
  const old=await get(`/projects/${state.pid}/revisions/${state.v1}`);check('历史v1结果仍为一致但提示历史版本',old.rechecks[0].result.status==='consistent'&&old.rechecks[0].stale);
  const originalFile=await context.request.get(base+`/api/assets/${state.table}/original`);check('上传原文件字节未变化',require('node:crypto').createHash('sha256').update(await originalFile.body()).digest('hex')===state.rawSha);
  await noOverflow('390px重新登录恢复后无横向溢出');await shot('revision-mobile-390');
  await page.getByRole('tab',{name:'复核结果',exact:true}).click();await page.locator('.revision-result').scrollIntoViewIfNeeded();await shot('revision-result-mobile-390',false);
  await page.setViewportSize({width:1440,height:1050});await noOverflow('1440px页面没有横向溢出');await shot('revision-final-1440');
  state.beforeRestart=await view();save();
 } else if(stage==='inspect'){
  await page.goto(base+state.route);await page.locator('.revision-status-strip').getByText('v5 · 单条数字与数据一致').waitFor();
  check('最终代码桌面回看已保存40%结果',(await view()).rechecks[0].result.calculated_value==='40');
  await page.getByRole('tab',{name:'复核结果',exact:true}).click();await noOverflow('最终代码1440px无横向溢出');await shot('revision-final-1440');
  await page.locator('.revision-evidence').screenshot({path:path.join(out,'revision-result-1440.png')});
  await page.setViewportSize({width:390,height:844});await noOverflow('最终代码390px无横向溢出');await shot('revision-mobile-390');
  await page.locator('.revision-evidence').screenshot({path:path.join(out,'revision-result-mobile-390.png')});
  const history=await get(`/projects/${state.pid}/revision-source/${state.source.id}`);const v4=history.versions.items.find(v=>v.version===4);
  await page.goto(base+`/app/projects/${state.pid}/review?check=${state.source.id}&target=0&revision=${v4.id}`);
  await page.getByRole('status').filter({hasText:'修订已改动目标数字以外的内容'}).waitFor();check('最终代码手机含义变化仍由后台阻断',await page.getByRole('button',{name:'确认此版本方案',exact:true}).isDisabled());
  await shot('revision-semantic-mobile-390');
 } else if(stage==='resume'){
  assert.ok(!state.afterChange,'Rule-change acceptance already recorded; use inspect for read-only review.');
  await page.goto(base+state.route);await page.locator('.revision-status-strip').getByText('v5 · 单条数字与数据一致').waitFor();
  const resumed=await view();check('后台实际重启后版本依据与复核结果完整恢复',JSON.stringify(resumed)===JSON.stringify(state.beforeRestart));
  await page.getByRole('tab',{name:'复核结果',exact:true}).click();await shot('revision-after-restart-1440');
  // A current confirmation cannot survive a rule change, even through direct API.
  const head=await get(`/projects/${state.pid}/rule-snapshots`);const r=state.snapshot;
  await post(`/projects/${state.pid}/rule-snapshots`,{previous_id:head.current_id,context_hash:head.context_hash,constraints:{...r.constraints,precision:1},sources:Object.fromEntries(fields.map(k=>[k,{asset_id:r.sources[k].asset_id,paragraph_id:r.sources[k].paragraph_id,quote:r.sources[k].quote}])),confirmed_fields:fields,unresolved:[],change_reason:'独立合成验收：规则变更后旧确认不可继续使用。'});
  const cf=resumed.confirmation;const blocked=await context.request.post(base+`/api/projects/${state.pid}/revisions/${state.current}/recheck`,{headers,data:{expected_head:state.current,confirmation_id:cf.id}});check('规则变化后直接执行旧确认被后台409拒绝',blocked.status()===409);
  await page.reload();await page.locator('.revision-status-strip').getByText('v5 · 已过期 · 待复核').waitFor();check('规则变化后旧结果标为待复核',true);await shot('revision-stale-1440');
  await page.setViewportSize({width:390,height:844});await noOverflow('过期状态390px页面无横向溢出');await shot('revision-stale-mobile-390');
  state.afterChange=await view();save();
  // Restore the explicit rule via a NEW snapshot; old confirmations stay invalid.
  const latest=await get(`/projects/${state.pid}/rule-snapshots`);
  await post(`/projects/${state.pid}/rule-snapshots`,{previous_id:latest.current_id,context_hash:latest.context_hash,constraints:r.constraints,sources:Object.fromEntries(fields.map(k=>[k,{asset_id:r.sources[k].asset_id,paragraph_id:r.sources[k].paragraph_id,quote:r.sources[k].quote}])),confirmed_fields:fields,unresolved:[],change_reason:'合成验收后明确恢复原统计口径，追加新快照并重新确认。'});
  await page.reload();await page.locator('.revision-recheck').waitFor();await recheckUI('consistent');
  check('规则重新确认后产生新复核并保留旧结果',(await view()).rechecks.length===2);
  await shot('revision-mobile-390');await page.setViewportSize({width:1440,height:1050});await shot('revision-final-1440');
  state.final=await view();save();
 }else throw Error('Unknown stage');
 check('浏览器没有前端运行异常',errors.length===0);check('没有发起任何AI任务写入或模型请求',modelAttempts===0);
 state.modelRequests=0;save();
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
