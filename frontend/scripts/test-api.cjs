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
 let a=api('/fixture'),b=api('/fixture');assert.equal(calls,2);releases.splice(0).forEach(r=>r(reply()));assert.deepEqual(await a,await b);
 const fresh=api('/fixture');assert.equal(calls,3);releases.shift()(reply());await fresh;
 const writes=[api('/fixture',{method:'POST',body:'{}'}),api('/fixture',{method:'POST',body:'{}'})];assert.equal(calls,5);releases.splice(0).forEach(r=>r(reply()));await Promise.all(writes);
 const fail=api('/failure');releases.shift()(reply(503));await assert.rejects(fail);const retry=api('/failure');assert.equal(calls,7);releases.shift()(reply());await retry;
 const signal=new AbortController();a=api('/abort');b=api('/abort',{signal:signal.signal});assert.equal(calls,9);releases.splice(0).forEach(r=>r(reply()));await Promise.all([a,b]);
 // Aborting a caller must not abort another read of the same URL.
 let abortPending=[];
 global.fetch=(_url,options)=>new Promise((resolve,reject)=>{abortPending.push(resolve);options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true})});
 const ownController=new AbortController();const cancelled=api('/same',{signal:ownController.signal}),sibling=api('/same');const rejected=assert.rejects(cancelled,e=>e.name==='AbortError');ownController.abort();await rejected;abortPending[1](reply());assert.deepEqual(await sibling,{saved:'actual'});
 console.log('PASS independent GET lifetimes; fresh reads, failure retry, independent writes and actual independent cancellation');
})().catch(e=>{console.error(e);process.exitCode=1});
