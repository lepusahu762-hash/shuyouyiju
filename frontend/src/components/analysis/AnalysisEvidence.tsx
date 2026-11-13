import { useEffect,useState } from 'react'
import { api } from '../../api'
import type { AnalysisTurn,AnalysisGroup } from '../../analysisTypes'
import { CalculationEvidence } from '../CalculationEvidence'
import { RuleRetrievalEvidence } from '../RuleRetrievalEvidence'
import { conditionText,nullPolicyLabel } from '../../calculationTypes'

export function AnalysisEvidence({turn,projectId,selected}:{turn:AnalysisTurn;projectId:string;selected:string}){
 const [tab,setTab]=useState('records'),[group,setGroup]=useState<{key:string;item:AnalysisGroup}|null>(null),[error,setError]=useState('')
 const run=turn.run
 useEffect(()=>{if(!run||!selected)return;let active=true;api<{items:AnalysisGroup[]}>(`/runs/${run.id}/groups?category=${selected}`).then(x=>{if(active&&x.items[0])setGroup({key:selected,item:x.items[0]})}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[run?.id,selected,run])
 const chosen=group?.key===selected?group.item:null,rule=turn.payload.rule_snapshot
 return <section className="calc-card analysis-evidence"><h2>规则、计算与来源</h2>{error&&<p role="alert">{error}</p>}
 {run&&<><p>{chosen?`已选 ${chosen.label}（${chosen.type}）：分子${chosen.result.numerator}／分母${chosen.result.denominator}`:'当前查看全部范围记录'} · 原始行按保存快照分页读取。</p><p className="calc-help">{run.source.name} / {run.source.sheet_name}</p><details><summary>数据来源标识</summary><code>{run.source.source_id}</code></details></>}
 <div className="ai-tabs" role="tablist">{[['records','原始记录'],['rules','规则来源'],['method','计算说明']].map(([v,n])=><button key={v} role="tab" aria-selected={tab===v} onClick={()=>setTab(v)}>{n}</button>)}</div>
 {tab==='records'&&(run&&(!selected||chosen)?<CalculationEvidence summary={chosen?.result} key={`${run.id}-${selected}`} run={run} category={selected||undefined}/>:<p>{run?'正在读取所选组的统计摘要…':'确认方案并计算后生成真实行证据。'}</p>)}
 {tab==='rules'&&<><RuleRetrievalEvidence projectId={projectId} citations={turn.payload.citations??[]} retrieval={turn.payload.retrieval}/>{rule&&<details><summary>实际采用的不可变规则快照 v{rule.version}</summary><code>{rule.id}</code>{Object.entries(rule.sources).map(([k,s])=><blockquote key={k}>{s.name} · {s.location}<p>{s.quote}</p><a href={`/app/projects/${projectId}/materials?asset=${s.asset_id}&paragraph=${encodeURIComponent(s.paragraph_id)}&offset=${Math.floor(s.paragraph_index/50)*50}`}>定位规则原文 ↗</a></blockquote>)}</details>}</>}
 {tab==='method'&&<>{run?<><p>统计范围：{run.spec.scope_description}</p><p>{conditionText(run.spec.scope,run.source.columns)}</p><p>分子：{conditionText(run.spec.numerator,run.source.columns)}</p><p>{nullPolicyLabel[run.spec.null_policy]}；精度{run.spec.precision}位。分子只能来自分母。总体不平均组百分比。</p><p>空值检查字段：{(run.spec.null_fields??[...run.spec.scope,...run.spec.numerator].map(c=>c.column_id)).map(id=>run.source.columns.find(c=>c.id===id)?.label??id).join('、')||'无条件字段'}。分组字段的空值策略独立确认。</p>{chosen&&<p>所选组计算：{chosen.result.numerator} ÷ {chosen.result.denominator}；未舍入值{chosen.result.unrounded_decimal??'未产生有效值'}；排除{chosen.result.excluded}条。</p>}<p>未舍入总体值：{run.result.unrounded_decimal??'未产生'}，以保存精确分数为准。{run.result.message}</p><p>分组空值记录：{run.result.group_null_rows??'不适用'}；分组空值排除：{run.result.group_null_excluded??'不适用'}。</p><details><summary>原始模型、人工确认和计算参数</summary><pre>{JSON.stringify({original:turn.payload.original_proposal,confirmation:turn.payload.confirmation,inherited:turn.payload.inherited_plan,spec:run.spec},null,2)}</pre></details></>:<p>尚未执行计算。</p>}<details><summary>实际调用用量及受控工具记录</summary><p>{turn.payload.model.model} · {turn.request_count}/6次模型请求</p><pre>{JSON.stringify(turn.trace,null,2)}</pre></details></>}
 </section>
}
