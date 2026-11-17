// Explicitly OFFLINE browser acceptance; refuses any non-test backend.
const {launch}=require('./browser-runtime.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/demo-prefill/browser');
const base=process.env.PREVIEW_URL||'http://127.0.0.1:4178';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
fs.mkdirSync(out,{recursive:true});
async function main(){
 const browser=await launch(),ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await ctx.newPage();
 page.setDefaultTimeout(12000);
 const errors=[],checks=[],state={};page.on('pageerror',e=>errors.push(e.message));
 const check=(n,v)=>{assert.ok(v,n);checks.push(n);console.log('PASS',n)};
 async function get(p){const r=await ctx.request.get(base+'/api'+p);assert.equal(r.status(),200,p);return r.json()}
 async function until(fn){for(let i=0;i<120;i++){if(await fn())return;await page.waitForTimeout(150)}throw Error('offline wait timeout')}
 const route=p=>base+`/app/projects/${state.pid}/`+p;
 const shot=n=>page.screenshot({path:path.join(out,n+'.png'),fullPage:true});
 try{
  await page.goto(base+'/auth?mode=register');
  await page.getByLabel('邮箱',{exact:true}).fill('prefill-'+crypto.randomUUID()+'@example.com');
  const password=crypto.randomBytes(18).toString('base64url')+'Aa1!';
  await page.getByLabel('密码',{exact:true}).fill(password);await page.getByLabel('确认密码',{exact:true}).fill(password);
  await page.locator('.auth-submit').click();await page.waitForURL('**/app');
  const config=await get('/ai/config');assert.ok(config.test_mode&&config.model==='OFFLINE-SCRIPTED-NOT-LIVE','REFUSE real AI backend');
  await page.getByRole('button',{name:'创建第一个项目',exact:true}).click();await page.getByLabel('项目名称',{exact:true}).fill('统一演示预填 · 独立离线模拟');await page.getByRole('button',{name:'创建项目',exact:true}).click();await page.waitForURL('**/materials');state.pid=new URL(page.url()).pathname.split('/')[3];
  const files=['统一演示_12条.csv','统一演示_报告50.docx','统一演示_满意50.png'].map(n=>path.join(root,'artifacts/unified-demo-fixtures',n));
  await page.getByLabel('选择资料文件').setInputFiles(files);
  let assets;await until(async()=>{assets=await get(`/projects/${state.pid}/assets`);return assets.length===3&&assets.every(a=>a.status==='ready')});
  state.table=assets.find(a=>a.kind==='table');state.report=assets.find(a=>a.kind==='report');state.image=assets.find(a=>a.kind==='image');
  check('three actual originals recognized; no rules saved before click',!(await get(`/projects/${state.pid}/rule-snapshots`)).items.length);
  const confirm=page.getByRole('button',{name:'确认并保存演示口径',exact:true});await confirm.waitFor();await shot('prefill-before-confirm');await confirm.click();
  await page.getByRole('heading',{name:'演示口径已确认 · v1',exact:true}).waitFor();
  let head=await get(`/projects/${state.pid}/rule-snapshots`);state.snapshot=head.items[0];
  check('one click saves nine sourced constraints with keep-null policy',head.current_valid&&head.items.length===1&&Object.keys(state.snapshot.sources).length===9&&state.snapshot.constraints.null_policy==='keep');
  check('all rules have actual source quote',Object.values(state.snapshot.sources).every(s=>s.text.includes(s.quote)&&s.paragraph_id&&s.asset_id));
  await page.reload();await page.getByRole('heading',{name:'演示口径已确认 · v1',exact:true}).waitFor();check('refresh preserves confirmed rule',true);await shot('prefill-saved');
  await page.getByRole('link',{name:'进入数据分析',exact:true}).click();await page.getByRole('button',{name:'新建分析会话',exact:true}).click();await page.getByRole('button',{name:'填入演示问题',exact:true}).click();
  check('analysis question explicitly filled by user action',(await page.getByLabel('对话分析问题',{exact:true}).inputValue()).includes('各学院'));
  await page.getByRole('checkbox',{name:/同意发送必要问题/}).check();
  const question=page.waitForResponse(r=>r.url().endsWith('/questions')&&r.request().method()==='POST');await page.getByRole('button',{name:'提交分析问题',exact:true}).click();state.turn=(await(await question).json()).id;
  await page.locator('.analysis-plan').waitFor();await page.getByRole('button',{name:'确认方案并计算',exact:true}).click();
  let analysis;await until(async()=>{analysis=await get('/analysis-turns/'+state.turn);return !!analysis.run_id});
  check('real engine A50 B25 overall40 with offline proposal',analysis.run.result.display_value==='40'&&analysis.run.result.groups.find(g=>g.label==='A').result.display_value==='50'&&analysis.run.result.groups.find(g=>g.label==='B').result.display_value==='25');await shot('analysis');
  await page.goto(route('verify'));await page.getByLabel('报告资料',{exact:true}).selectOption(state.report.id);await page.locator('.ai-paragraphs button').filter({hasText:'满意率为50%'}).click();await page.getByRole('checkbox',{name:/同意本次调用/}).check();
  await page.getByRole('button',{name:'提取最多5条候选陈述',exact:true}).click();await page.waitForURL('**/*task=*');state.textTask=new URL(page.url()).searchParams.get('task');
  await page.locator('.ai-candidates button').first().click();await page.getByRole('button',{name:'确认并计算',exact:true}).waitFor();await page.getByRole('button',{name:'确认并计算',exact:true}).click();
  let text;await until(async()=>{text=await get('/ai-tasks/'+state.textTask);return !!text.run_id});
  check('text50 -> real40 diff10 with same rule snapshot',text.check.result.status==='different'&&text.check.result.difference_pp==='-10'&&text.payload.rule_snapshot.id===state.snapshot.id);await shot('text');
  await page.goto(route('verify?mode=image'));await page.getByLabel('项目图片',{exact:true}).selectOption(state.image.id);
  await page.getByRole('checkbox',{name:/同意将本次选区/}).check();await page.getByRole('button',{name:'识别选区内的可见标签',exact:true}).click();
  await page.waitForURL('**/*imageTask=*');state.imageTask=new URL(page.url()).searchParams.get('imageTask');
  await page.locator('.image-candidates button').first().click();await page.getByRole('checkbox',{name:/我已对照原图确认/}).check();await page.getByRole('button',{name:'保存识别确认并查找规则',exact:true}).click();
  await page.getByRole('button',{name:'确认并计算',exact:true}).waitFor();await page.getByRole('button',{name:'确认并计算',exact:true}).click();
  let image;await until(async()=>{image=await get('/image-tasks/'+state.imageTask);return !!image.run_id});
  check('image50 -> real40 diff10 with same rule snapshot',image.result.status==='different'&&image.result.difference_pp==='-10'&&image.payload.rule_snapshot.id===state.snapshot.id);await shot('image');
  await page.setViewportSize({width:390,height:844});await page.goto(route('materials'));await page.getByRole('heading',{name:'演示口径已确认 · v1',exact:true}).waitFor();check('390px no page overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('mobile');
  await page.reload();check('saved tasks survive reload',(await get('/ai-tasks/'+state.textTask)).run_id===text.run_id&&(await get('/image-tasks/'+state.imageTask)).run_id===image.run_id);
  check('no frontend runtime errors',!errors.length);
  fs.writeFileSync(path.join(out,'state.json'),JSON.stringify(state,null,2));
  fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({mode:'OFFLINE scripted provider + real engine, no paid requests',checks,errors},null,2));
 }catch(e){await shot('failure');throw e}finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
