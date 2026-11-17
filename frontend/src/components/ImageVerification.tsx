import { useCallback, useEffect, useState, type PointerEvent } from 'react'
import { api, uploadFile, displayDate, type Asset, type Project } from '../api'
import type { AIConfig, AIPlan, RuleCheck, RuleSnapshot, Retrieval, Citation } from '../aiTypes'
import type { CalculationRun } from '../calculationTypes'
import { RuleSetup, PlanFields, PlanRuleCheck } from './RuleConstraints'
import { RuleRetrievalEvidence } from './RuleRetrievalEvidence'
import { CalculationEvidence } from './CalculationEvidence'
import { RequestError } from './WorkShell'
import { DemoVerificationConfirm } from './DemoRules'
import { checkedDemoPlan, currentDemoRule, demoCitationIds, unifiedDemo, useDemoRuleHead, type UnifiedDemo } from '../unifiedDemo'
import './ImageVerification.css'

type Region={x:number;y:number;width:number;height:number}
type Label={label:string;value:string|null;unit:string|null;category:string|null;metric:string|null;period:string|null;bbox:Region|null;explicit:boolean;uncertainties:string[]}
type ImageTask={id:string;project_id:string;status:string;saved_status:string;stale:boolean;context_hash:string;rule_check:RuleCheck;
 source:{type:'image';asset_id:string;name:string;sha256:string;source_id:string;normalized_sha256:string;width:number;height:number;region:Region};
 payload:{model:{model:string;region:string;provider:string};prompt_version:string;candidates?:Label[];raw_recognition?:unknown;
 selected?:number;target?:Label;selection_hash?:string;recognition_confirmed?:boolean;selection_history?:{original:Label;target:Label;reason:string;at:string}[];
 plan?:AIPlan|null;draft_plan?:AIPlan|null;rule_snapshot?:RuleSnapshot;plan_revisions?:[];retrieval?:Retrieval;citations?:Citation[];
 related_report?:{asset_id:string;name:string;paragraph_index:number;paragraph:{id:string;location:string;text:string}}|null;confirmation?:{applicability_note:string};message?:string};
 result?:{status:string;reported_value:string;calculated_value:string|null;difference_pp:string|null;message:string;comparison_rule:string}|null;
 run?:CalculationRun;run_id:string|null;request_count:number;trace:{event:string;at:string;usage?:unknown;result?:unknown}[];error:string|null;created_at:string}
const full:Region={x:0,y:0,width:1,height:1}
const names:Record<string,string>={extracting:'正在识别图片标签',candidates:'等待选择并确认识别',awaiting_confirmation:'识别已确认 · 等待规则与计算方案',insufficient:'证据不足／需要补充确认',failed:'执行失败',cancelled:'已取消',stale:'资料或规则变化 · 待重新核验',completed:'单条计算已保存',calculating:'正在计算完整工作表'}

