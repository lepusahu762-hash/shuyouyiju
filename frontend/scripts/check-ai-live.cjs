// EXPLICIT PAID ACCEPTANCE. Run each named stage once after offline tests.
// Requires the real backend with SYJ_AI_REQUEST_AUDIT_PATH and a 12-request cap.
// No automatic model retry, no simulated provider, no credential inspection.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const fs = require('node:fs'); const path = require('node:path'); const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:5173';
const out = path.resolve(__dirname, '../../artifacts/ai-live');
const fixture = path.resolve(__dirname, '../../artifacts/ai-demo');
const stage = process.argv[2];
const statePath = path.join(out, 'browser-run.json');
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath)) : { checks: [], tasks: {} };
function save() { fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); }
function check(name, value) { assert.ok(value, name); if (!state.checks.includes(name)) state.checks.push(name); save(); console.log('PASS', name); }
async function main() {
 fs.mkdirSync(out, { recursive: true });
 const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
 const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, reducedMotion: 'reduce',
   ...(state.pid ? { storageState: path.join(out, 'session.json') } : {}) });
 const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
 async function get(url) { const r = await context.request.get(base+'/api'+url); assert.equal(r.status(),200,await r.text()); return r.json(); }
 async function waitTask(id, statuses) {
   for (let i=0;i<450;i++) {
     const t = await get('/ai-tasks/'+id);
     state.tasks[id] = t; save();
     if (statuses.includes(t.status)) return t;
     if (['failed','cancelled','stale','insufficient'].includes(t.status)) throw new Error(`Task stopped: ${t.status}: ${t.error || t.payload.message || ''}`);
     await new Promise(r=>setTimeout(r,300));
   }
   throw new Error('Task wait timed out; do not restart or retry blindly.');
 }
 async function openTask(id) {
   await page.goto(base+state.route+'?task='+id); await page.locator('.ai-task').waitFor();
 }
 async function shot(name) {
   await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo({top:0,behavior:'instant'});});
   await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
 }
 try {
  if (stage === 'setup') {
   assert.ok(!state.pid, 'Setup already exists. Reuse saved state.');
   state.email=`ai-live-${Date.now()}@example.com`; state.password='Evidence2026!'; save();
   await page.goto(base+'/auth?mode=register'); await page.getByLabel('邮箱',{exact:true}).fill(state.email);await page.getByLabel('密码',{exact:true}).fill(state.password);await page.getByLabel('确认密码',{exact:true}).fill(state.password);await page.locator('.auth-submit').click();await page.waitForURL('**/app');
   await context.storageState({path:path.join(out,'session.json')});
   const config = await get('/ai/config');
   check('真实后台配置qwen3.7-plus/北京，模拟模式关闭',config.configured && !config.test_mode && config.model==='qwen3.7-plus' && config.region==='cn-beijing');
   state.config=config;
   await page.getByRole('button',{name:'创建第一个项目',exact:true}).click();await page.getByLabel('项目名称',{exact:true}).fill('真实AI验收 · 合成满意率200条');await page.getByRole('button',{name:'创建项目',exact:true}).click();await page.waitForURL('**/materials');await page.locator('.material-columns').waitFor();
   state.pid=new URL(page.url()).pathname.split('/')[3];state.route=`/app/projects/${state.pid}/ai-verification`;save();
   await page.getByLabel('选择资料文件').setInputFiles(['合成测试_200条记录.csv','合成测试_AI报告.docx','合成测试_统计规则.docx'].map(n=>path.join(fixture,n)));
   let assets; for(let i=0;i<100;i++){assets=await get(`/projects/${state.pid}/assets`);if(assets.length===3&&assets.every(a=>a.status==='ready'))break;await new Promise(r=>setTimeout(r,250));}
   assert.ok(assets.length===3&&assets.every(a=>a.status==='ready'),'upload parse');
   state.table=assets.find(a=>a.extension==='.csv');state.report=assets.find(a=>a.name.includes('AI报告'));state.rule=assets.find(a=>a.name.includes('统计规则'));save();
   check('真实浏览器上传合成CSV/DOCX并解析200条',state.table.summary.sheets[0].row_count===200);
   await page.locator('.project-steps').getByRole('link',{name:/AI 辅助单条核验/}).click();await page.locator('.ai-source').waitFor();
   await page.locator('.ai-rule-setup summary').click();await page.locator('.ai-rule-setup label').filter({hasText:state.rule.name}).getByRole('checkbox').click();
   await page.getByLabel('报告资料',{exact:true}).selectOption(state.report.id);await page.locator('.ai-paragraphs button').filter({hasText:'满意率为72%'}).waitFor();
   const roles=await get(`/projects/${state.pid}/rule-materials`);check('通过界面指定真实统计规则资料',roles.includes(state.rule.id));
   await shot('live-ready-desktop');
  } else if (stage?.startsWith('extract')) {
   const which = stage.slice(7);assert.ok(['72','80','points'].includes(which));assert.ok(!state['task'+which],'Task already created; reuse existing result.');
   await page.goto(base+state.route);await page.locator('.ai-source').waitFor();
   await page.getByLabel('报告资料',{exact:true}).selectOption(state.report.id);
   await page.locator('.ai-paragraphs button').filter({hasText:which==='points'?'比去年提升8个百分点':`满意率为${which}%`}).click();
   await page.getByRole('checkbox',{name:/同意本次调用/}).check();
   await page.getByRole('button',{name:'提取最多5条候选陈述',exact:true}).click();
   await page.waitForURL('**/*?task=*');const id=new URL(page.url()).searchParams.get('task');state['task'+which]=id;save();
   const t=await waitTask(id,['candidates']);
   check(`真实模型提取${which}候选`,t.payload.candidates.length>0&&t.payload.candidates.length<=5);
   console.log(JSON.stringify({task:id,status:t.status,requests:t.request_count,candidates:t.payload.candidates},null,2));
   await shot(`live-candidates-${which}`);
  } else if (stage?.startsWith('plan')) {
   const which=stage.slice(4),id=state['task'+which];assert.ok(id);
   const before=await get('/ai-tasks/'+id);assert.equal(before.status,'candidates','Do not repeat planning');
   await openTask(id);const buttons=page.locator('.ai-candidates button');
   const index=before.payload.candidates.findIndex(c=>which==='points'?c.unit==='percentage_point':c.reported_value===which);
   assert.ok(index>=0,'candidate value matches original');await buttons.nth(index).click();
   const t=await waitTask(id,[which==='points'?'insufficient':'awaiting_confirmation']);
   if(which==='points')check('真实百分点陈述无基期证据，不生成通过或计算',t.status==='insufficient'&&!t.run_id&&t.payload.message.includes('基期证据'));
   else check(`真实模型为${which}%调用规则工具并给出待确认方案`,!!t.payload.plan && !!t.payload.citations?.length && t.trace.some(e=>e.name==='search_rules'));
   console.log(JSON.stringify({task:id,status:t.status,requests:t.request_count,payload:t.payload},null,2));
   if(which!=='points')await page.locator('.ai-plan-editor').waitFor();
   await shot(`live-plan-${which}`);
  } else if(stage?.startsWith('execute')) {
   const which=stage.slice(7),id=state['task'+which];assert.ok(id);
   const before=await get('/ai-tasks/'+id);assert.equal(before.status,'awaiting_confirmation','Do not repeat execution');
   const p=before.payload.plan,cols=state.table.summary.sheets[0].columns;
   // Validate the MODEL proposal against the independently uploaded synthetic rule.
   // Never replace fields or put expected results into tool responses.
   assert.equal(p.asset_id,state.table.id);assert.equal(p.sheet_id,state.table.summary.sheets[0].id);
   assert.deepEqual(p.scope,[{column_id:cols[1].id,kind:'text',value:'有效'}]);
   assert.deepEqual(p.numerator,[{column_id:cols[2].id,kind:'text',value:'满意'}]);
   assert.ok(['keep','exclude','block'].includes(p.null_policy));assert.equal(p.precision,0);assert.equal(p.operation,'ratio');
   const citation=before.payload.citations.find(c=>before.payload.citation_ids.includes(c.citation_id)&&c.text.includes('分母')&&c.asset_id===state.rule.id);assert.ok(citation,'Actual rule citation required');
   await openTask(id);await page.locator('.ai-plan-editor').waitFor();
   if(p.null_policy !== 'keep') {
     // Human review corrects the proposal using the ACTUAL uploaded rule, through UI.
     await page.locator('.ai-adjustments summary').click();
     await page.locator('.ai-adjustments .work-field').filter({hasText:/^空值处理/}).locator('select').selectOption('keep');
     state['adjustment'+which]={field:'null_policy',suggested:p.null_policy,confirmed:'keep',basis:citation.citation_id};save();
     check(`人工复核纠正${which}%建议空值策略为规则要求的保留`,true);
   }
   await page.getByLabel('确认说明',{exact:true}).fill('已逐项核对上传的合成统计规则：分母为记录状态等于有效的记录，分子为其中反馈选项等于满意的记录；明确采用保留空值且不匹配，按记录统计、不去重。精度0位小数，使用系统显示的十进制ROUND_HALF_UP四舍五入后严格比较，不截断。已检查并纠正建议中的空值处理差异，待确认问题已解决。');
   await page.getByRole('checkbox',{name:/我已核对所选规则/}).check();await page.getByRole('checkbox',{name:new RegExp(`我已核对原文 ${which}%`)}).check();
   await shot(`live-confirmed-plan-${which}`);
   await page.getByRole('button',{name:'确认方案，执行真实计算',exact:true}).click();
   const t=await waitTask(id,['completed']);
   check(`真实${which}%流程调用既有引擎计算144/180=80`,t.run.result.numerator===144&&t.run.result.denominator===180&&t.run.result.display_value==='80');
   check(`真实${which}%数字比较状态正确`,t.check.status===(which==='72'?'different':'consistent')&&t.check.result.difference_pp===(which==='72'?'8':'0'));
   await page.locator('.ai-result').waitFor();await shot(`live-result-${which}-desktop`);
   console.log(JSON.stringify({task:id,status:t.status,requests:t.request_count,tools:t.tool_count,result:t.run.result,check:t.check.result},null,2));
  } else if (stage==='verify-saved') {
   const ledgerBefore=JSON.parse(fs.readFileSync(path.join(out,'request-ledger.json'))).requests.length;
   for(const which of ['72','80','points']) {
     const id=state['task'+which],before=state.tasks[id];
     await openTask(id);await page.reload();await page.locator('.ai-task').waitFor();
     const current=await get('/ai-tasks/'+id);
     check(`后台重启和刷新恢复${which}的方案、规则及真实调用记录`,JSON.stringify(current.payload)===JSON.stringify(before.payload)&&JSON.stringify(current.trace)===JSON.stringify(before.trace)&&current.request_count===before.request_count&&current.status===before.status);
     if(which!=='points') {
       assert.equal(current.payload.confirmed_plan.null_policy,'keep');assert.equal(current.check.result.calculated_value,'80');
       await page.locator('.ai-result').waitFor();
     } else {
       await page.locator('.ai-task h2').filter({hasText:'证据不足'}).waitFor();
       await shot('live-insufficient-points-desktop');
     }
   }
   const original=await context.request.get(base+`/api/assets/${state.table.id}/original`);
   check('本轮上传原件仍与合成资料逐字节一致',(await original.body()).equals(fs.readFileSync(path.join(fixture,'合成测试_200条记录.csv'))));
   check('恢复检查没有增加任何真实模型请求',JSON.parse(fs.readFileSync(path.join(out,'request-ledger.json'))).requests.length===ledgerBefore);
   state.processRestartVerified=true;save();
  } else if (stage==='evidence') {
   const id=state.task72;await openTask(id);await page.locator('.ai-result').waitFor();
   const reportHref=await page.locator('.ai-source-location').getAttribute('href');
   const source=await context.newPage();await source.goto(base+reportHref);await source.locator('.linked-source-paragraph').waitFor();check('真实报告原句链接定位高亮72%段落',(await source.locator('.linked-source-paragraph').innerText()).includes('72%'));await source.screenshot({path:path.join(out,'live-report-source.png'),fullPage:true});await source.close();
   await page.getByRole('tab',{name:'规则原文',exact:true}).click();await page.locator('.ai-rule').first().waitFor();
   const rules=page.locator('.ai-rule').filter({hasText:'分母'}).first();assert.ok((await rules.innerText()).includes(state.rule.id));
   const href=await rules.locator('a').getAttribute('href');const rulePage=await context.newPage();await rulePage.goto(base+href);await rulePage.locator('.linked-source-paragraph').waitFor();check('真实规则引用链接定位上传原文',(await rulePage.locator('.linked-source-paragraph').innerText()).includes('分母'));await rulePage.screenshot({path:path.join(out,'live-rule-source.png'),fullPage:true});await rulePage.close();await shot('live-rule-citations');
   await page.getByRole('tab',{name:'原始数据',exact:true}).click();await page.locator('.calc-data-table tbody tr').first().waitFor();
   check('真实计算证据只加载25条',await page.locator('.calc-data-table tbody tr').count()===25);
   await page.getByLabel('证据记录分组',{exact:true}).selectOption('numerator');await page.locator('.evidence-card .calc-pagination > span').filter({hasText:'144'}).waitFor();
   const rowButton=page.locator('.calc-data-table tbody tr').first().getByRole('button');await rowButton.click();
   const rawHref=await page.locator('.record-focus a').getAttribute('href');const rawPage=await context.newPage();await rawPage.goto(base+rawHref);await rawPage.locator('.linked-source-row').waitFor();check('真实原始数据来源行定位可用',await rawPage.locator('.linked-source-row').count()===1);await rawPage.screenshot({path:path.join(out,'live-row-source.png'),fullPage:true});await rawPage.close();await shot('live-row-evidence');
   await page.getByRole('tab',{name:'比较结果',exact:true}).click();await page.setViewportSize({width:390,height:844});check('真实结果390px无页面横向溢出',await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));await shot('live-result-72-mobile');
   const before=await get('/ai-tasks/'+id);await page.reload();await page.locator('.ai-result').waitFor();const restored=await get('/ai-tasks/'+id);
   check('刷新恢复真实方案、结果、规则快照和调用摘要且不新增请求',JSON.stringify(before.payload)===JSON.stringify(restored.payload)&&JSON.stringify(before.trace)===JSON.stringify(restored.trace)&&before.request_count===restored.request_count&&restored.check.result.difference_pp==='8');
   await page.locator('.ai-audit summary').click();await shot('live-restored-audit-mobile');
   await page.goto(base+`/app/projects/${state.pid}/calculations?run=${restored.run_id}`);await page.locator('.numeric-check-result').first().waitFor();check('真实AI结果可由原手动核验历史打开',(await page.locator('.computed-value strong').innerText()).includes('80'));
  } else throw new Error('Choose setup / extract72 / plan72 / execute72 / evidence / extract80 / plan80 / execute80 / extractpoints / planpoints / verify-saved.');
  check('本阶段浏览器无运行时异常',errors.length===0);
 } finally { await context.storageState({path:path.join(out,'session.json')});save();await browser.close(); }
}
main().catch(error=>{console.error(error);process.exit(1);});
