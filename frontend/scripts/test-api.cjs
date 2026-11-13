// Network semantics regression. No server, account, or model requests.
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
 global.window=globalThis;
 const {api}=await import(pathToFileURL(path.resolve(__dirname,'../src/api.ts')).href);
 let calls=0,releases=[];
 global.fetch=()=>{calls++;return new Promise(resolve=>releases.push(resolve))};
 const reply=(status=200)=>new Response(JSON.stringify(status===200?{saved:'actual'}:{detail:'unavailable'}),{status,headers:{'Content-Type':'application/json'}});
 let a=api('/fixture'),b=api('/fixture');assert.equal(calls,1);releases.shift()(reply());assert.deepEqual(await a,await b);
 const fresh=api('/fixture');assert.equal(calls,2);releases.shift()(reply());await fresh;
 const writes=[api('/fixture',{method:'POST',body:'{}'}),api('/fixture',{method:'POST',body:'{}'})];assert.equal(calls,4);releases.splice(0).forEach(r=>r(reply()));await Promise.all(writes);
 const fail=api('/failure');releases.shift()(reply(503));await assert.rejects(fail);const retry=api('/failure');assert.equal(calls,6);releases.shift()(reply());await retry;
 const signal=new AbortController();a=api('/abort');b=api('/abort',{signal:signal.signal});assert.equal(calls,8);releases.splice(0).forEach(r=>r(reply()));await Promise.all([a,b]);
 console.log('PASS in-flight GET coalescing; fresh reads, failure retry, independent writes and signal requests remain separate');
})().catch(e=>{console.error(e);process.exitCode=1});
