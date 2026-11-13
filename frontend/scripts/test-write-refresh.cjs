// Deferred HTTP responses reproduce read -> saved report -> read ordering.
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 global.window=globalThis;const {api}=await import(pathToFileURL(path.resolve(__dirname,'../src/api.ts')).href);
 const pending=[];global.fetch=(url,options)=>new Promise(resolve=>pending.push({url,options,resolve}));
 const reply=x=>new Response(JSON.stringify(x),{headers:{'Content-Type':'application/json'}});
 const old=api('/projects/fixture/assets');
 const write=api('/projects/fixture/reports',{method:'POST',body:'{}'});pending[1].resolve(reply({id:'new-report'}));await write;
 const fresh=api('/projects/fixture/assets');
 assert.equal(pending.length,3,'post-write refresh must issue a fresh GET instead of borrowing pre-write read');
 pending[2].resolve(reply([{id:'new-report'}]));assert.deepEqual(await fresh,[{id:'new-report'}]);
 pending[0].resolve(reply([]));await old;
 const another=api('/projects/fixture/assets');assert.equal(pending.length,4);pending[3].resolve(reply([{id:'new-report'}]));await another;
 console.log('PASS post-write read is independent; late old read cannot remove a new pending request entry (no shared map)');
})().catch(e=>{console.error(e.message);process.exitCode=1});