function ImagePlan({task,tables,onChange}:{task:ImageTask;tables:Asset[];onChange:(t:ImageTask)=>void}){
 const [plan,setPlan]=useState<AIPlan>(task.payload.draft_plan??(task.payload.rule_snapshot?{...task.payload.rule_snapshot.constraints,context_hash:task.context_hash,confirmed:false}:null)??{asset_id:'',sheet_id:'',operation:'ratio',metric:task.payload.target?.metric??'',scope_description:'',scope:[],numerator:[],null_policy:'block',precision:0,confirmed:false,context_hash:task.context_hash})
 const [checked,setChecked]=useState(''),[meaning,setMeaning]=useState(false),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 function edit(patch:Partial<AIPlan>){setPlan(p=>({...p,...patch,confirmed:false}));setChecked('');setMeaning(false)}
 async function execute(){
  setBusy(true);setError('')
  try{onChange(await api<ImageTask>(`/image-tasks/${task.id}/confirm`,{method:'POST',body:JSON.stringify({selection_hash:task.payload.selection_hash,
   plan:{...plan,confirmed:true},rule_snapshot_id:task.payload.rule_snapshot?.id,citation_ids:task.payload.citations?.map(c=>c.citation_id),meaning_confirmed:meaning,applicability_note:note})}))}
  catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <section className="calc-card image-plan"><h2>确认规则与计算方案</h2><p>图片识别只提供可见标签；下方是用户核对的计算方案，数字由后台完整工作表计算。</p>
  <RuleSetup task={task} tables={tables} onBound={onChange} taskBase="/image-tasks"/>
  <details open={!task.payload.rule_snapshot}><summary>表格、字段、范围与精度</summary><PlanFields plan={plan} tables={tables} edit={edit} disabled={busy}/></details>
  <PlanRuleCheck task={task} tables={tables} plan={plan} taskBase="/image-tasks" onChecked={c=>setChecked(c.conflicts.length||c.status==='stale'?'':JSON.stringify(plan))}/>
  <label className="work-field">对象、类别、期间与单位的核对说明<textarea aria-label="图片适用性核对说明" maxLength={1500} value={note} onChange={e=>{setNote(e.target.value);setMeaning(false)}} placeholder="说明图中类别对应哪个分子条件；期间未显示时明确写明，不能冒充图片已显示。"/></label>
  <label className="calc-confirm"><input type="checkbox" checked={meaning} onChange={e=>setMeaning(e.target.checked)}/><span>已确认当前标签的类别、指标、单位、期间与规则适用范围。只核验选中的一个百分比。</span></label>
  {error&&<RequestError message={error} retry={()=>setError('')}/>}
  <button className="button button-primary" disabled={busy||!meaning||!note.trim()||checked!==JSON.stringify(plan)||!task.payload.rule_snapshot} onClick={()=>void execute()}>{busy?'正在计算完整工作表…':'确认方案，计算所选图片数字'}</button>
 </section>
}

function demoImageTarget(task: ImageTask, demo: UnifiedDemo) {
 const target = task.payload.target
 if (!task.stale && task.source.asset_id === demo.image.id && task.source.sha256 === demo.image.sha256
  && task.payload.recognition_confirmed && task.payload.selection_hash && target?.explicit && target.bbox
  && target.category === '满意' && target.metric === demo.spec.metric && Number(target.value) === 50
  && /50\s*[%％]/.test(target.label) && ['%', '％', 'percent'].includes(target.unit ?? '')
  && (!target.period || target.period.replace(/\s+/g, '') === '不限定期间')) return target
}

function ImageVerificationPlan({ task, assets, onChange }: { task: ImageTask; assets: Asset[]; onChange: (task: ImageTask) => void }) {
 const demo = unifiedDemo(assets)
 const target = demo && demoImageTarget(task, demo)
 const head = useDemoRuleHead(task.project_id, !!target, task.context_hash)
 const snapshot = demo && currentDemoRule(head, demo)
 const manual = <ImagePlan task={task} tables={assets.filter(asset => asset.kind === 'table')} onChange={onChange} />
 if (!demo || !target || !snapshot || !demoCitationIds(snapshot, task.payload.citations).length) return manual

 const note = `已核对图中“满意”类别与分子条件，单位为百分比。${target.period ? '图中标注不限定期间。' : '图中期间留空，演示规则不限定期间。'}`
 return <section className="calc-card image-plan"><DemoVerificationConfirm demo={demo} snapshot={snapshot}
  target={`满意 · ${target.label}`} note={note} onConfirm={async () => {
   const path = `/image-tasks/${task.id}`
   const checked = await checkedDemoPlan(task, path, demo, snapshot, fresh =>
    fresh.payload.selection_hash === task.payload.selection_hash && JSON.stringify(demoImageTarget(fresh, demo)) === JSON.stringify(target))
   onChange(await api<ImageTask>(`${path}/confirm`, { method: 'POST', body: JSON.stringify({
    ...checked, selection_hash: task.payload.selection_hash, meaning_confirmed: true, applicability_note: note,
   }) }))
  }}>{manual}</DemoVerificationConfirm></section>
}

export function ImageVerification({projectId}:{projectId:string}){
 const [assets,setAssets]=useState<Asset[]>([]),[project,setProject]=useState<Project|null>(null),[config,setConfig]=useState<AIConfig|null>(null)
 const [assetId,setAssetId]=useState(''),[region,setRegion]=useState<Region>(full),[task,setTask]=useState<ImageTask|null>(null)
 const [history,setHistory]=useState<{items:ImageTask[];total:number}>({items:[],total:0}),[offset,setOffset]=useState(0)
 const [target,setTarget]=useState<Label|null>(null),[index,setIndex]=useState(0),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false)
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[consent,setConsent]=useState(false),[zoom,setZoom]=useState(false),[tab,setTab]=useState('comparison')
 const [drag,setDrag]=useState<{x:number;y:number}|null>(null),[report,setReport]=useState(''),[paragraph,setParagraph]=useState(''),[paragraphs,setParagraphs]=useState<{id:string;text:string}[]>([])
 const prefix=`/projects/${projectId}`
 const load=useCallback(async()=>{const [a,p,c,h]=await Promise.all([api<Asset[]>(prefix+'/assets'),api<Project>(prefix),api<AIConfig>('/ai/config'),api<typeof history>(prefix+`/image-tasks?offset=${offset}&limit=10`)]);setAssets(a);setProject(p);setConfig(c);setHistory(h)},[prefix,offset])
 const chooseTask=useCallback((t:ImageTask)=>{setTask(t);setHistory(h=>({...h,items:h.items.map(item=>item.id===t.id?t:item)}));setAssetId(t.source.asset_id);setRegion(t.source.region);setTarget(t.payload.target??null);setIndex(t.payload.selected??0);setConfirmed(false);setReason('');const u=new URL(location.href);u.searchParams.set('mode','image');u.searchParams.set('imageTask',t.id);window.history.replaceState(null,'',u);},[])
 useEffect(()=>{void Promise.resolve().then(load).then(async()=>{const id=new URLSearchParams(location.search).get('imageTask');if(id)chooseTask(await api<ImageTask>('/image-tasks/'+id))}).catch(e=>setError(e.message))},[load,chooseTask]) // Load only; paid stages are explicit buttons.
 const taskId=task?.id,taskStatus=task?.status
 useEffect(()=>{if(!taskId||taskStatus!=='extracting')return;let active=true;const timer=setInterval(()=>{void api<ImageTask>('/image-tasks/'+taskId).then(t=>{if(active){setTask(t);if(t.status!=='extracting')void load()}}).catch(e=>{if(active)setError(e.message)})},1000);return()=>{active=false;clearInterval(timer)}},[taskId,taskStatus,load])
 useEffect(()=>{if(!report)return;api<{paragraphs:{id:string;text:string}[]}>(`/assets/${report}/preview?limit=100`).then(x=>setParagraphs(x.paragraphs)).catch(e=>setError(e.message))},[report])
 async function action(fn:()=>Promise<void>){if(busy)return;setBusy(true);setError('');try{await fn()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 function newTask(){setTask(null);setTarget(null);setConfirmed(false);setConsent(false);setRegion(full);setZoom(false);const u=new URL(location.href);u.searchParams.delete('imageTask');window.history.replaceState(null,'',u)}
 const selected=assets.find(a=>a.id===assetId),source=task?.source,shownId=source?.asset_id??assetId
 const box=target?.bbox&&task?{x:task.source.region.x+target.bbox.x*task.source.region.width,y:task.source.region.y+target.bbox.y*task.source.region.height,width:target.bbox.width*task.source.region.width,height:target.bbox.height*task.source.region.height}:region
 const targetDirty=!!task?.payload.target&&(index!==task.payload.selected||JSON.stringify(target)!==JSON.stringify(task.payload.target))
 const editing=!!task&&!task.run_id&&!['extracting','cancelled','stale'].includes(task.status)
 function point(e:PointerEvent<HTMLDivElement>){const r=e.currentTarget.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))}}
 function finish(e:PointerEvent<HTMLDivElement>){if(!drag)return;const p=point(e);setRegion({x:Math.min(drag.x,p.x),y:Math.min(drag.y,p.y),width:Math.max(.01,Math.abs(p.x-drag.x)),height:Math.max(.01,Math.abs(p.y-drag.y))});setDrag(null)}
 return <><div className="materials-heading"><div><h1>图片图表单条百分比核验</h1><p>{project?.name} · 仅读取明确数值标签，未标数值时不按图形大小猜测。</p></div></div>
 <p className="calc-help">识别会把选中图片区域发送至百炼；计算在后台完成。图片核验PDF尚未接通，现有报告文字PDF不受影响。</p>
 {config&&!config.configured&&<p className="calc-warning">真实 AI 尚未接通。{config.configuration_error??`后台缺少：${config.missing.join('、')}`}。请按本机AI_PREVIEW.md检查配置并重启；手动计算仍可使用。</p>}
 {config?.test_mode&&<p className="calc-warning">当前使用离线模拟模型，不代表真实图像识别验收。</p>}
 {error&&<RequestError message={error} retry={()=>void load()}/>}
 <div className="image-verification-grid"><section className="calc-card image-source"><h2>图片与当前目标</h2>
 <label className="work-field">项目图片<select aria-label="项目图片" disabled={!!task} value={assetId} onChange={e=>{setAssetId(e.target.value);setRegion(full)}}><option value="">选择已上传图片</option>{assets.filter(a=>a.kind==='image'&&a.status==='ready').map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></label>
 <label className="button button-secondary image-upload">{busy?'当前操作处理中…':'上传 PNG/JPEG'}<input aria-label="上传核验图片" type="file" accept=".png,.jpg,.jpeg" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void action(async()=>{let a=await uploadFile(projectId,f,()=>{});for(let n=0;n<30&&['uploaded','parsing'].includes(a.status);n++){await new Promise(r=>setTimeout(r,400));a=await api<Asset>('/assets/'+a.id)}if(a.status!=='ready')throw new Error(a.error??'图片尚未解析完成，请在资料页检查或重试');await load();newTask();setAssetId(a.id)})}}/></label>
 {!shownId?<div className="empty-panel"><h3>先上传清晰的图表或统计截图。</h3><p>支持静态PNG/JPEG，最多8 MiB、1200万像素。需要明确可见的百分比数值和类别。</p></div>:<><button className="text-link" onClick={()=>setZoom(v=>!v)}>{zoom?'适合宽度':'放大图片'}</button><div className="image-scroll"><div className={`image-stage ${zoom?'is-zoomed':''}`} onPointerDown={e=>{if(!task){e.currentTarget.setPointerCapture(e.pointerId);setDrag(point(e))}}} onPointerUp={finish}>
 <img src={`/api/assets/${shownId}/image`} alt={source?.name??selected?.name} draggable={false}/><span className="image-target" style={{left:`${box.x*100}%`,top:`${box.y*100}%`,width:`${box.width*100}%`,height:`${box.height*100}%`}}/><span className="sr-only">高亮仅对应当前选中目标，不核验其他数字</span></div></div>
 <p className="calc-help">{source?.width??selected?.summary.width} × {source?.height??selected?.summary.height} · EXIF已转正。框选与坐标均基于转正后的预览。</p><a href={`/api/assets/${shownId}/original`}>下载受保护原件</a> · <a href={`/app/projects/${projectId}/materials?asset=${shownId}`}>定位图片资料 ↗</a><details><summary>图片来源与指纹</summary><code>{source?.source_id??selected?.summary.source_id}</code><code>{source?.sha256??selected?.sha256}</code></details></>}
 {!task&&<><p>可拖动框选识别区域，或填写归一化坐标；全图为0、0、1、1。</p><div className="image-coordinates">{(['x','y','width','height'] as const).map(k=><label key={k}>{k}<input aria-label={`识别区域${k}`} type="number" min="0" max="1" step="0.01" value={region[k]} onChange={e=>setRegion(r=>({...r,[k]:Number(e.target.value)}))}/></label>)}</div><label className="calc-confirm"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>同意将本次选区发送到模型服务。图片内容只作资料，不授予工具权限。</span></label><button className="button button-primary" disabled={busy||!assetId||!consent||!config?.configured} onClick={()=>void action(async()=>chooseTask(await api<ImageTask>(prefix+'/image-tasks',{method:'POST',body:JSON.stringify({asset_id:assetId,region,consent})})))}>识别选区内的可见标签</button></>}
 {task&&<><p className="image-state" role="status">{names[task.status]??task.status}</p><p>{task.run_id?'识别确认和单条数字比较已分别保存；仅核验选中标签。':task.payload.message}</p>{task.error&&<p role="alert">{task.error}</p>}
 <div className="revision-actions"><button className="button button-secondary small" onClick={newTask}>新建识别任务／更换图片与选区</button>{task.status==='extracting'&&<button onClick={()=>void action(async()=>chooseTask(await api<ImageTask>(`/image-tasks/${task.id}/cancel`,{method:'POST'})))}>取消本次任务</button>}{task.status==='failed'&&<button onClick={()=>void action(async()=>chooseTask(await api<ImageTask>(`/image-tasks/${task.id}/retry`,{method:'POST'})))}>重试识别（计入调用上限）</button>}</div>
 {!!task.payload.candidates?.length&&<div className="image-candidates" aria-label="图片识别候选">{task.payload.candidates.map((c,i)=><button key={i} disabled={!editing} aria-pressed={target!==null&&index===i} onClick={()=>{setIndex(i);setTarget(structuredClone(c));setConfirmed(false);setReason('')}}><b>候选 {i+1} · {c.label||'未明确标签'}</b><span>{c.category??'类别未知'} · {c.metric??'指标未知'} · {c.unit??'单位未知'}</span></button>)}</div>}
 {target&&editing&&<form className="image-target-form" onSubmit={e=>{e.preventDefault();void action(async()=>chooseTask(await api<ImageTask>(`/image-tasks/${task.id}/select`,{method:'POST',body:JSON.stringify({index,target,recognition_confirmed:confirmed,correction_reason:reason,report_asset_id:report||null,paragraph_id:paragraph||null})})))}}>
 <h3>核对这一个标签与位置</h3>{(['label','value','unit','category','metric','period'] as const).map((k)=><label className="work-field" key={k}>{{label:'原始标签／人工修正标签',value:'百分数数值',unit:'单位（仅百分比）',category:'类别／对象',metric:'指标',period:'可见期间（未知留空）'}[k]}<input aria-label={`图片目标${k}`} value={target[k]??''} onChange={e=>{setTarget(t=>t&&({...t,[k]:e.target.value||null}));setConfirmed(false)}}/></label>)}
 <p className="calc-help">识别不确定事项：{target.uncertainties.join('；')||'模型未列出，仍须核对原图'}</p>
 <details><summary>校正目标高亮位置（相对本次选区）</summary><div className="image-coordinates">{(['x','y','width','height'] as const).map(k=><label key={k}>{k}<input aria-label={`目标位置${k}`} type="number" step="0.01" min="0" max="1" value={target.bbox?.[k]??''} onChange={e=>{setTarget(t=>t&&({...t,bbox:{...(t.bbox??full),[k]:Number(e.target.value)}}));setConfirmed(false)}}/></label>)}</div></details>
 <label className="calc-confirm"><input type="checkbox" checked={target.explicit} onChange={e=>{setTarget(t=>t&&({...t,explicit:e.target.checked}));setConfirmed(false)}}/><span>图中确有可读数值标签；无标签或模糊时请停止，不能按几何大小估计。</span></label>
 <label className="work-field">人工修改原因<textarea aria-label="图片识别修改原因" value={reason} maxLength={1500} onChange={e=>setReason(e.target.value)}/></label>
 <details><summary>可选：关联已有报告原句</summary><p className="calc-help">此处列出报告前100个段落；图片也可不关联报告，独立核验。</p><select aria-label="关联图片报告" value={report} onChange={e=>{setReport(e.target.value);setParagraph('');setParagraphs([])}}><option value="">不关联报告，图片可独立核验</option>{assets.filter(a=>a.kind==='report').map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><select aria-label="关联图片报告段落" value={paragraph} onChange={e=>setParagraph(e.target.value)}><option value="">选择实际段落</option>{paragraphs.map(p=><option value={p.id} key={p.id}>{p.text}</option>)}</select></details>
 <label className="calc-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>我已对照原图确认当前标签、类别、单位、期间及高亮位置。识别确认不等于数字核验通过。</span></label>
 <button className="button button-primary" disabled={busy||!confirmed}>保存识别确认并查找规则</button></form>}
 {task.payload.related_report&&<details><summary>已关联的真实报告原句（可选来源）</summary><blockquote>{task.payload.related_report.paragraph.text}</blockquote><a href={`/app/projects/${projectId}/materials?asset=${task.payload.related_report.asset_id}&paragraph=${encodeURIComponent(task.payload.related_report.paragraph.id)}&offset=${Math.floor(task.payload.related_report.paragraph_index/50)*50}`}>{task.payload.related_report.name} · {task.payload.related_report.paragraph.location} ↗</a></details>}<details><summary>模型原始识别与人工修改记录</summary><p>{config?.model} · {config?.region} · 模型调用尝试 {task.request_count}/6</p><pre>{JSON.stringify(task.payload.raw_recognition,null,2)}</pre><pre>{JSON.stringify(task.payload.selection_history,null,2)}</pre><p>原始模型识别不会被人工修正覆盖；人工修正后的成功不计为模型原始识别正确。</p></details></>}
 </section><div className="image-work-right">{targetDirty&&<p className="calc-warning">识别内容或所选类别已修改，当前为未保存草稿。请重新保存识别确认，再检查计算方案；旧确认不能用于此草稿。</p>}{!targetDirty&&task?.payload.target&&!task.run_id&&(task.status==='awaiting_confirmation'||task.stale&&task.saved_status==='awaiting_confirmation')&&<ImageVerificationPlan key={task.id+task.payload.rule_snapshot?.id+task.payload.selection_hash} task={task} assets={assets} onChange={chooseTask}/>}
 <section className="calc-card image-result"><h2>单条结果与证据</h2><p>图片识别：{targetDirty?'修改后待重新确认':task?.payload.recognition_confirmed?'已由用户确认':'尚未确认'} · 数字核验：{task?.stale?'依据已变化，待重新核验':task?.result?.status==='consistent'?'所选单条与数据一致':task?.result?.status==='different'?'存在差异':'尚未完成'}</p>
 <div className="ai-tabs" role="tablist">{[['comparison','比较结果'],['rows','原始数据'],['rules','规则原文']].map(([v,n])=><button role="tab" aria-selected={tab===v} key={v} onClick={()=>setTab(v)}>{n}</button>)}</div>
 {tab==='comparison'&&(task?.result&&task.run?<><p className="image-number">图片标注 <b>{task.result.reported_value}%</b></p><p>{task.stale?'按生成时确认规则计算':'按当前确认规则计算'} <strong>{task.result.calculated_value===null?'无可用值':task.result.calculated_value+'%'}</strong></p><p>{task.result.difference_pp===null?task.result.message:Number(task.result.difference_pp)<0?`图片值比计算值高${Math.abs(Number(task.result.difference_pp))}个百分点`:Number(task.result.difference_pp)>0?`图片值比计算值低${task.result.difference_pp}个百分点`:'所选单条百分比与数据一致'}</p><p className="ai-formula">{task.run.result.numerator} ÷ {task.run.result.denominator} × 100% = {task.run.result.display_value===null?'无有效值':task.run.result.display_value+'%'}</p><p>完整工作表{task.run.result.total}条记录／行；仅核验当前选中标签，不代表整张图或报告通过。</p><p>{task.result.comparison_rule}</p>{task.stale&&<p className="calc-warning">上方为生成时保存结果，当前依据已变，请新建任务重新确认；历史没有重算或覆盖。</p>}<details><summary>确认说明与精确值</summary><p>{task.payload.confirmation?.applicability_note}</p><p>未舍入值：{task.run.result.unrounded_decimal}</p><pre>{JSON.stringify(task.run.spec,null,2)}</pre></details></>:<div className="empty-panel"><h3>还没有可用的数字核验结果。</h3><p>先确认明确标签，再核对规则与计算方案。没有标签或依据时显示待确认／证据不足。</p></div>)}
 {tab==='rows'&&(task?.run?<CalculationEvidence run={task.run}/>:<p>尚未计算，没有原始行证据。</p>)}
 {tab==='rules'&&<RuleRetrievalEvidence projectId={projectId} citations={task?.payload.citations??[]} retrieval={task?.payload.retrieval}/>}
 </section><section className="calc-card"><h2>图片核验历史</h2><p>真实保存的图片任务，回看不调用模型、不重新计算。图片结果PDF尚未接通。</p>{history.items.map(t=><button className="image-history-item" key={t.id} onClick={()=>chooseTask(t)}><b>{t.source.name} · {t.payload.target?.label??'尚未确认目标'}</b><span>{names[t.status]} · {displayDate(t.created_at)}</span></button>)}<div className="calc-pagination"><span>共{history.total}条</span><button disabled={!offset} onClick={()=>setOffset(x=>x-10)}>上一页</button><button disabled={offset+10>=history.total} onClick={()=>setOffset(x=>x+10)}>下一页</button></div>{task&&<details><summary>实际调用与保存信息</summary><p>{task.payload.model.model} · {task.payload.prompt_version} · {task.request_count}次</p><code>{task.id}</code><pre>{JSON.stringify(task.trace,null,2)}</pre></details>}</section></div></div></>
}
