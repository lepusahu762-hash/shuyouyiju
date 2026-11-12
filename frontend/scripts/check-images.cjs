// Real-model acceptance, explicit paid stages only. Replays/read-only never call a model.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const stage=process.argv[2],base='http://127.0.0.1:5173';
const out=path.resolve(__dirname,'../../artifacts/image-v11'),fixtures=path.resolve(__dirname,'../../artifacts/image-demo');
const statePath=path.join(out,'browser-state.json');fs.mkdirSync(out,{recursive:true});
const s=fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath)):{checks:[],tasks:{}};
const fields=['表格资料','工作表','计算类型','指标','统计范围说明','分母／范围条件','分子条件','空值策略','显示及比较精度'];
const save=()=>fs.writeFileSync(statePath,JSON.stringify(s,null,2));
function check(name,condition){assert.ok(condition,name);if(!s.checks.includes(name))s.checks.push(name);save();console.log('PASS',name);}
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext({viewport:{width:1440,height:1080},reducedMotion:'reduce',...(s.pid?{storageState:path.join(out,'session.json')}:{})});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function get(url){const r=await context.request.get(base+'/api'+url);assert.equal(r.status(),200,await r.text());return r.json();}
 async function until(fn){for(let i=0;i<300;i++){if(await fn())return;await new Promise(r=>setTimeout(r,300));}throw Error('Timed out; inspect saved task before retry.');}
 async function open(id){await page.goto(base+s.route+(id?'&imageTask='+id:''));await page.locator('.image-verification-grid').waitFor();}
 async function task(id){return get('/image-tasks/'+id);}
 async function shot(name){await page.evaluate(()=>{document.activeElement?.blur();scrollTo({top:0,behavior:'instant'});});await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});}
 async function selectCandidate(id,value){const t=await task(id),idx=t.payload.candidates.findIndex(x=>x.value===value&&x.category==='满意');assert.ok(idx>=0,'Actual model must see requested category/value');s.tasks[value].original=t.payload.candidates[idx];save();
   await open(id);await page.locator('.image-candidates button').nth(idx).click();
   // Exact metric/position are user-confirmed; preserve original if a semantic label needs correction.
   if(t.payload.candidates[idx].metric!=='纳入记录满意率'){
    await page.getByLabel('图片目标metric',{exact:true}).fill('纳入记录满意率');await page.getByLabel('图片识别修改原因').fill('人工核对图表标题，统一指标名称为上传规则的“纳入记录满意率”，不改模型原始数字或类别。');
   }
   await page.getByRole('checkbox',{name:/我已对照原图确认/}).check();await page.getByRole('button',{name:'保存识别确认并查找规则',exact:true}).click();
   await page.locator('.image-plan').waitFor();const saved=await task(id);check(value+'%识别确认与真实规则检索保存',saved.payload.recognition_confirmed&&saved.payload.citations.some(x=>x.asset_id===s.rule.id));return saved;
 }
 async function execute(id,value){
   await open(id);if(!(await task(id)).payload.rule_snapshot){await page.getByRole('button',{name:'绑定当前已确认规则，重新检查',exact:true}).click();await until(async()=>!!(await task(id)).payload.rule_snapshot);}
   await page.getByRole('button',{name:'保存方案并检查规则',exact:true}).click();
   await page.getByLabel('图片适用性核对说明').fill('人工核对原图“满意”类别对应服务评价=满意；采用纳入标记=是的全部10条记录为分母并保留空值。图中及本合成规则均未限定期间，按记录统计不去重，0位小数，只核验选中标签。');
   await page.getByRole('checkbox',{name:/已确认当前标签的类别/}).check();await page.getByRole('button',{name:'确认方案，计算所选图片数字',exact:true}).click();
   await until(async()=>!!(await task(id)).run_id);const t=await task(id);s.tasks[value].completed=t;s.snapshot=t.payload.rule_snapshot;save();
   check(value+'%由完整表计算4÷10=40%',t.run.result.numerator===4&&t.run.result.denominator===10&&t.run.result.total===12&&t.run.result.display_value==='40');
   check(value+'%比较状态准确',t.result.status===(value==='50'?'different':'consistent')&&t.result.difference_pp===(value==='50'?'-10':'0'));
   check(value+'%没有重复模型请求',t.request_count===1);
   await page.reload();await page.locator('.image-number').waitFor();await shot('real-'+value+'-desktop');
 }
 try{
  if(stage==='setup'){
   assert.ok(!s.pid,'Existing project; do not duplicate setup.');s.email=`image-${Date.now()}@example.com`;s.password='Evidence2026!';save();
   await page.goto(base+'/auth?mode=register');await page.getByLabel('邮箱',{exact:true}).fill(s.email);await page.getByLabel('密码',{exact:true}).fill(s.password);await page.getByLabel('确认密码',{exact:true}).fill(s.password);await page.locator('.auth-submit').click();await page.waitForURL('**/app');await context.storageState({path:path.join(out,'session.json')});
   await page.getByRole('button',{name:'创建第一个项目',exact:true}).click();await page.getByLabel('项目名称',{exact:true}).fill('独立合成 · 真实图片百分比核验12条');await page.getByRole('button',{name:'创建项目',exact:true}).click();await page.waitForURL('**/materials');
   s.pid=new URL(page.url()).pathname.split('/')[3];s.route=`/app/projects/${s.pid}/verify?mode=image`;save();
   s.config=await get('/ai/config');check('现有百炼配置与真实客户端',s.config.configured&&!s.config.test_mode&&s.config.model==='qwen3.7-plus'&&s.config.region==='cn-beijing');
   await page.getByLabel('选择资料文件').setInputFiles(['独立合成_12条.csv','独立合成_50.png','独立合成_40.png','独立合成_无标签.png','独立合成_模糊.png'].map(n=>path.join(fixtures,n)));
   let a;await until(async()=>{a=await get(`/projects/${s.pid}/assets`);return a.length===5&&a.every(x=>x.status==='ready');});s.table=a.find(x=>x.kind==='table');s.images=a.filter(x=>x.kind==='image');save();
   await page.getByRole('button',{name:'粘贴报告',exact:true}).click();await page.getByLabel('报告名称',{exact:true}).fill('独立合成_统计规则');await page.getByLabel('报告正文',{exact:true}).fill(fs.readFileSync(path.join(fixtures,'独立合成_统计规则.txt'),'utf8'));await page.getByRole('button',{name:'保存报告',exact:true}).click();await page.locator('.paste-dialog').waitFor({state:'hidden'});
   s.rule=(await get(`/projects/${s.pid}/assets`)).find(x=>x.name==='独立合成_统计规则');save();
   await page.locator('.rule-library .library-material').filter({hasText:s.rule.name}).getByRole('checkbox').click();await until(async()=>(await get(`/projects/${s.pid}/rule-materials`)).includes(s.rule.id));
   check('浏览器上传原图数据、保存规则并指定真实规则资料',s.table.summary.sheets[0].row_count===12);
   fs.writeFileSync(path.join(out,'演示账户.txt'),`本机独立合成测试账户，不提交Git。\n邮箱：${s.email}\n密码：${s.password}\n入口：${base+s.route}\n`);
   await open();await shot('ready-desktop');
  }else if(stage==='ready'){
   check('规则指定已保存',(await get(`/projects/${s.pid}/rule-materials`)).includes(s.rule.id));
   fs.writeFileSync(path.join(out,'演示账户.txt'),`本机独立合成测试账户，不提交Git。\n邮箱：${s.email}\n密码：${s.password}\n入口：${base+s.route}\n`);await open();await shot('ready-desktop');
  }else if(stage.startsWith('recognize-')){
   const value=stage.slice(10);assert.ok(!s.tasks[value],'Paid stage already exists, reuse saved task.');await open();await page.getByLabel('项目图片',{exact:true}).selectOption(s.images.find(x=>x.name===`独立合成_${value}.png`).id);
   await page.getByRole('checkbox',{name:/同意将本次选区/}).check();await page.getByRole('button',{name:'识别选区内的可见标签',exact:true}).click();await page.waitForURL('**/*imageTask=*');
   const id=new URL(page.url()).searchParams.get('imageTask');s.tasks[value]={id};save();let t;
   await until(async()=>{t=await task(id);s.tasks[value].recognized=t;save();return t.status!=='extracting';});
   console.log(JSON.stringify({case:value,status:t.status,error:t.error,candidates:t.payload.candidates,requests:t.request_count,usage:t.trace.find(x=>x.event==='model_response')?.usage},null,2));
   if(['50','40'].includes(value)){assert.equal(t.status,'candidates',t.error);await selectCandidate(id,value);}else{check(value+'无清晰标签未产生通过结果',!t.result&&!t.run_id);await page.reload();await shot('real-'+value+'-desktop');}
  }else if(stage==='rules'){
   await open(s.tasks['50'].id);const ed=page.locator('.rule-setup'),pf=ed.locator('.rule-plan-fields'),sheet=s.table.summary.sheets[0];
   await pf.locator('label.work-field').filter({hasText:/^表格资料/}).locator('select').selectOption(s.table.id);await pf.locator('label.work-field').filter({hasText:/^工作表/}).locator('select').selectOption(sheet.id);
   await pf.locator('label.work-field').filter({hasText:/^指标/}).locator('input').fill('纳入记录满意率');await pf.locator('label.work-field').filter({hasText:/^范围说明/}).locator('textarea').fill('纳入标记为是的记录；不限定期间');
   for(const [name,idx,val]of[['范围',1,'是'],['分子',2,'满意']]){await pf.getByRole('button',{name:'添加'+name+'条件',exact:true}).click();await pf.getByLabel(name+'字段1').selectOption(sheet.columns[idx].id);await pf.getByLabel(name+'值1').fill(val);}
   await pf.locator('label.work-field').filter({hasText:/^空值处理/}).locator('select').selectOption('keep');
   const t=await task(s.tasks['50'].id),citation=t.payload.citations.find(x=>x.asset_id===s.rule.id);assert.ok(citation);
   for(const f of fields){await ed.getByLabel(f+'的原文来源',{exact:true}).selectOption(citation.citation_id);await ed.getByRole('checkbox',{name:'确认规则'+f,exact:true}).check();}
   await ed.getByLabel('规则变更依据').fill('浏览器逐项核对独立合成规则：纳入标记为是，服务评价为满意，保留空值，不去重，按记录统计，精度0位，无期间限制。');await ed.getByRole('button',{name:'保存新规则快照并检查方案',exact:true}).click();
   await until(async()=>!!(await task(s.tasks['50'].id)).payload.rule_snapshot);s.snapshot=(await task(s.tasks['50'].id)).payload.rule_snapshot;save();check('九项规则通过界面确认并保存不可变快照',Object.keys(s.snapshot.sources).length===9);await shot('confirmed-rules-desktop');
  }else if(stage==='bind-existing'){
   await open(s.tasks['50'].id);await page.getByRole('button',{name:'绑定当前已确认规则，重新检查',exact:true}).click();await until(async()=>!!(await task(s.tasks['50'].id)).payload.rule_snapshot);s.snapshot=(await task(s.tasks['50'].id)).payload.rule_snapshot;save();check('新规则快照明确重新绑定并清除旧确认',!(await task(s.tasks['50'].id)).stale);
  }else if(stage==='execute-50'||stage==='execute-40'){
   const value=stage.slice(8);assert.ok(!s.tasks[value].completed,'Already completed, use readonly.');await execute(s.tasks[value].id,value);
  }else if(stage==='readonly'||stage==='restart'){
   const id=s.tasks['50'].id;if(stage==='restart'){await page.goto(base+'/app');await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.waitForURL('**/auth*');await page.goto(base+s.route+'&imageTask='+id);await page.waitForURL('**/auth*');check('登录保护保留图片任务目标',new URL(page.url()).searchParams.get('next')?.includes('imageTask='+id));await page.getByLabel('邮箱',{exact:true}).fill(s.email);await page.getByLabel('密码',{exact:true}).fill(s.password);await page.locator('.auth-submit').click();await page.waitForURL('**/*imageTask=*');await context.storageState({path:path.join(out,'session.json')});}await open(id);await page.locator('.image-number').waitFor();
   const t=await task(id);check(stage+'保存结果、规则、确认和原识别完整恢复',JSON.stringify(t.result)===JSON.stringify(s.tasks['50'].completed.result)&&t.payload.rule_snapshot.id===s.snapshot.id&&t.payload.confirmation&&t.payload.raw_recognition&&t.request_count===1);
   await page.getByRole('tab',{name:'原始数据',exact:true}).click();await page.locator('.calc-data-table tbody tr').first().waitFor();check(stage+'分母证据10行含两条空值',await page.locator('.calc-data-table tbody tr').count()===10&&await page.locator('.null-cell').count()===2);
   await page.getByRole('button',{name:'定位源行 10',exact:true}).click();const link=await page.locator('.record-focus a').getAttribute('href');const other=await context.newPage();await other.goto(base+link);await other.locator('.linked-source-row').waitFor();await other.close();check(stage+'原始证据可定位',true);await shot(stage+'-rows-desktop');
   await page.getByRole('tab',{name:'规则原文',exact:true}).click();const rl=await page.locator('.ai-rule>a').first().getAttribute('href');const rpage=await context.newPage();await rpage.goto(base+rl);await rpage.locator('.linked-source-paragraph').waitFor();await rpage.close();check(stage+'规则原文来源可定位',true);
   await page.getByRole('tab',{name:'比较结果',exact:true}).click();await shot(stage+'-50-desktop');
   await page.setViewportSize({width:390,height:844});check(stage+'390px无页面横向溢出',await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));await shot(stage+'-50-mobile');
   await page.getByRole('button',{name:'放大图片',exact:true}).click();check(stage+'放大图片只在内部滚动',await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));await page.getByRole('button',{name:'适合宽度',exact:true}).click();
   await page.getByRole('tab',{name:'原始数据',exact:true}).click();await page.locator('.calc-data-table tbody tr').first().waitFor();check(stage+'手机证据表自身滚动',await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));await shot(stage+'-rows-mobile');
   const before=await task(id);await page.reload();await page.locator('.image-number').waitFor();check(stage+'刷新未新增模型调用',(await task(id)).request_count===before.request_count);
  }else throw Error('Unknown stage');
  check(stage+'无浏览器运行异常',!errors.length);
 }finally{await page.screenshot({path:path.join(out,'last-'+stage+'.png'),fullPage:true}).catch(()=>{});await browser.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
