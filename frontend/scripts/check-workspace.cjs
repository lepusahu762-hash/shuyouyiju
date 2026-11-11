// Requires running API + Vite and fixtures from backend/scripts/make_fixtures.py.
// Creates synthetic test accounts/projects; never deletes or changes existing users' data.
// Run "seed", restart the actual API process, then run "restart" with the same QA_OUTPUT.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5173';
const out = path.resolve(process.env.QA_OUTPUT || path.join(__dirname, '../../artifacts/workspace'));
const fixtures = path.resolve(process.env.QA_FIXTURES || path.join(out, 'fixtures'));
const phase = process.argv[2] || 'seed';
const headers = { 'X-Requested-With': 'shuyouyiju' };
const results = [];
const check = (name, value) => { assert.ok(value, name); results.push(name); console.log('PASS', name); };
async function until(fn, description) {
  for (let i=0;i<80;i++) { const value = await fn(); if (value) return value; await new Promise(r=>setTimeout(r,250)); }
  throw new Error('Timed out: '+description);
}
async function main() {
  fs.mkdirSync(out, {recursive:true});
  const browser = await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE ? {executablePath:process.env.BROWSER_EXECUTABLE} : {})});
  const state = phase === 'restart' ? JSON.parse(fs.readFileSync(path.join(out, 'run.json'))) : {email:`qa-${Date.now()}@example.com`, password:'Workspace2026!', projects:[]};
  const context = await browser.newContext({viewport:{width:1440,height:1080}, reducedMotion:'reduce', ...(phase==='restart'?{storageState:path.join(out,'session.json')}:{})});
  const page = await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const get = async url => { const r=await context.request.get(base+'/api'+url);assert.equal(r.status(),200,await r.text());return r.json(); };
  const saveState = () => fs.writeFileSync(path.join(out,'run.json'),JSON.stringify(state,null,2));
  async function shot(name) { await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo({top:0,behavior:'instant'});});await page.screenshot({path:path.join(out,name+'.png'),fullPage:true}); }
  async function openAsset(name) { await page.locator('.file-item').filter({hasText:name}).click();await until(()=>page.locator('.preview-meta .ready').isVisible(),'asset ready'); }
  try {
    if (phase==='restart') {
      const projects=await get('/projects');check('真实后台进程重启后会话仍有效，项目保留',projects.some(p=>p.id===state.pid&&p.name==='校园调查 · 已整理'));
      const project=await get('/projects/'+state.pid);check('重启后统计口径和资料数量保留',project.rules.scope==='全校有效答题问卷'&&project.asset_count===5);
      const assets=await get('/projects/'+state.pid+'/assets');const csv=assets.find(a=>a.id===state.csvId);
      check('重启后字段说明保留',Object.values(csv.annotations).some(f=>f.meaning==='有效答题人数'&&f.unit==='人'));
      const preview=await get('/assets/'+state.docxId+'/preview');check('重启后 DOCX 稳定段落标识与内容一致',JSON.stringify(preview.paragraphs)===JSON.stringify(state.paragraphs));
      const raw=await context.request.get(base+'/api/assets/'+state.csvId+'/original');check('重启后原始 CSV 字节未改变',(await raw.body()).equals(fs.readFileSync(path.join(fixtures,'survey.csv'))));
      await page.goto(base+state.route);await page.locator('.materials-heading h1').waitFor();await page.reload();await page.getByLabel('对象范围',{exact:true}).waitFor();check('项目深层路由直接访问和刷新正常',(await page.getByLabel('对象范围',{exact:true}).inputValue())==='全校有效答题问卷');
      await page.goto(base+'/app');await page.reload();await page.locator('.projects-table tbody tr').first().waitFor();check('工作空间直接访问与刷新正常',await page.locator('.projects-table tbody tr').count()===2);
      await shot('workspace-after-restart');
    } else {
      await page.goto(base+'/app');await page.waitForURL('**/auth?next=*');check('未登录访问工作空间跳登录并保留返回目标',new URL(page.url()).searchParams.get('next')==='/app');
      await page.getByRole('group',{name:'登录或注册'}).getByRole('button',{name:'注册',exact:true}).click();
      await page.getByLabel('邮箱',{exact:true}).fill(state.email);await page.getByLabel('密码',{exact:true}).fill(state.password);await page.getByLabel('确认密码',{exact:true}).fill(state.password);await page.locator('.auth-submit').click();
      await page.waitForURL('**/app');await page.locator('.workspace-empty').waitFor();check('新用户注册并真实登录，工作空间为空', (await get('/projects')).length===0);await shot('workspace-empty');
      await page.getByRole('button',{name:'创建第一个项目',exact:true}).click();await page.getByLabel('项目名称',{exact:true}).fill('校园调查');await page.getByRole('button',{name:'创建项目',exact:true}).click();await page.waitForURL('**/materials');await page.locator('.materials-heading h1').waitFor();state.route=new URL(page.url()).pathname;state.pid=state.route.split('/')[3];check('创建分析项目并进入资料页',(await get('/projects/'+state.pid)).goal==='analysis');
      await page.getByLabel('选择资料文件').setInputFiles(['survey.csv','survey.xlsx','report.docx','broken.xlsx'].map(f=>path.join(fixtures,f)));
      let assets=await until(async()=>{const a=await get('/projects/'+state.pid+'/assets');return a.length===4&&a.every(x=>['ready','failed'].includes(x.status))?a:false},'four parsed uploads');
      const csv=assets.find(a=>a.extension==='.csv'), xlsx=assets.find(a=>a.name==='survey.xlsx'), docx=assets.find(a=>a.extension==='.docx'), broken=assets.find(a=>a.name==='broken.xlsx');state.csvId=csv.id;state.docxId=docx.id;
      check('CSV 3 行、3 列，重复表头与空值准确保留',csv.summary.sheets[0].row_count===3&&csv.summary.sheets[0].columns.length===3&&csv.summary.sheets[0].issues.length===2);
      check('XLSX 两个工作表及行数准确',JSON.stringify(xlsx.summary.sheets.map(s=>s.row_count))==='[3,1]');
      state.paragraphs=(await get('/assets/'+docx.id+'/preview')).paragraphs;
      check('DOCX 4 个正文/表格段落内容及原位置正确',state.paragraphs.length===4&&state.paragraphs[2].location==='body:4'&&state.paragraphs[2].text.includes('144'));
      await openAsset('survey.csv');await page.getByLabel('选择字段',{exact:true}).selectOption(csv.summary.sheets[0].columns[1].id);await page.getByLabel('字段含义',{exact:true}).fill('有效答题人数');await page.getByLabel('单位',{exact:true}).fill('人');await page.getByRole('button',{name:'保存字段说明',exact:true}).click();await page.getByText('字段说明已保存。',{exact:true}).waitFor();
      await page.getByLabel('对象范围',{exact:true}).fill('全校有效答题问卷');await page.getByLabel('统计期间',{exact:true}).fill('2026 年秋季');await page.getByLabel('指标定义与计算口径',{exact:true}).fill('满意率 = 满意人数 ÷ 有效且回答该题的人数');await page.getByLabel('空值与异常处理决定',{exact:true}).fill('空值先保留，待与原始问卷核对；不自动填充。');await page.getByRole('button',{name:'保存统计口径',exact:true}).click();await page.getByText('统计口径已保存到项目。',{exact:true}).waitFor();
      await page.reload();await page.getByLabel('对象范围',{exact:true}).waitFor();check('刷新后统计口径仍在',(await page.getByLabel('对象范围',{exact:true}).inputValue())==='全校有效答题问卷');await page.getByLabel('选择字段',{exact:true}).selectOption(csv.summary.sheets[0].columns[1].id);check('刷新后字段含义和单位仍在',(await page.getByLabel('字段含义',{exact:true}).inputValue())==='有效答题人数'&&(await page.getByLabel('单位',{exact:true}).inputValue())==='人');await shot('materials-csv-desktop');
      await openAsset('survey.xlsx');await page.getByLabel('工作表',{exact:true}).selectOption('s2');await until(()=>page.locator('.data-grid').innerText().then(t=>t.includes('合成测试数据')),'second sheet');check('工作表切换实际改变预览',(await page.locator('.sheet-controls').innerText()).includes('1 行'));await page.getByLabel('工作表',{exact:true}).selectOption('s1');
      await openAsset('report.docx');await page.locator('.report-preview article').first().waitFor();check('报告段落可定位显示',await page.locator('.report-preview article').count()===4);await shot('materials-report-desktop');
      await page.getByRole('button',{name:'粘贴报告',exact:true}).click();await page.getByLabel('报告名称',{exact:true}).fill('补充报告');await page.getByLabel('报告正文',{exact:true}).fill('第一段：数据待复核。\n\n第二段：保留统计口径。');await page.getByRole('button',{name:'保存报告',exact:true}).click();await page.locator('.paste-dialog').waitFor({state:'hidden'});assets=await until(async()=>{const a=await get('/projects/'+state.pid+'/assets');return a.length===5&&a.find(x=>x.extension==='.txt')?.status==='ready'?a:false},'pasted report');const pasted=assets.find(a=>a.extension==='.txt');check('粘贴报告真实保存并保留原行位置',(await get('/assets/'+pasted.id+'/preview')).paragraphs[1].location==='line:3');
      await page.locator('.file-item').filter({hasText:'broken.xlsx'}).click();await page.locator('.parse-failure').waitFor();check('损坏文件显示真实解析失败',broken.status==='failed'&&!!broken.error);await page.getByRole('button',{name:'重试解析',exact:true}).click();await until(async()=>{const a=await get('/assets/'+broken.id);return a.status==='failed'&&a.updated_at!==broken.updated_at},'individual retry');check('失败可单独重试且保留原件',(await context.request.get(base+'/api/assets/'+broken.id+'/original')).status()===200);
      await page.getByLabel('选择资料文件').setInputFiles(path.join(fixtures,'unsupported.pdf'));await page.locator('.pending-upload').filter({hasText:'上传失败'}).waitFor();check('不支持的文件格式准确提示',(await page.locator('.pending-upload').innerText()).includes('仅支持'));await page.getByRole('button',{name:'移除提示',exact:true}).click();
      await page.getByRole('link',{name:'全部项目',exact:true}).click();await page.locator('.projects-table').waitFor();await page.getByRole('button',{name:'重命名 校园调查',exact:true}).click();await page.getByLabel('项目名称',{exact:true}).fill('校园调查 · 已整理');await page.getByRole('button',{name:'保存名称',exact:true}).click();await page.locator('dialog[open]').waitFor({state:'hidden'});check('重命名保存到后台',(await get('/projects/'+state.pid)).name==='校园调查 · 已整理');
      await page.getByLabel('搜索项目',{exact:true}).fill('不存在');await page.locator('.search-empty').waitFor();check('项目名称搜索正常',await page.locator('.projects-table tbody tr').count()===0);await page.getByRole('button',{name:'清除搜索',exact:true}).click();
      await page.getByRole('button',{name:'新建项目',exact:true}).click();await page.getByLabel('项目名称',{exact:true}).fill('经营月报 · 待整理');await page.getByRole('radio',{name:/核验已有报告/}).check();await page.getByRole('button',{name:'创建项目',exact:true}).click();await page.waitForURL('**/materials');await page.locator('.materials-heading h1').waitFor();check('支持创建核验报告目标',(await get('/projects')).some(p=>p.goal==='verify'));
      await page.goto(base+'/app');await page.locator('.projects-table').waitFor();check('项目资料数量来自实际数据',(await page.locator('.projects-table tbody').innerText()).includes('5 份'));await shot('workspace-desktop');
      for(const width of [320,390,768,1024,1440]) {
        await page.setViewportSize({width,height:width<600?844:1080});
        for (const [route,name] of [['/app','workspace'],[state.route,'materials']]) {
          await page.goto(base+route);await page.locator(name==='workspace'?'.projects-table':'.material-columns').waitFor();
          check(`${name} ${width}px 页面无横向溢出`,await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
          if(name==='materials') {
            await openAsset('survey.xlsx');await page.locator('.data-grid').waitFor();
            check(`${width}px 表格限制在独立滚动区域`,await page.locator('.data-grid-scroll').evaluate(el=>el.getBoundingClientRect().right<=innerWidth&&getComputedStyle(el).overflowX==='auto'));
          }
          if([390,768,1440].includes(width)) await shot(`${name}-${width}`);
          if(name==='materials'&&width===390) {
            await page.getByRole('button',{name:'字段与规则',exact:true}).click();await page.getByLabel('对象范围',{exact:true}).waitFor();await shot('materials-rules-mobile');check('手机可切换到字段和规则编辑',await page.getByRole('button',{name:'保存统计口径',exact:true}).isVisible());
          }
        }
      }
      await page.setViewportSize({width:1440,height:1080});await page.goto(base+'/app');await page.locator('.projects-table').waitFor();
      await page.route('**/api/projects',route=>route.abort('failed'));await page.reload();await page.locator('.work-error').waitFor();check('接口不可用显示准确提示',(await page.locator('.work-error').innerText()).includes('无法连接后台'));await page.unroute('**/api/projects');await page.getByRole('button',{name:'重试',exact:true}).click();await page.locator('.projects-table tbody tr').first().waitFor();check('连接恢复后可以重试加载',true);
      const other=await browser.newContext();const otherEmail=`other-${Date.now()}@example.com`;
      assert.equal((await other.request.post(base+'/api/auth/register',{headers,data:{email:otherEmail,password:state.password}})).status(),201);
      assert.equal((await other.request.post(base+'/api/auth/login',{headers,form:{username:otherEmail,password:state.password}})).status(),204);
      for(const url of ['/projects/'+state.pid,'/projects/'+state.pid+'/assets','/assets/'+csv.id,'/assets/'+csv.id+'/preview','/assets/'+csv.id+'/original'])check('账户 B 无权读取 '+url,(await other.request.get(base+'/api'+url)).status()===404);
      for(const [url,method,data] of [['/projects/'+state.pid,'patch',{name:'Forbidden'}],['/projects/'+state.pid+'/rules','put',{version:1,rules:{scope:'Forbidden'}}],['/assets/'+csv.id+'/fields','put',{version:1,fields:{}}],['/assets/'+broken.id+'/retry','post',{}]])check('账户 B 无权修改 '+url,(await other.request[method](base+'/api'+url,{headers,data})).status()===404);
      const otherPage=await other.newPage();await otherPage.goto(base+state.route);await otherPage.locator('.work-error').waitFor();check('页面显示项目不存在或无权访问',(await otherPage.locator('.work-error').innerText()).includes('无权访问'));await other.close();
      const cookie=context.cookies?await context.cookies():[];check('会话 Cookie 为 HttpOnly + SameSite Lax',cookie.some(c=>c.name==='syj_session'&&c.httpOnly&&c.sameSite==='Lax'));
      await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.waitForURL('**/auth');check('退出后后台拒绝旧登录态',(await context.request.get(base+'/api/auth/me')).status()===401);
      await page.getByLabel('邮箱',{exact:true}).fill(state.email);await page.getByLabel('密码',{exact:true}).fill('WrongPassword1');await page.locator('.auth-submit').click();await page.locator('.auth-submit-notice').waitFor();check('错误密码准确提示',(await page.locator('.auth-submit-notice').innerText()).includes('邮箱或密码不正确'));
      await page.getByRole('group',{name:'登录或注册'}).getByRole('button',{name:'注册',exact:true}).click();await page.getByLabel('密码',{exact:true}).fill(state.password);await page.getByLabel('确认密码',{exact:true}).fill(state.password);await page.locator('.auth-submit').click();await page.locator('.auth-submit-notice').waitFor();check('重复邮箱准确提示',(await page.locator('.auth-submit-notice').innerText()).includes('已经注册'));
      await page.goto(base+state.route);await page.waitForURL('**/auth?next=*');check('私有资料页保留合法返回路径',new URL(page.url()).searchParams.get('next')===state.route);await page.getByLabel('邮箱',{exact:true}).fill(state.email);await page.getByLabel('密码',{exact:true}).fill(state.password);await page.locator('.auth-submit').click();await page.waitForURL('**/materials');await page.locator('.materials-heading h1').waitFor();check('再次登录返回原项目',new URL(page.url()).pathname===state.route);
      await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.waitForURL('**/auth');await page.goto(base+'/auth?next=https://example.org/');await page.getByLabel('邮箱',{exact:true}).fill(state.email);await page.getByLabel('密码',{exact:true}).fill(state.password);await page.locator('.auth-submit').click();await page.waitForURL('**/app');check('拒绝外部返回地址并回到工作空间',new URL(page.url()).origin===base);
      check('密码和会话令牌不写入 localStorage/sessionStorage',await page.evaluate(()=>localStorage.length===0&&sessionStorage.length===0&&!document.cookie.includes('syj_session')));
      await context.storageState({path:path.join(out,'session.json')});saveState();
    }
    check('无浏览器 JavaScript 运行时错误',errors.length===0);
    fs.writeFileSync(path.join(out,phase+'-checks.json'),JSON.stringify({phase,checkedAt:new Date().toISOString(),browser:await browser.version(),checks:results,errors},null,2));
  } catch(error) {await shot('failure-'+phase);saveState();throw error;}
  finally {await browser.close();}
}
main().catch(error=>{console.error(error);console.error(`Completed ${results.length} checks`);process.exitCode=1;});
