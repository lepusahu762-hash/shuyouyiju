// Real backend writes + actual browser UI; delays only GET response delivery.
// Creates an independent synthetic account/project; never calls a model.
const {launch}=require('./browser-runtime.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/unified-demo-v15/race'),base=process.env.PREVIEW_URL||'http://127.0.0.1:4173';
fs.mkdirSync(out,{recursive:true});const checks=[];const check=(n,v)=>{assert.ok(v,n);checks.push(n);console.log('PASS',n)};
async function main(){const browser=await launch(),ctx=await browser.newContext({viewport:{width:1440,height:1080}}),page=await ctx.newPage();let writes=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await ctx.route('**/api/**',r=>{if(/ai-tasks|image-tasks|questions/.test(r.request().url())&&r.request().method()!=='GET'){writes++;return r.abort()}return r.continue()});
 try{
 const email=`race-${Date.now()}@example.com`,password=crypto.randomBytes(18).toString('base64url')+'Aa1!';
 await page.goto(base+'/auth?mode=register');await page.getByLabel('邮箱',{exact:true}).fill(email);await page.getByLabel('密码',{exact:true}).fill(password);await page.getByLabel('确认密码',{exact:true}).fill(password);await page.locator('.auth-submit').click();await page.waitForURL('**/app');
 await page.getByRole('button',{name:'创建第一个项目',exact:true}).click();await page.getByLabel('项目名称',{exact:true}).fill('独立合成 · 资料请求时序回归');await page.getByRole('button',{name:'创建项目',exact:true}).click();await page.waitForURL('**/materials');const pid=new URL(page.url()).pathname.split('/')[3];await page.locator('.material-columns').waitFor();
 async function saveReport(name){await page.getByRole('button',{name:'粘贴报告',exact:true}).click();await page.getByLabel('报告名称',{exact:true}).fill(name);await page.getByLabel('报告正文',{exact:true}).fill('独立合成请求时序检查，不用于统计规则或模型。');await page.getByRole('button',{name:'保存报告',exact:true}).click();await page.locator('.paste-dialog').waitFor({state:'hidden'})}
 // Seed a real file, then fake only its delivered parse status to schedule polling.
 await saveReport('独立合成_已有报告');
 async function scenario(kind){
  let count=0,release,heldResolve;const held=new Promise(r=>heldResolve=r);const delay=new Promise(r=>release=r);
  const pattern=`**/api/projects/${pid}/assets`;
  await page.route(pattern,async route=>{if(route.request().method()!=='GET')return route.continue();count++;const response=await route.fetch();
   if(count===1){const data=await response.json();data[0]={...data[0],status:'parsing'};return route.fulfill({response,json:data})}
   if(count===2){heldResolve();await delay;return route.fulfill({response})}
   return route.fulfill({response});
  });
  await page.reload();await page.locator('.material-columns').waitFor();await held;
  const name=kind==='report'?'独立合成_写入后新报告':'独立合成_XHR上传.csv';
  if(kind==='report')await saveReport(name);else await page.getByLabel('选择资料文件').setInputFiles({name,mimeType:'text/csv',buffer:Buffer.from('字段,状态\nA,有效\n','utf8')});
  await page.locator('.file-item strong').filter({hasText:name}).waitFor();await page.waitForFunction(()=>document.querySelectorAll('.file-item').length>1);assert.ok(count>=3,'write completion issued an independent assets GET');
  release();await page.waitForTimeout(350);check(kind+'：旧GET延迟返回未覆盖新资料',await page.locator('.file-item strong').filter({hasText:name}).count()===1);
  const actual=await ctx.request.get(base+`/api/projects/${pid}/assets`);check(kind+'：真实后台保存且列表数量一致',actual.ok()&&(await actual.json()).length===await page.locator('.file-item').count());
  await page.unroute(pattern);await page.reload();await page.locator('.file-item strong').filter({hasText:name}).waitFor();check(kind+'：刷新恢复真实新资料',true);
 }
 await scenario('report');await scenario('upload');check('没有模型写入或运行异常',writes===0&&errors.length===0);
 await page.screenshot({path:path.join(out,'materials-race-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'materials-race-mobile.png'),fullPage:true});
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pid,checks,errors,modelRequests:0},null,2));
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
