// Independent synthetic browser acceptance. Paid stages have persistent guards.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const stage=process.argv[2],base='http://127.0.0.1:5173',root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/analysis-v12'),fixture=path.join(root,'artifacts/analysis-demo');
fs.mkdirSync(out,{recursive:true});const statePath=path.join(out,'browser-run.json');
const s=fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath)):{checks:[]};
function save(){fs.writeFileSync(statePath,JSON.stringify(s,null,2));}
function resultSnapshot(r){const x=structuredClone(r);if(x.extrema)delete x.extrema.tie_counts;return x;}
function check(name,v){assert.ok(v,name);if(!s.checks.includes(name))s.checks.push(name);save();console.log('PASS',name);}
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const ctx=await browser.newContext({viewport:{width:1440,height:1080},reducedMotion:'reduce',...(s.pid?{storageState:path.join(out,'session.json')}:{})});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error'&&/same key|unique.*key|React error/.test(e.text()))errors.push(e.text());});
 async function get(url){const r=await ctx.request.get(base+'/api'+url);assert.equal(r.status(),200,await r.text());return r.json();}
 async function until(fn){for(let i=0;i<250;i++){if(await fn())return;await new Promise(r=>setTimeout(r,300));}throw Error('Timed out. Inspect saved task; never repeat paid stage blindly.');}
 async function shot(name){await page.evaluate(()=>{document.activeElement?.blur();scrollTo({top:0,behavior:'instant'});});await page.waitForTimeout(150);await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});}
 async function open(tid){await page.goto(base+s.route+(s.sid?'?session='+s.sid+(tid?'&turn='+tid:''):''));await page.locator('.analysis-conversation').waitFor();await page.getByRole('button',{name:'新建分析会话',exact:true}).waitFor({state:'visible'});await until(async()=>await page.getByRole('button',{name:'新建分析会话',exact:true}).isEnabled());if(tid)await page.locator('.analysis-answer').waitFor();}
 async function ask(question,slot){assert.ok(!s[slot],'Stage already saved; do not make another request.');await page.getByLabel('对话分析问题',{exact:true}).fill(question);await page.getByRole('checkbox',{name:/同意发送必要问题/}).check();const response=page.waitForResponse(r=>r.url().endsWith('/analysis-sessions/'+s.sid+'/questions')&&r.request().method()==='POST');await page.getByRole('button',{name:'提交分析问题',exact:true}).click();const created=await response;assert.equal(created.status(),201,await created.text());let id=(await created.json()).id;await page.waitForURL(u=>u.searchParams.get('turn')===id);s[slot]={id};save();let t;await until(async()=>{t=await get('/analysis-turns/'+id);s[slot].task=t;save();return !['understanding','searching','planning'].includes(t.status);});console.log(JSON.stringify({case:slot,status:t.status,error:t.error,proposal:t.payload.original_proposal,requests:t.request_count,trace:t.trace},null,2));return t;}
 try{
  if(stage==='setup'){
   assert.ok(!s.pid,'Already setup.');s.email=`analysis-${Date.now()}@example.com`;s.password=crypto.randomBytes(18).toString('base64url')+'Aa1!';save();
   await page.goto(base+'/auth?mode=register');await page.getByLabel('邮箱',{exact:true}).fill(s.email);await page.getByLabel('密码',{exact:true}).fill(s.password);await page.getByLabel('确认密码',{exact:true}).fill(s.password);await page.locator('.auth-submit').click();await page.waitForURL('**/app');await ctx.storageState({path:path.join(out,'session.json')});
   await page.getByRole('button',{name:'创建第一个项目',exact:true}).click();await page.getByLabel('项目名称',{exact:true}).fill('独立合成 · 对话与学院分组分析12条');await page.getByRole('button',{name:'创建项目',exact:true}).click();await page.waitForURL('**/materials');
   s.pid=new URL(page.url()).pathname.split('/')[3];s.route=`/app/projects/${s.pid}/analysis`;save();
   const config=await get('/ai/config');check('沿用真实百炼配置',config.configured&&!config.test_mode&&config.model==='qwen3.7-plus'&&config.region==='cn-beijing');
   await page.getByLabel('选择资料文件').setInputFiles(path.join(fixture,'独立合成_学院12条.csv'));
   let assets;await until(async()=>{assets=await get(`/projects/${s.pid}/assets`);return assets.length===1&&assets[0].status==='ready';});s.table=assets[0];save();
   await page.getByRole('button',{name:'粘贴报告',exact:true}).click();await page.getByLabel('报告名称',{exact:true}).fill('独立合成_统计规则');await page.getByLabel('报告正文',{exact:true}).fill(fs.readFileSync(path.join(fixture,'独立合成_统计规则.txt'),'utf8'));await page.getByRole('button',{name:'保存报告',exact:true}).click();await page.locator('.paste-dialog').waitFor({state:'hidden'});
   s.rule=(await get(`/projects/${s.pid}/assets`)).find(a=>a.kind==='report');save();
   await page.locator('.rule-library .library-material').filter({hasText:s.rule.name}).getByRole('checkbox').click();await until(async()=>(await get(`/projects/${s.pid}/rule-materials`)).includes(s.rule.id));
   const sheet=s.table.summary.sheets[0],c=sheet.columns,para=(await get(`/assets/${s.rule.id}/preview`)).paragraphs[0],head=await get(`/projects/${s.pid}/rule-snapshots`);
   const constraints={asset_id:s.table.id,sheet_id:sheet.id,operation:'ratio',metric:'有效记录满意率',scope_description:'纳入状态为有效；不限定期间',scope:[{column_id:c[1].id,kind:'text',value:'有效'}],numerator:[{column_id:c[2].id,kind:'text',value:'满意'}],null_policy:'keep',precision:0};
   // Explicit synthetic fixture setup through the existing protected rule API, no AI/default rule.
   const saved=await ctx.request.post(base+`/api/projects/${s.pid}/rule-snapshots`,{headers:{'X-Requested-With':'shuyouyiju'},data:{previous_id:head.current_id,context_hash:head.context_hash,constraints,sources:Object.fromEntries(Object.keys(constraints).map(k=>[k,{asset_id:s.rule.id,paragraph_id:para.id,quote:para.text}])),confirmed_fields:Object.keys(constraints),unresolved:[],change_reason:'独立合成验收准备：逐项明确基础范围、分子、空值、精度和原文。通过原有受保护接口保存，不由模型推断。'}});assert.equal(saved.status(),201,await saved.text());s.snapshot=await saved.json();save();
   await open();await page.getByRole('button',{name:'新建分析会话',exact:true}).click();await page.waitForURL('**/*session=*');s.sid=new URL(page.url()).searchParams.get('session');save();
   fs.writeFileSync(path.join(out,'演示账户.txt'),`本机独立合成验收账户，不提交Git。\n邮箱：${s.email}\n密码：${s.password}\n入口：${base+s.route}?session=${s.sid}\n`);
   check('真实浏览器上传CSV保存规则，现有接口准备明确规则快照',s.table.summary.sheets[0].row_count===12);await shot('ready-desktop');
  }else if(stage==='plan'){
   await open();const t=await ask('各学院满意率是多少？按所属学院分组，分组字段为空时保留为空值组。','group');assert.equal(t.status,'awaiting_confirmation',t.error);
   s.rawPlan=structuredClone(t.payload.original_proposal.plan);save();const p=s.rawPlan,c=s.table.summary.sheets[0].columns;
   check('真实模型原始映射正确',p.operation==='ratio'&&p.metric==='有效记录满意率'&&p.group_by===c[0].id&&p.group_null_policy==='keep'&&p.exploration.every(x=>x.column_id===c[1].id&&x.value==='有效'));
   await page.locator('.analysis-plan').waitFor();await shot('real-plan-desktop');
   await page.setViewportSize({width:390,height:844});check('390px方案无页面溢出',await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));await shot('real-plan-mobile');
  }else if(stage==='revalidate'){
   const callsBefore=JSON.parse(fs.readFileSync(path.join(out,'request-ledger.json'),'utf8')).requests.length;await open(s.group.id);let t=await get('/analysis-turns/'+s.group.id);if(t.status==='failed'){await page.getByRole('button',{name:'重新校验已保存建议（不调用模型）',exact:true}).click();await page.locator('.analysis-answer').filter({hasText:'等待确认'}).waitFor({timeout:20000});}
   await until(async()=>{t=await get('/analysis-turns/'+s.group.id);return !['understanding','searching','planning'].includes(t.status);});assert.equal(t.status,'awaiting_confirmation',t.error);
   s.rawPlan=structuredClone(t.payload.original_proposal.plan);s.group.revalidated=t;save();const p=s.rawPlan,c=s.table.summary.sheets[0].columns;
   check('真实原始响应映射正确，保留冗余基础筛选',p.operation==='ratio'&&p.metric==='有效记录满意率'&&p.group_by===c[0].id&&p.group_null_policy==='keep'&&p.exploration.every(x=>x.column_id===c[1].id&&x.value==='有效'));
   check('复用已保存响应没有新请求',t.request_count===1&&JSON.parse(fs.readFileSync(path.join(out,'request-ledger.json'),'utf8')).requests.length===callsBefore);
   await page.locator('.analysis-plan').waitFor();await shot('real-plan-desktop');await page.setViewportSize({width:390,height:844});check('390px方案无页面溢出',await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));await shot('real-plan-mobile');
  }else if(stage==='execute'){
   assert.ok(!s.completed,'Already calculated; use readonly.');await open(s.group.id);await page.getByRole('checkbox',{name:/已核对指标、对象/}).check();await page.getByRole('button',{name:'确认方案并计算',exact:true}).click();let t;await until(async()=>{t=await get('/analysis-turns/'+s.group.id);return !!t.run_id;});s.completed=t;save();
   const gs=Object.fromEntries(t.run.result.groups.map(g=>[g.label,g]));check('A3/6=50%、B1/4=25%、总体4/10=40%',gs.A.result.numerator===3&&gs.A.result.denominator===6&&gs.A.result.display_value==='50'&&gs.B.result.numerator===1&&gs.B.result.denominator===4&&gs.B.result.display_value==='25'&&t.run.result.display_value==='40');
   check('模型原建议与最终确认分别保存且未人工修正',JSON.stringify(s.rawPlan)===JSON.stringify(t.payload.confirmed_plan)&&!t.payload.confirmation.reason);
   check('空分组零分母无正常百分比',t.run.result.groups.find(g=>g.type==='null').result.status==='insufficient');
   await page.locator('.analysis-chart').waitFor();await page.locator('.analysis-plan').waitFor({state:'hidden'});await page.waitForTimeout(200);await shot('real-result-desktop');
  }else if(stage==='followups'){
   await open(s.group.id);await page.getByRole('button',{name:'哪个最低？',exact:true}).click();await page.waitForURL(u=>u.searchParams.get('turn')!==s.group.id);const id=new URL(page.url()).searchParams.get('turn');const t=await get('/analysis-turns/'+id);s.low=t;save();const b=s.completed.run.result.groups.find(g=>g.label==='B');
   check('连续提问最低组来自后台精确结果，无模型与重算',t.payload.answer.groups[0]===b.key&&t.request_count===0&&!t.run_id&&t.payload.answer_run_id===s.completed.run_id);
   await page.getByRole('button',{name:'选择分组 B（text）',exact:true}).click();await page.locator('.analysis-evidence .calc-data-table tbody tr').first().waitFor();check('点击B柱只显示4条分母证据',await page.locator('.analysis-evidence .calc-data-table tbody tr').count()===4);
   await page.getByRole('button',{name:'查看选中组的记录',exact:true}).click();await page.waitForURL(u=>u.searchParams.get('turn')!==id);s.viewed=await get('/analysis-turns/'+new URL(page.url()).searchParams.get('turn'));save();check('查看选中类别消息绑定已保存组与运行',s.viewed.payload.answer.groups[0]===b.key&&s.viewed.request_count===0);
   await page.locator('.analysis-evidence .calc-data-table tbody tr').first().waitFor();await page.getByRole('button',{name:'定位源行 8',exact:true}).click();const href=await page.locator('.record-focus a').getAttribute('href');const row=await ctx.newPage();await row.goto(base+href);await row.locator('.linked-source-row').waitFor();await row.close();check('分组证据可定位稳定源行',true);
   await page.getByRole('tab',{name:'规则来源',exact:true}).click();const link=await page.locator('.ai-rule>a').first().getAttribute('href'),rp=await ctx.newPage();await rp.goto(base+link);await rp.locator('.linked-source-paragraph').waitFor();await rp.close();check('实际规则引用可定位',true);await shot('real-rules-desktop');
   await page.getByRole('tab',{name:'原始记录',exact:true}).click();await shot('real-lowest-desktop');
   await page.setViewportSize({width:390,height:844});check('390px结果及原始证据无页面溢出',await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));await shot('real-lowest-mobile');
  }else if(stage==='append'||stage==='resume-append'){
   let t;if(stage==='resume-append'){const session=await get('/analysis-sessions/'+s.sid);t=session.items.find(t=>t.question.startsWith('在刚才已确认基础上'));assert.ok(t);s.append={id:t.id,task:t};save();await open(t.id);}else{await open(s.group.id);t=await ask('在刚才已确认基础上，追加所属学院等于A的筛选，仍按所属学院计算满意率。分组空值保留。','append');}assert.equal(t.status,'awaiting_confirmation',t.error);
   const p=t.payload.original_proposal.plan;check('真实模型明确追加筛选，原口径不变',p.exploration.some(x=>x.column_id===s.table.summary.sheets[0].columns[0].id&&x.value==='A'));
   await page.locator('.analysis-plan').waitFor();await page.getByRole('checkbox',{name:/已核对指标、对象/}).check();await page.getByRole('button',{name:'确认方案并计算',exact:true}).click();let d;await until(async()=>{d=await get('/analysis-turns/'+t.id);return !!d.run_id;});s.appendCompleted=d;save();check('追加筛选真实计算为3/6=50%，未覆盖项目规则',d.run.result.numerator===3&&d.run.result.denominator===6&&d.run.result.display_value==='50'&&(await get(`/projects/${s.pid}/rule-snapshots`)).current_id===s.snapshot.id);await shot('real-append-desktop');
  }else if(stage==='screens'){
   await open(s.group.id);await page.getByRole('button',{name:'选择分组 B（text）',exact:true}).click();await until(async()=>await page.getByLabel('证据记录分组',{exact:true}).locator('option[value=denominator]').innerText().then(t=>t.includes('4 条')));
   s.crops={};for(const [device,width,height] of [['desktop',1440,1080],['mobile',390,844]]){await page.setViewportSize({width,height});await shot('final-'+device);s.crops['chart-'+device]=await page.locator('.analysis-chart').evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height}});check(device+'最终布局无页面溢出',await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));}
   await page.setViewportSize({width:1440,height:1080});await page.getByRole('tab',{name:'规则来源',exact:true}).click();await shot('final-rules-desktop');s.crops['rules-desktop']=await page.locator('.analysis-evidence').evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height}});save();
   // Open the same grouped run through the pre-existing shared history link.
   await page.goto(base+`/app/projects/${s.pid}/calculations?run=${s.completed.run_id}`);await page.locator('.analysis-chart').waitFor();await page.getByRole('button',{name:'选择分组 B（text）',exact:true}).click();await until(async()=>await page.getByLabel('证据记录分组',{exact:true}).locator('option[value=denominator]').innerText().then(t=>t.includes('4 条')));await until(async()=>await page.locator('.analysis-evidence .calc-data-table tbody tr').count()===4);check('旧公共运行链接可读取新分组图表并联动证据',true);
  }else if(stage==='read-inherit'){
   await open(s.continued.id);await page.locator('.analysis-chart').waitFor();check('真实连续任务保存后方案已收起',await page.locator('.analysis-plan').count()===0);await shot('real-inherited-desktop');await page.setViewportSize({width:390,height:844});check('连续结果390px无页面溢出',await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));await shot('real-inherited-mobile');
  }else if(stage==='plan-ui-offline'){
   // Offline UI transition using saved fixtures; never writes or calls the provider.
   const done=await get('/analysis-turns/'+s.group.id);let confirmed=false;
   await ctx.route('**/api/analysis-turns/'+s.group.id,route=>route.fulfill({json:confirmed?done:{...done,status:'awaiting_confirmation',saved_status:'awaiting_confirmation',run:undefined,run_id:null}}));
   await ctx.route('**/api/analysis-turns/'+s.group.id+'/confirm',route=>{confirmed=true;return route.fulfill({json:done})});
   await open(s.group.id);await page.locator('.analysis-plan').waitFor();await shot('plan-offline-desktop');await page.setViewportSize({width:390,height:844});check('离线方案390px无溢出',await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));await shot('plan-offline-mobile');
   await page.getByRole('checkbox',{name:/已核对指标、对象/}).check();await page.getByRole('button',{name:'确认方案并计算',exact:true}).click();await page.locator('.analysis-plan').waitFor({state:'hidden'});await page.locator('.analysis-chart').waitFor();check('离线方案到结果的React组件正确替换',confirmed&&errors.length===0);
  }else if(stage==='inherit'){
   await open(s.append.id);await page.getByLabel('继承分析').selectOption(s.append.id);
   const t=await ask('在上一步已确认的A学院筛选基础上继续按所属学院计算满意率。保留已确认筛选与分组空值策略。','continued');assert.equal(t.status,'awaiting_confirmation',t.error);
   check('真实连续方案绑定具体前次确认而非聊天猜测',t.parent_id===s.append.id&&JSON.stringify(t.payload.inherited_plan)===JSON.stringify(s.appendCompleted.payload.confirmed_plan));
   await page.locator('.analysis-plan').waitFor();await page.getByRole('checkbox',{name:/已核对指标、对象/}).check();await page.getByRole('button',{name:'确认方案并计算',exact:true}).click();let d;await until(async()=>{d=await get('/analysis-turns/'+t.id);return !!d.run_id;});s.continuedCompleted=d;save();
   check('连续分析继承全部筛选并仍计算3/6=50%',d.run.result.display_value==='50'&&d.run.result.denominator===6&&JSON.stringify(d.payload.confirmed_plan)===JSON.stringify(t.payload.original_proposal.plan));
   await page.locator('.analysis-plan').waitFor({state:'hidden'});await shot('real-inherited-desktop');
  }else if(stage==='missing'){
   await open(s.group.id);await page.getByLabel('继承分析').selectOption('');const t=await ask('请统计各学院的收入增长率。表中没有收入或去年字段时请说明缺少什么，不能用满意率代替。','missing');
   check('不存在指标和缺失字段真实澄清或停止',!t.run_id&&['clarify','unsupported'].includes(t.status));await shot('real-missing-desktop');
  }else if(stage==='readonly'||stage==='restart'){
   if(stage==='restart'){await page.goto(base+'/app');await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.waitForURL('**/auth*');await page.goto(base+s.route+'?session='+s.sid+'&turn='+s.group.id);await page.waitForURL('**/auth*');check('未登录合法返回目标保留会话与消息',new URL(page.url()).searchParams.get('next')?.includes('turn='+s.group.id));await page.getByLabel('邮箱',{exact:true}).fill(s.email);await page.getByLabel('密码',{exact:true}).fill(s.password);await page.locator('.auth-submit').click();await page.waitForURL('**/*turn=*');await ctx.storageState({path:path.join(out,'session.json')});}
   await open(s.group.id);await page.locator('.analysis-chart').waitFor();const t=await get('/analysis-turns/'+s.group.id);check(stage+'计算、原方案、确认、规则与用量恢复',JSON.stringify(resultSnapshot(t.run.result))===JSON.stringify(resultSnapshot(s.completed.run.result))&&t.payload.confirmation.at===s.completed.payload.confirmation.at&&t.request_count===1);
   await page.getByLabel('分组排序').selectOption('ascending');await page.getByRole('button',{name:'选择分组 B（text）',exact:true}).click();await page.locator('.analysis-evidence .calc-data-table tbody tr').first().waitFor();check(stage+'排序和选择组读取保存证据',await page.locator('.analysis-evidence .calc-data-table tbody tr').count()===4);
   await page.setViewportSize({width:390,height:844});check(stage+'390px无横向页面溢出',await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));await shot(stage+'-mobile');
   await page.reload();await page.locator('.analysis-chart').waitFor();check(stage+'刷新无新增模型请求',(await get('/analysis-turns/'+s.group.id)).request_count===1);
   await page.setViewportSize({width:1440,height:1080});await page.getByRole('button',{name:'选择分组 B（text）',exact:true}).click();await until(async()=>await page.getByLabel('证据记录分组',{exact:true}).locator('option[value=denominator]').innerText().then(t=>t.includes('4 条')));await shot(stage+'-desktop');await page.locator('.analysis-chart').screenshot({path:path.join(out,'chart-desktop.png')});await page.setViewportSize({width:390,height:844});await page.locator('.analysis-chart').screenshot({path:path.join(out,'chart-mobile.png')});check('所选B组证据摘要与实际分页一致',await page.getByLabel('证据记录分组',{exact:true}).locator('option[value=denominator]').innerText().then(t=>t.includes('4 条')));await page.locator('.analysis-chart').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'result-mobile-viewport.png')});
  }else throw Error('Unknown stage');
  check(stage+'无浏览器运行异常',errors.length===0);
 }finally{await page.screenshot({path:path.join(out,'last-'+stage+'.png'),fullPage:true}).catch(()=>{});await browser.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
