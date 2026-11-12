// Real browser + real SQLite/calculation API, EXPLICIT simulated model on port 5174.
// No paid calls. The normal server on 5173 is separately checked as unconfigured.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const out = path.resolve(__dirname, '../../artifacts/ai-v05');
const base = 'http://127.0.0.1:5174';
const headers = { 'X-Requested-With': 'shuyouyiju' };
const checks = [];
function check(name, value) { assert.ok(value, name); checks.push(name); console.log('PASS', name); }
async function until(fn) { for (let i=0; i<100; i++) { if (await fn()) return; await new Promise(r => setTimeout(r, 200)); } throw new Error('Timed out'); }
async function main() {
 fs.mkdirSync(out, { recursive: true });
 const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
 const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, reducedMotion: 'reduce' });
 const page = await context.newPage(); const errors=[]; page.on('pageerror', e => errors.push(e.message));
 const email=`ai-browser-${Date.now()}@example.com`, password='Evidence2026!';
 async function request(method, url, data, status=200) { const response=await context.request[method](base+'/api'+url,{headers,data}); assert.equal(response.status(),status,await response.text()); return response.json(); }
 async function shot(name) { await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({top:0,behavior:'instant'}); }); await page.screenshot({path:path.join(out,name+'.png'),fullPage:true}); }
 try {
  await page.goto(base+'/auth?mode=register'); await page.getByLabel('邮箱',{exact:true}).fill(email); await page.getByLabel('密码',{exact:true}).fill(password); await page.getByLabel('确认密码',{exact:true}).fill(password); await page.locator('.auth-submit').click(); await page.waitForURL('**/app');
  check('原注册、自动登录和工作空间可用',true);
  const project=await request('post','/projects',{name:'合成验收 · AI单条占比（模拟模型）',goal:'verify'},201);
  const pid=project.id; const route=`/app/projects/${pid}/ai-verification`;
  const csv='记录编号,记录状态,反馈选项\n'+Array.from({length:200},(_,i)=>`${i+1},${i<180?'有效':'无效'},${i<144||i>=180?'满意':'一般'}`).join('\n');
  const upload=await context.request.post(base+`/api/projects/${pid}/assets`,{headers,multipart:{file:{name:'独立合成验收200条.csv',mimeType:'text/csv',buffer:Buffer.from('\ufeff'+csv)}}}); assert.equal(upload.status(),201,await upload.text());
  const report=await request('post',`/projects/${pid}/reports`,{name:'合成百分比报告',text:'有效记录的满意占比为72%。\n有效记录的满意占比为80%。\n满意率比去年提升8个百分点。'},201);
  const rule=await request('post',`/projects/${pid}/reports`,{name:'合成统计规则',text:'满意率统计规则：以记录状态为有效的记录作为分母，以其中反馈选项为满意的记录作为分子。单位为记录，不去重。保留空值，空值不匹配等值条件。'},201);
  await page.goto(base+route); await page.locator('.ai-source').waitFor();
  await page.locator('.ai-rule-setup summary').click(); await page.locator('.ai-rule-setup label').filter({hasText:'合成统计规则'}).getByRole('checkbox').click();
  await until(()=>page.locator('.ai-rule-setup summary').innerText().then(x=>x.includes('已选 1')));
  check('界面可以指定真实规则资料',true);
  async function extract(text) {
   await page.getByLabel('报告资料',{exact:true}).selectOption(report.id);
   await page.locator('.ai-paragraphs button').filter({hasText:text}).click();
   await page.getByRole('checkbox',{name:/同意本次调用/}).check();
   await page.getByRole('button',{name:'提取最多5条候选陈述',exact:true}).click();
   await page.locator('.ai-candidates button').first().waitFor();
   await page.locator('.ai-candidates button').first().click();
  }
  await extract('72%'); await page.locator('.ai-plan-editor').waitFor();
  check('提取、真实规则检索、待确认方案可见',await page.locator('.ai-plan-summary').innerText().then(x=>x.includes('有效')&&x.includes('满意')));
  await shot('simulated-plan-desktop');
  await page.getByLabel('确认说明',{exact:true}).fill('已核对规则原文：以有效记录为分母，以满意记录为分子，保留空值、不去重。');
  await page.getByRole('checkbox',{name:/我已核对所选规则/}).check(); await page.getByRole('checkbox',{name:/我已核对原文 72%/}).check(); await page.getByRole('button',{name:'确认方案，执行真实计算',exact:true}).click();
  await page.locator('.ai-result').waitFor();
  check('模拟模型驱动真实后台144/180=80%，报告72%相差8个百分点',(await page.locator('.ai-comparison').innerText()).includes('8 个百分点')&&(await page.locator('.ai-formula').innerText()).includes('144 ÷ 180'));
  check('页面持续清楚标记模型模拟验收',(await page.locator('.ai-service-banner').innerText()).includes('模拟模型验收'));
  const taskId=new URL(page.url()).searchParams.get('task');
  const task=await request('get','/ai-tasks/'+taskId);
  check('真实工具记录与4次模拟请求一致',task.request_count===4&&task.tool_count===2&&task.check.status==='different');
  await shot('simulated-result-desktop');
  await page.getByRole('tab',{name:'原始数据',exact:true}).click(); await page.locator('.calc-data-table tbody tr').first().waitFor();
  check('证据按页加载25行',await page.locator('.calc-data-table tbody tr').count()===25);
  await page.getByLabel('证据记录分组',{exact:true}).selectOption('numerator'); await until(()=>page.locator('.evidence-card .calc-pagination > span').innerText().then(x=>x.includes('144')));
  await page.getByRole('button',{name:'定位源行 2',exact:true}).click();
  await shot('simulated-evidence-desktop');
  await page.getByRole('tab',{name:'规则原文',exact:true}).click(); await page.locator('.ai-rule').waitFor();
  check('规则原文来自真实资料并保留稳定ID',(await page.locator('.ai-rule').innerText()).includes(rule.id));
  const ruleLink=await page.locator('.ai-rule > a').getAttribute('href');
  const sourcePage=await context.newPage();await sourcePage.goto(base+ruleLink);await sourcePage.locator('.linked-source-paragraph').waitFor();check('规则链接可在资料页定位高亮原段落',(await sourcePage.locator('.linked-source-paragraph').innerText()).includes('满意率统计规则'));await sourcePage.close();
  await page.getByRole('tab',{name:'比较结果',exact:true}).click();
  for(const width of [768,390]) {
   await page.setViewportSize({width,height:width===390?844:1080});
   check(`${width}px没有页面横向溢出`,await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
   await shot('simulated-result-'+width);
  }
  await page.getByRole('tab',{name:'原始数据',exact:true}).click();await page.locator('.calc-data-table tbody tr').first().waitFor();
  check('390px表格只在自身容器滚动',await page.locator('.calc-table-scroll').evaluate(el=>el.getBoundingClientRect().right<=innerWidth&&getComputedStyle(el).overflowX==='auto'));
  await shot('simulated-evidence-mobile');
  await page.reload();await page.locator('.ai-result').waitFor();
  check('390px深层路由刷新恢复单条核验',await page.locator('.ai-comparison').innerText().then(x=>x.includes('8 个百分点')));
  await page.setViewportSize({width:1440,height:1080});
  await extract('80%');await page.locator('.ai-plan-editor').waitFor();await page.getByLabel('确认说明',{exact:true}).fill('已逐项核对规则，范围和精度一致。');await page.getByRole('checkbox',{name:/我已核对所选规则/}).check();await page.getByRole('checkbox',{name:/我已核对原文 80%/}).check();await page.getByRole('button',{name:'确认方案，执行真实计算',exact:true}).click();await page.locator('.ai-result').waitFor();check('80%单条核验与数据一致',(await page.locator('.ai-result').innerText()).includes('与数据一致'));await shot('simulated-consistent-desktop');
  await extract('提升8个百分点');await until(()=>page.locator('.ai-task h2').innerText().then(x=>x.includes('证据不足')));check('缺基期数据的百分点变化不会通过',(await page.locator('.ai-task').innerText()).includes('基期证据')&&await page.locator('.ai-result').count()===0);await shot('simulated-unsupported-desktop');
  await request('put',`/projects/${pid}/rule-materials/${rule.id}`,{enabled:false});await page.goto(base+route+'?task='+taskId);await page.locator('.ai-result').waitFor();check('规则改变后旧AI记录仍保存且待复核',(await page.locator('.ai-task h2').innerText()).includes('待重新复核'));await shot('simulated-stale-desktop');
  await page.goto(base+`/app/projects/${pid}/calculations?run=${task.run_id}`);await page.locator('.computed-value').waitFor();await page.locator('.numeric-check-result').first().waitFor();check('AI结果进入原手动历史与核验组件',(await page.locator('.computed-value strong').innerText()).includes('80')&&await page.locator('.numeric-check-result').count()===1);
  // Separate normal app: do not fabricate live availability.
  const actual=await browser.newContext({viewport:{width:1440,height:1080}});const actualPage=await actual.newPage();await actual.request.post('http://127.0.0.1:5173/api/auth/register',{headers,data:{email,password}});await actual.request.post('http://127.0.0.1:5173/api/auth/login',{headers,form:{username:email,password}});const p=await (await actual.request.post('http://127.0.0.1:5173/api/projects',{headers,data:{name:'模型配置检查（合成验收）',goal:'verify'}})).json();await actualPage.goto(`http://127.0.0.1:5173/app/projects/${p.id}/ai-verification`);await actualPage.locator('.ai-service-banner').waitFor();check('正式后台无凭据明确显示真实AI尚未接通',(await actualPage.locator('.ai-service-banner').innerText()).includes('真实 AI 尚未接通'));check('无配置时不能伪造提取结果',await actualPage.getByRole('button',{name:'提取最多5条候选陈述'}).isDisabled());await actualPage.screenshot({path:path.join(out,'unconfigured-desktop.png'),fullPage:true});await actualPage.setViewportSize({width:390,height:844});check('390px未配置页面无横向溢出',await actualPage.evaluate(()=>document.documentElement.scrollWidth===innerWidth));await actualPage.screenshot({path:path.join(out,'unconfigured-mobile.png'),fullPage:true});await actual.close();
  check('浏览器无运行时异常',errors.length===0);
  await context.storageState({path:path.join(out,'session.json')});
  fs.writeFileSync(path.join(out,'run.json'),JSON.stringify({pid,taskId,runId:task.run_id,route,requests72:task.request_count,model:'SIMULATED — no paid model calls'},null,2));
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({checks,errors,liveModelRequests:0,note:'Model simulated; calculation, database, rules, auth and browser real.'},null,2));
 } finally { await browser.close(); }
}
main().catch(e=>{console.error(e);process.exit(1);});


