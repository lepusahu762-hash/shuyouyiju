// Explicit synthetic acceptance. `offline` never uses a real model; `live` is paid.
// Stage guards prevent duplicate paid extraction/planning/execution. Backend ledger cap=6.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const [mode, stage] = process.argv.slice(2);
assert.ok(['offline','live'].includes(mode));
const base = `http://127.0.0.1:${mode==='live'?5173:5174}`;
const out = path.resolve(__dirname, `../../artifacts/rule-constraints-v06/${mode}`);
const fixture = path.resolve(__dirname, '../../artifacts/rule-conflict-demo');
fs.mkdirSync(out,{recursive:true});
const statePath = path.join(out,'browser-run.json');
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath)) : { checks:[] };
const fields = ['表格资料','工作表','计算类型','指标','统计范围说明','分母／范围条件','分子条件','空值策略','显示及比较精度'];
const headers = {'X-Requested-With':'shuyouyiju'};
function save(){fs.writeFileSync(statePath,JSON.stringify(state,null,2));}
function check(name,value){assert.ok(value,name);if(!state.checks.includes(name))state.checks.push(name);save();console.log('PASS',name);}
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext({viewport:{width:1440,height:1080},reducedMotion:'reduce',...(state.pid?{storageState:path.join(out,'session.json')}:{})});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function get(url){const r=await context.request.get(base+'/api'+url);assert.equal(r.status(),200,await r.text());return r.json();}
 async function until(fn){for(let i=0;i<450;i++){if(await fn())return;await new Promise(r=>setTimeout(r,250));}throw Error('Timed out; inspect saved task before retry.');}
 async function taskAt(status){let t;await until(async()=>{t=await get('/ai-tasks/'+state.tid);state.task=t;save();if(['failed','cancelled','insufficient','stale'].includes(t.status))throw Error(`${t.status}: ${t.error||t.payload.message}`);return t.status===status;});return t;}
 async function open(){await page.goto(base+state.route+'?task='+state.tid);await page.locator('.ai-task').waitFor();}
 async function shot(name){await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo({top:0,behavior:'instant'});});await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});}
 try{
  if(stage==='setup'||stage==='ready'){
   if(stage==='setup'){
   assert.ok(!state.pid,'Setup already exists, reuse.');
   state.email=`rules-${mode}-${Date.now()}@example.com`;state.password='Evidence2026!';save();
   await page.goto(base+'/auth?mode=register');await page.getByLabel('邮箱',{exact:true}).fill(state.email);await page.getByLabel('密码',{exact:true}).fill(state.password);await page.getByLabel('确认密码',{exact:true}).fill(state.password);await page.locator('.auth-submit').click();await page.waitForURL('**/app');
   await context.storageState({path:path.join(out,'session.json')});
   const config=await get('/ai/config');check('使用预期真实／模拟客户端，配置可用',config.configured&&config.test_mode===(mode==='offline')&&(mode==='offline'||config.model==='qwen3.7-plus'));
   state.config=config;save();
   await page.getByRole('button',{name:'创建第一个项目',exact:true}).click();await page.getByLabel('项目名称',{exact:true}).fill(`${mode==='live'?'真实AI':'离线模拟'}验收 · 空值规则冲突12条`);await page.getByRole('button',{name:'创建项目',exact:true}).click();await page.waitForURL('**/materials');
   state.pid=new URL(page.url()).pathname.split('/')[3];state.route=`/app/projects/${state.pid}/ai-verification`;save();
   await page.getByLabel('选择资料文件').setInputFiles(['合成资料12条.csv','合成统计规则.docx','合成报告50.docx'].map(n=>path.join(fixture,n)));
   let assets;await until(async()=>{assets=await get(`/projects/${state.pid}/assets`);return assets.length===3&&assets.every(a=>a.status==='ready');});
   state.table=assets.find(a=>a.kind==='table');state.report=assets.find(a=>a.name.includes('报告'));state.rule=assets.find(a=>a.name.includes('规则'));save();
   check('浏览器真实注册、创建项目及上传改名12条CSV和两份DOCX',state.table.summary.sheets[0].row_count===12);
   }
   await page.goto(base+state.route);await page.locator('.ai-rule-setup summary').click();if(!(await get(`/projects/${state.pid}/rule-materials`)).includes(state.rule.id))await page.locator('.ai-rule-setup label').filter({hasText:state.rule.name}).getByRole('checkbox').click();
   await until(async()=>(await get(`/projects/${state.pid}/rule-materials`)).includes(state.rule.id));
   check('通过界面指定上传的规则资料',true);
   fs.writeFileSync(path.join(out,'演示账户.txt'),`仅本机合成演示账户（不提交Git）\n地址：${base}/auth\n邮箱：${state.email}\n密码：${state.password}\n项目：${state.route}\n`);
   await shot('ready-desktop');
  }else if(stage==='plan'){
   assert.ok(!state.tid,'Task already started; never repeat paid stage.');
   await page.goto(base+state.route);await page.getByLabel('报告资料',{exact:true}).selectOption(state.report.id);await page.locator('.ai-paragraphs button').filter({hasText:'50%'}).click();await page.getByRole('checkbox',{name:/同意本次调用/}).check();
   await page.getByRole('button',{name:'提取最多5条候选陈述',exact:true}).click();await page.waitForURL('**/*?task=*');state.tid=new URL(page.url()).searchParams.get('task');save();
   const extracted=await taskAt('candidates');const index=extracted.payload.candidates.findIndex(c=>c.reported_value==='50'&&c.unit==='percent');assert.ok(index>=0,'Extracted actual50%');
   await page.locator('.ai-candidates button').nth(index).click();const t=await taskAt('awaiting_confirmation');
   state.original=structuredClone(t.payload.plan);save();
   const p=t.payload.plan,cols=state.table.summary.sheets[0].columns;
   assert.ok(p,'AI returned plan');assert.equal(p.asset_id,state.table.id);assert.equal(p.sheet_id,state.table.summary.sheets[0].id);
   assert.deepEqual(p.scope,[{column_id:cols[1].id,kind:'text',value:'是'}]);assert.deepEqual(p.numerator,[{column_id:cols[2].id,kind:'text',value:'满意'}]);assert.equal(p.precision,0);assert.equal(p.operation,'ratio');
   check('模型用实际改名字段提出范围和分子条件，检索命中真实规则',t.payload.citations.some(c=>c.asset_id===state.rule.id&&c.text.includes('为空'))&&t.request_count===3);
   console.log(JSON.stringify({mode,model:t.payload.model.model,originalNull:p.null_policy,metric:p.metric,scope:p.scope_description,requests:t.request_count},null,2));
   await page.locator('.ai-plan-editor').waitFor();await shot('original-plan-desktop');
  }else if(stage==='rules'){
   const before=await get('/ai-tasks/'+state.tid);assert.ok(!before.payload.rule_snapshot,'Rule already saved; reuse.');await open();await page.locator('.rule-setup').waitFor();
   const editor=page.locator('.rule-setup');await editor.locator('.rule-plan-fields .work-field').filter({hasText:/^空值处理/}).locator('select').selectOption('keep');
   const citation=before.payload.citations.find(c=>c.asset_id===state.rule.id&&c.text.includes('为空'));assert.ok(citation);
   for(const label of fields){await editor.getByLabel(label+'的原文来源',{exact:true}).selectOption(citation.citation_id);await editor.getByRole('checkbox',{name:'确认规则'+label,exact:true}).check();}
   await editor.getByLabel('规则变更依据',{exact:true}).fill('逐项核对上传合成规则：纳入标记为是的全部记录进入分母，服务评价为空仍保留；其中满意记录为分子。按记录统计、不去重，精度0位。字段及来源已逐项确认。');
   await editor.getByRole('button',{name:'保存新规则快照并检查方案',exact:true}).click();
   await until(async()=>{const t=await get('/ai-tasks/'+state.tid);return !!t.payload.rule_snapshot;});
   const t=await get('/ai-tasks/'+state.tid);state.task=t;state.snapshot=t.payload.rule_snapshot;save();
   check('规则逐项确认、真实来源和不可变快照已保存',t.payload.rule_snapshot.constraints.null_policy==='keep'&&Object.keys(t.payload.rule_snapshot.sources).length===9);
   if(state.original.null_policy!=='keep'){
    check('后台主动发现原建议与保留空值规则冲突',t.rule_check.status==='conflict'&&t.rule_check.conflicts.some(c=>c.field==='null_policy'&&c.source.quote.includes('为空')));
    await page.locator('.rule-conflict').waitFor();
    const bypass=await context.request.post(base+`/api/ai-tasks/${state.tid}/confirm`,{headers,data:{plan:{...t.payload.draft_plan,confirmed:true},reported_value:'50',rules_confirmed:true,citation_ids:t.payload.citation_ids,rule_snapshot_id:t.payload.rule_snapshot.id,resolution:'勾选知晓也不能绕过。'}});
    check('绕过前端直接确认被409阻止且无新增模型请求',bypass.status()===409&&(await get('/ai-tasks/'+state.tid)).request_count===3);
    await page.locator('.rule-comparison').screenshot({path:path.join(out,'blocked-conflict-detail.png')});await shot('blocked-conflict-desktop');await page.setViewportSize({width:390,height:844});check('390px冲突状态无页面横向溢出',await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));await shot('blocked-conflict-mobile');
   }else{
    check('真实模型本次正确建议保留空值，不伪造错误输出',!t.rule_check.conflicts.length);await shot('matched-rule-desktop');
   }
  }else if(stage==='execute'){
   const before=await get('/ai-tasks/'+state.tid);assert.equal(before.status,'awaiting_confirmation');assert.ok(!before.run_id);await open();
   const adjustments=page.locator('.ai-adjustments');await adjustments.evaluate(el=>el.open=true);await adjustments.locator('.work-field').filter({hasText:/^空值处理/}).locator('select').selectOption('keep');
   await page.getByRole('button',{name:'保存方案并检查规则',exact:true}).click();
   await until(async()=>(await get('/ai-tasks/'+state.tid)).payload.draft_plan?.null_policy==='keep');
   await page.getByLabel('确认说明',{exact:true}).fill('已核对上传规则和不可变结构化快照，分母保留纳入范围内的评价空值；不去重，精度0位。所有待确认事项均已按规则明确，AI原建议留存，最终方案另存。');
   await page.getByRole('checkbox',{name:/我已核对所选规则/}).check();
   // Citation checkbox changes confirmation readiness; recheck current full draft.
   await page.getByRole('button',{name:'保存方案并检查规则',exact:true}).click();
   await page.getByRole('checkbox',{name:/我已核对原文 50%/}).check();
   await page.getByRole('button',{name:'确认方案，执行真实计算',exact:true}).click();const t=await taskAt('completed');
   state.completed=t;save();
   check('确定性引擎4÷10=40%，报告50%相差10个百分点',t.run.result.numerator===4&&t.run.result.denominator===10&&t.run.result.display_value==='40'&&t.check.status==='different'&&t.check.result.difference_pp==='-10');
   check('AI原建议、最终确认方案、规则快照和修改记录分别留存',JSON.stringify(t.payload.plan)===JSON.stringify(state.original)&&t.payload.confirmed_plan.null_policy==='keep'&&t.rule_check.status==='confirmed'&&t.payload.plan_revisions.length>=1);
   await page.locator('.ai-result').waitFor();await shot('result-40-desktop');
   await page.getByRole('tab',{name:'原始数据',exact:true}).click();await page.locator('.calc-data-table tbody tr').first().waitFor();check('分母证据真实包含10条和两条评价空值',await page.locator('.calc-data-table tbody tr').count()===10&&await page.locator('.calc-data-table .null-cell').count()===2);
   await page.getByRole('button',{name:'定位源行 10',exact:true}).click();const rowLink=await page.locator('.record-focus a').getAttribute('href');
   const linked=await context.newPage();await linked.goto(base+rowLink);await linked.locator('.linked-source-row').waitFor();check('原始空值记录可定位到资料页',true);await linked.close();
   await shot('evidence-desktop');
   await page.getByRole('tab',{name:'规则原文',exact:true}).click();await page.locator('.ai-rule').first().waitFor();const ruleLink=await page.locator('.ai-rule > a').first().getAttribute('href');const rulePage=await context.newPage();await rulePage.goto(base+ruleLink);await rulePage.locator('.linked-source-paragraph').waitFor();check('引用规则原文可定位',true);await rulePage.close();
   const reportLink=await page.locator('.ai-source-location').getAttribute('href');const rp=await context.newPage();await rp.goto(base+reportLink);await rp.locator('.linked-source-paragraph').waitFor();check('报告原句50%可定位',true);await rp.close();
   await page.getByRole('tab',{name:'比较结果',exact:true}).click();await page.setViewportSize({width:390,height:844});check('390px结果无页面级横向溢出',await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));await shot('result-40-mobile');
   await page.getByRole('tab',{name:'原始数据',exact:true}).click();await page.locator('.calc-data-table tbody tr').first().waitFor();check('390px证据表格只在自身区域滚动',await page.locator('.calc-table-scroll').evaluate(el=>el.getBoundingClientRect().right<=innerWidth&&getComputedStyle(el).overflowX==='auto'));await shot('evidence-mobile');
   await page.reload();await page.locator('.ai-result').waitFor();check('刷新恢复核验结果和规则确认',(await get('/ai-tasks/'+state.tid)).rule_check.status==='confirmed');
  }else if(stage==='review'){
   // Read-only recapture of saved results, never repeats a paid model call.
   await open();await page.locator('.ai-result').waitFor();
   await page.locator('.ai-evidence-card').screenshot({path:path.join(out,'result-40-detail.png')});await shot('result-40-desktop');
   await page.setViewportSize({width:390,height:844});await shot('result-40-mobile');
   if(mode==='offline'){
    await page.setViewportSize({width:1440,height:1080});
    if(!state.conflictTid){
     await page.goto(base+state.route);await page.getByLabel('报告资料',{exact:true}).selectOption(state.report.id);await page.locator('.ai-paragraphs button').filter({hasText:'50%'}).click();await page.getByRole('checkbox',{name:/同意本次调用/}).check();
     await page.getByRole('button',{name:'提取最多5条候选陈述',exact:true}).click();await page.waitForURL('**/*?task=*');state.conflictTid=new URL(page.url()).searchParams.get('task');save();
     await page.locator('.ai-candidates button').first().waitFor();await page.locator('.ai-candidates button').first().click();await page.locator('.ai-plan-editor').waitFor();
     const bound=await context.request.post(base+`/api/ai-tasks/${state.conflictTid}/bind-rule`,{headers,data:{snapshot_id:state.snapshot.id}});assert.equal(bound.status(),200,await bound.text());
    }
    await page.goto(base+state.route+'?task='+state.conflictTid);await page.locator('.rule-conflict').waitFor();
    check('单独保留离线错误建议供回看，未追加真实模型请求',(await get('/ai-tasks/'+state.conflictTid)).payload.plan.null_policy==='exclude');
    await page.locator('.rule-comparison').screenshot({path:path.join(out,'blocked-conflict-detail.png')});await shot('blocked-conflict-desktop');
    await page.setViewportSize({width:390,height:844});check('390px规则三列对照纵向排列',await page.locator('.rule-three-values').first().evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length===1));await shot('blocked-conflict-mobile');
   }
  }else if(stage==='verify-saved'){
   assert.ok(state.completed);await open();await page.reload();await page.locator('.ai-result').waitFor();const t=await get('/ai-tasks/'+state.tid);
   check('后台重启后规则快照、修改记录、结果及请求记录完整恢复',JSON.stringify(t.payload)===JSON.stringify(state.completed.payload)&&JSON.stringify(t.trace)===JSON.stringify(state.completed.trace)&&JSON.stringify(t.check.result)===JSON.stringify(state.completed.check.result)&&t.rule_check.status==='confirmed'&&t.request_count===4);
   const snaps=await get(`/projects/${state.pid}/rule-snapshots`);check('重启后不可变规则快照恢复',JSON.stringify(snaps.items[0])===JSON.stringify(state.snapshot));
   const raw=await context.request.get(base+`/api/assets/${state.table.id}/original`);check('原始CSV逐字节保留',Buffer.compare(await raw.body(),fs.readFileSync(path.join(fixture,'合成资料12条.csv')))===0);
   await page.setViewportSize({width:390,height:844});check('重启刷新390px布局正常',await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));await shot('restored-mobile');
  }else throw Error('Unknown stage');
  check('浏览器无运行时异常',errors.length===0);
  await context.storageState({path:path.join(out,'session.json')});
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.message);process.exit(1);});
