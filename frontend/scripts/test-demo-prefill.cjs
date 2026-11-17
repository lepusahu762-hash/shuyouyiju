// Offline unit checks of exact demo recognition and revalidation before submit.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module'),assert=require('node:assert/strict');
const src=path.resolve(__dirname,'../src'),hashes=require('../src/unifiedDemoFiles.json');
let responder;
const moduleMock={exports:{}};
const compiled=stripTypeScriptTypes(fs.readFileSync(path.join(src,'unifiedDemo.ts'),'utf8'))
 .replace(/^import .*$/gm,'').replace(/\bexport /g,'')
 +'\nmodule.exports={unifiedDemo,inspectUnifiedDemo,currentDemoRule,demoCitationIds,checkedDemoPlan};';
vm.runInNewContext(compiled,{module:moduleMock,fixtureHashes:hashes,api:(...args)=>responder(...args)});
const f=moduleMock.exports;
const names=['统一演示_12条.csv','统一演示_报告50.docx','统一演示_满意50.png'];
function assets(){return names.map((name,i)=>({id:'asset-'+i,name,kind:['table','report','image'][i],status:'ready',sha256:hashes.at(-1)[name],summary:i?{}:{sheets:[{id:'s1',name:'CSV 数据',row_count:12,columns:[{id:'c1',name:'所属学院'},{id:'c2',name:'纳入状态'},{id:'c3',name:'反馈等级'}]}]}}))}
async function main(){
 const originals=assets(),demo=f.unifiedDemo(originals);assert.ok(demo);
 assert.match(f.inspectUnifiedDemo([...originals,{...originals[2],id:'duplicate-image'}]).issue,/重复同名/);
 assert.match(f.inspectUnifiedDemo(originals.slice(0,2)).issue,/还需要/);
 const failed=structuredClone(originals);failed[2].status='failed';assert.match(f.inspectUnifiedDemo(failed).issue,/重试解析/);
 const unknown=structuredClone(originals);unknown[1].sha256='0'.repeat(64);assert.match(f.inspectUnifiedDemo(unknown).issue,/指纹/);
 for(const [label,change]of [
 ['changed bytes',a=>a[1].sha256='0'.repeat(64)],['renamed',a=>a[0].name='用户自己的表格.csv'],
 ['duplicate',a=>a.push({...a[0],id:'duplicate'})],['not ready',a=>a[2].status='failed'],
 ['wrong schema',a=>a[0].summary.sheets[0].columns[0].name='其他'],['wrong row count',a=>a[0].summary.sheets[0].row_count=13]]){
  const a=structuredClone(originals);change(a);assert.equal(f.unifiedDemo(a),null,label);
 }
 const rule={id:'rule1',constraints:demo.spec,sources:{metric:{paragraph_id:'p1'}}};
 let head={items:[rule],current_id:rule.id,current_valid:true};
 assert.equal(f.currentDemoRule(head,demo).id,rule.id);
 assert.equal(f.currentDemoRule({...head,current_valid:false},demo),null);
 assert.equal(f.currentDemoRule({...head,items:[{...rule,constraints:{...demo.spec,null_policy:'exclude'}}]},demo),null);
 const citations=[{citation_id:'p1'},{citation_id:'forged'}];assert.deepEqual(Array.from(f.demoCitationIds(rule,citations)),['p1']);
 const task={id:'t',project_id:'p',status:'awaiting_confirmation',stale:false,run_id:null,context_hash:'ctx',payload:{rule_snapshot:rule,citations}};
 let fresh=task,conflict=false,writes=[];
 responder=async(url,opts)=>{if(opts){writes.push(url);return {rule_check:{snapshot_id:rule.id,status:conflict?'conflict':'needs_confirmation',conflicts:conflict?[{}]:[],message:'blocked'}}}return url.endsWith('/rule-snapshots')?head:fresh};
 const checked=await f.checkedDemoPlan(task,'/ai-tasks/t',demo,rule,()=>true);assert.equal(checked.plan.confirmed,true);assert.ok(writes[0].endsWith('/plan-check'));
 for(const patch of [{stale:true},{run_id:'already-ran'},{status:'completed'}]){
  fresh={...task,...patch};writes=[];await assert.rejects(f.checkedDemoPlan(task,'/ai-tasks/t',demo,rule,()=>true));assert.equal(writes.length,0);
 }
 fresh=task;conflict=true;await assert.rejects(f.checkedDemoPlan(task,'/ai-tasks/t',demo,rule,()=>true));
 conflict=false;await assert.rejects(f.checkedDemoPlan(task,'/ai-tasks/t',demo,rule,()=>false));
 head={...head,current_valid:false};await assert.rejects(f.checkedDemoPlan(task,'/ai-tasks/t',demo,rule,()=>true));
 console.log('PASS exact originals/schema/unique recognition; stale and changed rules/targets blocked; real plan-check required; conflicts not confirmed');
}
main().catch(e=>{console.error(e);process.exitCode=1});
