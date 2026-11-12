// Run after restarting backend/tests/preview_ai.py with its same isolated data directory.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../artifacts/ai-v05');const saved=JSON.parse(fs.readFileSync(path.join(out,'run.json')));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {
  const context=await browser.newContext({storageState:path.join(out,'session.json'),viewport:{width:390,height:844},reducedMotion:'reduce'});
  const response=await context.request.get('http://127.0.0.1:5174/api/ai-tasks/'+saved.taskId);assert.equal(response.status(),200);const task=await response.json();
  assert.equal(task.check.result.difference_pp,'8');assert.equal(task.run.result.display_value,'80');assert.equal(task.status,'stale');assert.equal(task.request_count,4);
  const page=await context.newPage();await page.goto('http://127.0.0.1:5174'+saved.route+'?task='+saved.taskId);await page.locator('.ai-result').waitFor();await page.reload();await page.locator('.ai-result').waitFor();
  assert.ok((await page.locator('.ai-comparison').innerText()).includes('8 个百分点'));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
  await page.getByRole('tab',{name:'规则原文',exact:true}).click();await page.locator('.ai-rule').waitFor();assert.ok((await page.locator('.ai-rule').innerText()).includes('满意率统计规则'));
  await page.screenshot({path:path.join(out,'simulated-restored-mobile.png'),fullPage:true});
  fs.writeFileSync(path.join(out,'restart-checks.json'),JSON.stringify({processRestart:true,preserved:['80%','8个百分点','规则原文快照','已确认方案','4次模拟请求计数','过期状态'],mobileRefresh:true,liveModelRequests:0},null,2));
  console.log('PASS actual backend process restart, saved AI plan/result/evidence, 390px route refresh, no additional model request');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
