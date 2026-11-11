// Uses running FastAPI/Vite and independently generated synthetic fixtures.
// Run `seed`, restart the API with the same data directory, then `restart`.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5173';
const out = path.resolve(process.env.QA_OUTPUT || path.join(__dirname, '../../artifacts/calculation-v04'));
const fixtures = path.resolve(process.env.QA_FIXTURES || path.join(__dirname, '../../artifacts/calculation-demo'));
const phase = process.argv[2] || 'seed';
const headers = { 'X-Requested-With': 'shuyouyiju' };
const results = [];
function check(name, value) { assert.ok(value, name); results.push(name); console.log('PASS', name); }
async function until(fn, message) { for (let i=0;i<80;i++) { const value=await fn(); if(value) return value;await new Promise(resolve=>setTimeout(resolve,250)); }throw new Error('Timeout: '+message); }
async function main() {
 fs.mkdirSync(out,{recursive:true});
 const state=phase==='restart'?JSON.parse(fs.readFileSync(path.join(out,'run.json'))):{email:`calc-${Date.now()}@example.com`,password:'Evidence2026!'};
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1080},reducedMotion:'reduce',...(phase==='restart'?{storageState:path.join(out,'session.json')}:{})});
 const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const get=async url=>{const response=await context.request.get(base+'/api'+url);assert.equal(response.status(),200,await response.text());return response.json();};
 const post=async(url,data)=>{const response=await context.request.post(base+'/api'+url,{headers,data});assert.equal(response.status(),201,await response.text());return response.json();};
 async function screenshot(name) {await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo({top:0,behavior:'instant'});});await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});}
 async function compare(paragraphIndex,value,expected) {
  await page.getByLabel('报告资料',{exact:true}).selectOption(state.reportId);
  await until(()=>page.getByLabel('报告段落',{exact:true}).locator('option').count().then(count=>count>2),'report paragraphs');
  await page.getByLabel('报告段落',{exact:true}).selectOption(state.paragraphs[paragraphIndex].id);
  await page.getByLabel('待核验的报告百分比',{exact:false}).fill(value);
  await page.getByRole('checkbox',{name:/输入值来自所选原文/}).check();
  await page.getByRole('button',{name:'核验并保存记录',exact:true}).click();
  await page.locator('.conclusion-card > .calc-save-notice').waitFor();
  await until(()=>page.locator('.numeric-check-result').first().getAttribute('class').then(value=>value.includes('state-'+expected)),'check status '+expected);
 }
 try {
  if(phase==='restart') {
   const saved=await get('/runs/'+state.rid);check('实际后台进程重启后计算记录和80%结果保留',saved.result.display_value==='80'&&saved.status==='stale');
   const checks=await get('/runs/'+state.rid+'/checks');check('重启后72/80核验及报告原文保留',checks.total===2&&checks.items.some(check=>check.result.status==='different'&&check.result.difference_pp==='8')&&checks.items.some(check=>check.result.status==='consistent'));
   const evidence=await get(`/runs/${state.rid}/evidence?group=numerator&offset=125`);check('重启后证据分页与稳定来源保留',evidence.total===144&&evidence.rows.length===19&&evidence.rows[0].id===state.evidenceId);
   await page.goto(base+state.route+'?run='+state.rid);await page.locator('.computed-value strong').waitFor();await page.reload();await page.locator('.numeric-check-result').first().waitFor();check('计算深层路由直接访问及刷新恢复历史结果',await page.locator('.calculation-status').innerText()==='待重新计算／复核');
   check('原上传文件保持字节一致',(await (await context.request.get(base+'/api/assets/'+state.tableId+'/original')).body()).equals(fs.readFileSync(path.join(fixtures,'合成测试_200条记录.csv'))));
   const rerun=await post('/projects/'+state.pid+'/runs',{...saved.spec,confirmed:true,context_hash:(await get('/projects/'+state.pid+'/calculation-context')).context_hash});
   await page.goto(base+state.route+'?run='+rerun.id);await page.locator('.computed-value strong').waitFor();await compare(2,'80','consistent');
   check('新口径下重新计算和复核生成新记录',rerun.id!==state.rid&&(await get('/runs/'+rerun.id+'/checks')).items[0].status==='consistent');
   await page.setViewportSize({width:390,height:844});
   await page.getByLabel('证据记录分组',{exact:true}).selectOption('numerator');
   await until(()=>page.locator('.evidence-card .calc-pagination > span').innerText().then(text=>text.includes('共 144 条')),'mobile evidence');
   await page.getByRole('button',{name:'定位源行 2',exact:true}).click();
   check('390px手机可切换证据并定位来源',await page.locator('.record-focus').isVisible());
   await compare(1,'72','different');
   check('390px手机可真实核验72%并保存8个百分点差异',(await page.locator('.numeric-check-result').first().innerText()).includes('8 个百分点'));
   await page.locator('.result-card').screenshot({path:path.join(out,'result-mobile.png')});
   await page.locator('.numeric-check-result').first().screenshot({path:path.join(out,'difference-mobile.png')});
   await screenshot('recalculated-mobile');
   await page.setViewportSize({width:1440,height:1080});
   await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo({top:0,behavior:'instant'});});
   await page.screenshot({path:path.join(out,'overview-desktop.png')});
   await page.locator('.result-card').screenshot({path:path.join(out,'result-desktop.png')});
   await page.locator('.evidence-card').screenshot({path:path.join(out,'evidence-desktop.png')});
   await page.locator('.numeric-check-result').first().screenshot({path:path.join(out,'difference-desktop.png')});
   await screenshot('recalculated-desktop');
  } else {
   await page.goto(base+'/auth?mode=register');await page.getByLabel('邮箱',{exact:true}).fill(state.email);await page.getByLabel('密码',{exact:true}).fill(state.password);await page.getByLabel('确认密码',{exact:true}).fill(state.password);await page.locator('.auth-submit').click();await page.waitForURL('**/app');await page.locator('.workspace-empty').waitFor();check('原注册登录工作空间流程可用',true);
   await page.getByRole('button',{name:'创建第一个项目',exact:true}).click();await page.getByLabel('项目名称',{exact:true}).fill('合成演示 · 200条记录与百分比核验');await page.getByRole('button',{name:'创建项目',exact:true}).click();await page.waitForURL('**/materials');await page.locator('.material-columns').waitFor();state.pid=new URL(page.url()).pathname.split('/')[3];state.route='/app/projects/'+state.pid+'/calculations';
   await page.getByLabel('选择资料文件').setInputFiles(['合成测试_200条记录.csv','合成测试_200条记录.xlsx','合成测试_数字结论.docx'].map(name=>path.join(fixtures,name)));
   const assets=await until(async()=>{const assets=await get('/projects/'+state.pid+'/assets');return assets.length===3&&assets.every(asset=>asset.status==='ready')?assets:false;},'uploaded and parsed');
   const table=assets.find(asset=>asset.extension==='.csv'),report=assets.find(asset=>asset.extension==='.docx');state.tableId=table.id;state.reportId=report.id;state.paragraphs=(await get('/assets/'+report.id+'/preview')).paragraphs;
   check('原CSV/XLSX/DOCX上传解析可复用',table.summary.sheets[0].row_count===200&&assets.find(asset=>asset.extension==='.xlsx').summary.sheets[0].row_count===200&&state.paragraphs.length===4);
   await page.locator('.project-steps').getByRole('link',{name:/计算与证据/}).click();await page.locator('.calc-settings').waitFor();check('原资料页进入新工作区',new URL(page.url()).pathname===state.route);
   await screenshot('empty-desktop');
   await page.getByLabel('表格资料',{exact:true}).selectOption(table.id);await page.getByLabel('计算工作表',{exact:true}).selectOption('s1');await page.getByLabel('指标名称',{exact:true}).fill('有效记录中的满意记录占比');await page.getByLabel('统计范围说明',{exact:true}).fill('本合成测试表中，记录状态为有效的记录；单位为记录/行，不去重。');
   await page.getByRole('button',{name:'添加范围条件',exact:true}).click();await page.getByLabel('范围字段1',{exact:true}).selectOption(table.summary.sheets[0].columns[1].id);await page.getByLabel('范围值1',{exact:true}).fill('有效');await page.getByRole('button',{name:'添加分子条件',exact:true}).click();await page.getByLabel('分子字段1',{exact:true}).selectOption(table.summary.sheets[0].columns[2].id);await page.getByLabel('分子值1',{exact:true}).fill('满意');
   await page.getByRole('button',{name:'运行计算并保存',exact:true}).click();await page.locator('.calc-settings .work-error').waitFor();check('未确认空值和口径时不生成正常结果',(await page.locator('.calc-settings .work-error').innerText()).includes('需要确认')&&await page.locator('.computed-value').count()===0);
   await page.getByLabel('条件字段空值处理',{exact:true}).selectOption('keep');await page.getByRole('checkbox',{name:/按记录／行统计/}).check();await page.getByRole('button',{name:'运行计算并保存',exact:true}).click();await page.locator('.computed-value strong').waitFor();state.rid=new URL(page.url()).searchParams.get('run');
   const saved=await get('/runs/'+state.rid);check('完整200条计算为144/180=80%，排除20',saved.result.total===200&&saved.result.denominator===180&&saved.result.numerator===144&&saved.result.excluded===20&&saved.result.display_value==='80');
   await until(()=>page.locator('.calc-data-table tbody tr').count().then(count=>count===25),'first evidence page');check('浏览器证据只加载25条而计算使用全表',await page.locator('.calc-data-table tbody tr').count()===25);
   await page.getByLabel('证据记录分组',{exact:true}).selectOption('numerator');await until(()=>page.locator('.evidence-card .calc-pagination > span').innerText().then(text=>text.includes('共 144 条')),'numerator count');await page.locator('.evidence-card').getByRole('button',{name:'下一页',exact:true}).click();await page.getByRole('button',{name:'定位源行 27',exact:true}).waitFor();await page.getByRole('button',{name:'定位源行 27',exact:true}).click();check('证据分页和原始行定位可用',(await page.locator('.record-focus').innerText()).includes(':r27'));
   const sourceLink=page.locator('.record-focus a');const materialPage=await context.newPage();await materialPage.goto(base+await sourceLink.getAttribute('href'));await materialPage.locator('.linked-source-row').waitFor();check('证据来源链接在原资料页高亮原行',(await materialPage.locator('.linked-source-row th').innerText())==='27');await materialPage.close();
   const denominatorIds=new Set();const numeratorIds=new Set();for(const [group,ids] of [['denominator',denominatorIds],['numerator',numeratorIds]]){for(let offset=0;offset<180;offset+=100){const evidence=await get(`/runs/${state.rid}/evidence?group=${group}&offset=${offset}&limit=100`);for(const row of evidence.rows)ids.add(row.id);}}
   check('全部证据数量一致，分子严格包含于分母',denominatorIds.size===180&&numeratorIds.size===144&&[...numeratorIds].every(id=>denominatorIds.has(id)));
   state.evidenceId=(await get(`/runs/${state.rid}/evidence?group=numerator&offset=125`)).rows[0].id;
   await compare(1,'72','different');check('报告72%与计算80%存在差异8个百分点',(await page.locator('.numeric-check-result').first().innerText()).includes('8 个百分点'));await screenshot('different-desktop');
   await compare(2,'80','consistent');check('报告80%在相同范围和精度下与数据一致',(await page.locator('.numeric-check-result').first().innerText()).includes('0 个百分点'));
   await page.reload();await page.locator('.numeric-check-result').first().waitFor();check('刷新后计算与两次核验均可加载',(await get('/runs/'+state.rid+'/checks')).total===2&&await page.locator('.numeric-check-result').count()===2);
   await page.getByLabel('证据记录分组',{exact:true}).selectOption('denominator');await page.locator('.calc-data-table tbody tr').first().waitFor();await screenshot('calculation-desktop');
   for(const width of [390,768,1440]){await page.setViewportSize({width,height:width===390?844:1080});check(`${width}px 工作区无页面横向溢出`,await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));check(`${width}px 证据表格独立滚动`,await page.locator('.calc-table-scroll').evaluate(el=>el.getBoundingClientRect().right<=innerWidth&&getComputedStyle(el).overflowX==='auto'));await screenshot('calculation-'+width);}
   await page.setViewportSize({width:1440,height:1080});
   await page.getByLabel('计算操作',{exact:true}).selectOption('count');check('设置变化自动取消统计确认',!await page.getByRole('checkbox',{name:/按记录／行统计/}).isChecked());await page.getByRole('checkbox',{name:/按记录／行统计/}).check();await page.getByRole('button',{name:'运行计算并保存',exact:true}).click();await until(()=>page.locator('.computed-value strong').innerText().then(text=>text.includes('144')&&text.includes('条')),'count result');check('记录数操作实际计算144条',(await get('/runs/'+new URL(page.url()).searchParams.get('run'))).spec.operation==='count');
   await page.getByLabel('计算操作',{exact:true}).selectOption('ratio');await page.getByLabel('范围值1',{exact:true}).fill('不存在的状态');await page.getByRole('checkbox',{name:/按记录／行统计/}).check();await page.getByRole('button',{name:'运行计算并保存',exact:true}).click();await until(()=>page.locator('.calculation-status').innerText().then(text=>text==='证据不足'),'zero denominator');check('零分母显示证据不足，不生成百分比',(await page.locator('.computed-value strong').innerText())==='—');await screenshot('zero-denominator-desktop');
   await page.route('**/api/projects/*/runs',route=>route.request().method()==='POST'?route.abort('failed'):route.continue());await page.getByLabel('范围值1',{exact:true}).fill('有效');await page.getByRole('checkbox',{name:/按记录／行统计/}).check();await page.getByRole('button',{name:'运行计算并保存',exact:true}).click();await page.locator('.calc-settings .work-error').waitFor();check('计算接口不可用时保留输入并准确报错',(await page.locator('.calc-settings .work-error').innerText()).includes('无法连接后台')&&await page.getByLabel('范围值1',{exact:true}).inputValue()==='有效');await page.unroute('**/api/projects/*/runs');
   await page.goto(base+state.route+'?run='+state.rid);await page.locator('.computed-value').waitFor();
   const rulesResponse=await context.request.put(base+'/api/projects/'+state.pid+'/rules',{headers,data:{version:0,rules:{scope:'本合成测试仅按有效记录统计，人工更新说明。'}}});assert.equal(rulesResponse.status(),200);await page.reload();await until(()=>page.locator('.calculation-status').innerText().then(text=>text.includes('待重新计算')),'stale run');await until(()=>page.locator('.numeric-check-result.state-stale').count().then(count=>count===2),'stale checks loaded');check('口径变化后旧结果80%保留并标记待重新计算',(await get('/runs/'+state.rid)).result.display_value==='80'&&await page.locator('.numeric-check-result.state-stale').count()===2);await screenshot('stale-desktop');
   const other=await browser.newContext();
   const otherEmail=`calc-isolation-${Date.now()}@example.com`;assert.equal((await other.request.post(base+'/api/auth/register',{headers,data:{email:otherEmail,password:state.password}})).status(),201);assert.equal((await other.request.post(base+'/api/auth/login',{headers,form:{username:otherEmail,password:state.password}})).status(),204);
   for(const url of [`/runs/${state.rid}`,`/runs/${state.rid}/evidence`,`/runs/${state.rid}/checks`,`/projects/${state.pid}/runs`,`/projects/${state.pid}/calculation-context`])check('另一账户不能读取 '+url,(await other.request.get(base+'/api'+url)).status()===404);
   check('另一账户不能给结果新增核验',(await other.request.post(base+'/api/runs/'+state.rid+'/checks',{headers,data:{report_asset_id:report.id,paragraph_id:state.paragraphs[2].id,reported_value:'80',precision:0,confirmed:true}})).status()===404);await other.close();
   await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.waitForURL('**/auth');await page.goto(base+state.route);await page.waitForURL('**/auth?next=*');check('新工作区登录保护保留合法返回目标',new URL(page.url()).searchParams.get('next')===state.route);await page.getByLabel('邮箱',{exact:true}).fill(state.email);await page.getByLabel('密码',{exact:true}).fill(state.password);await page.locator('.auth-submit').click();await page.waitForURL('**/calculations');await page.locator('.calc-settings').waitFor();check('原登录流程返回计算工作区',true);
   await context.storageState({path:path.join(out,'session.json')});
   fs.writeFileSync(path.join(out,'run.json'),JSON.stringify(state,null,2));
  }
  check('无浏览器JavaScript运行时错误',errors.length===0);
  fs.writeFileSync(path.join(out,phase+'-checks.json'),JSON.stringify({checkedAt:new Date().toISOString(),browser:await browser.version(),phase,checks:results,errors},null,2));
 }catch(error){await screenshot('failure-'+phase);fs.writeFileSync(path.join(out,'failed-run.json'),JSON.stringify(state,null,2));throw error;}
 finally{await browser.close();}
}
main().catch(error=>{console.error(error);console.error(`Completed ${results.length} checks`);process.exitCode=1;});
