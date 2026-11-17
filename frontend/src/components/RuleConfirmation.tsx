import {useEffect,useState} from 'react'
import {api,type Asset,type Preview} from '../api'
import type {AIPlan,Citation,RuleSnapshot} from '../aiTypes'
import {RuleSnapshotEditor} from './RuleConstraints'
import {RequestError} from './WorkShell'
import './RuleConfirmation.css'

// Independent project editor: actual rule paragraphs, no verification task or AI call.
export function RuleConfirmation({projectId,assets,onClose,onSaved}:{projectId:string;assets:Asset[];onClose:()=>void;onSaved:()=>void}){
 const [roles,setRoles]=useState<string[]>([]),[material,setMaterial]=useState(''),[offset,setOffset]=useState(0),[citations,setCitations]=useState<Citation[]>([])
 const [total,setTotal]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[saved,setSaved]=useState<RuleSnapshot|null>(null)
 const [head,setHead]=useState<{items:RuleSnapshot[];current_id:string|null;current_valid:boolean;context_hash:string}|null>(null)
 useEffect(()=>{let active=true;Promise.all([api<string[]>(`/projects/${projectId}/rule-materials`),api<NonNullable<typeof head>>(`/projects/${projectId}/rule-snapshots`)]).then(([r,h])=>{if(active){setRoles(r);setHead(h);setLoading(false)}}).catch(e=>{if(active){setError(e.message);setLoading(false)}});return()=>{active=false}},[projectId,attempt])
 const reports=assets.filter(a=>roles.includes(a.id)&&a.kind==='report'&&a.status==='ready'),tables=assets.filter(a=>a.kind==='table'&&a.status==='ready')
 const chosen=reports.find(a=>a.id===material)??reports[0]
 useEffect(()=>{if(!chosen)return;let active=true;api<Preview>(`/assets/${chosen.id}/preview?offset=${offset}&limit=50`).then(p=>{if(active){setTotal(p.total);setCitations(old=>Object.values({...Object.fromEntries(old.map(c=>[c.citation_id,c])),...Object.fromEntries((p.paragraphs??[]).map((v,i)=>{const c:Citation={citation_id:v.id,asset_id:chosen.id,name:chosen.name,sha256:chosen.sha256,version:String(chosen.source_version),location:v.location,paragraph_index:offset+i,text:v.text,truncated:false,score:0};return [c.citation_id,c]}))}));setError('')}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[chosen,offset])
 const current=head?.items.find(s=>s.id===head.current_id)
 const initial:AIPlan={...(current?.constraints??{asset_id:'',sheet_id:'',operation:'ratio',metric:'',scope_description:'',scope:[],numerator:[],null_policy:'block',precision:0}),confirmed:false,context_hash:head?.context_hash??''}
 return <section className="standalone-rule" aria-labelledby="standalone-rule-title"><div className="calc-card-heading"><div><p className="calc-step">项目规则 · 独立确认</p><h2 id="standalone-rule-title">确认统计规则</h2></div><button className="button button-secondary small" onClick={onClose}>收起规则编辑</button></div>
 <p>只需表格与规则说明，不需要待核验报告、图片或AI任务。逐项核对真实原文后，保存同一套不可覆盖的规则快照，供分析与核验共同引用。</p>
 <p className="calc-help">指定规则资料只决定可用来源；保存项目统计说明只是文字备注；只有下面全部约束和原文逐项确认并成功保存，才是已确认结构化规则。</p>
 {error&&<RequestError message={error} retry={()=>setAttempt(n=>n+1)}/>}
 {loading?<p>正在读取当前规则版本…</p>:!tables.length?<p className="calc-warning">缺少解析成功的表格，请先上传CSV或XLSX。</p>:!reports.length?<p className="calc-warning">请先保存规则文本或上传规则DOCX，并在“统计规则与依据库”勾选为规则资料。</p>:<>
 {current&&<p className={head?.current_valid?'calc-help':'calc-warning'}>当前快照v{current.version}：{head?.current_valid?'依据有效，可直接进入分析。':'资料或规则已变化；原版本保留，需重新核对保存新快照。'}</p>}
 <label className="work-field">供本次确认使用的规则资料<select aria-label="规则来源资料" value={chosen?.id??''} onChange={e=>{setMaterial(e.target.value);setOffset(0)}}>{reports.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
 <p className="calc-help">原文按50段分页。各约束可选择不同段落；分页与切换资料不会替换已经选择的来源。</p><div className="calc-pagination"><span>来源段落 {total?offset+1:0}–{Math.min(offset+50,total)} / {total}</span><button disabled={!offset} onClick={()=>setOffset(n=>n-50)}>前50段</button><button disabled={offset+50>=total} onClick={()=>setOffset(n=>n+50)}>后50段</button></div>
 {head&&<RuleSnapshotEditor key={head.context_hash} projectId={projectId} tables={tables} initial={initial} citations={citations} hasBound={!!current} stale={!head.current_valid} onSaved={async s=>{setSaved(s);onSaved();setHead(await api(`/projects/${projectId}/rule-snapshots`))}}/>}
 </>}
 {saved&&<p className="save-status" role="status">已保存已确认结构化规则 v{saved.version}。旧快照保留；后续统计需使用当前有效快照。</p>}
 {(saved||head?.current_valid)&&<a className="button button-primary" href={`/app/projects/${projectId}/analysis`}>进入数据分析</a>}
 <details><summary>规则版本与技术信息</summary>{head?.items.map(s=><p key={s.id}>v{s.version} · {s.created_at} · {s.change_reason}<br/><code>{s.id}</code></p>)}</details>
 </section>
}

