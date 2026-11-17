import { useState } from 'react'
import type { AnalysisTurn, AnalysisPlan as Plan } from '../../analysisTypes'
import type { Asset, Column } from '../../api'
import { conditionText, nullPolicyLabel } from '../../calculationTypes'
import { demoQuestion } from '../../unifiedDemo'
import { CalculationConditions } from '../CalculationConditions'

export function AnalysisPlan({turn,assets,onConfirm,busy,demoGroup}:{turn:AnalysisTurn;assets:Asset[];onConfirm:(plan:Plan,reason:string)=>void;busy:boolean;demoGroup?:Column}){
 const proposed=turn.payload.original_proposal!.plan!
 const [plan,setPlan]=useState<Plan>(proposed),[confirmed,setConfirmed]=useState(false),[reason,setReason]=useState('')
 const rule=turn.payload.rule_snapshot!,base=rule.constraints,table=assets.find(a=>a.id===base.asset_id),sheet=table?.summary.sheets?.find(s=>s.id===base.sheet_id)
 const changed=JSON.stringify(plan)!==JSON.stringify(proposed)
 const quick=demoGroup&&turn.question===demoQuestion&&!turn.stale&&!turn.payload.original_proposal?.questions.length
  &&proposed.operation==='ratio'&&proposed.metric===base.metric&&proposed.group_by===demoGroup.id&&proposed.group_null_policy==='keep'&&!proposed.exploration.length
 function edit(patch:Partial<Plan>){setPlan(p=>({...p,...patch}));setConfirmed(false)}
 const [manual,setManual]=useState(false)
 return <section className="calc-card analysis-plan"><p className="calc-step">02 · 等待人工确认</p><h2>核对这次统计方案</h2><p>{turn.payload.original_proposal?.message}</p>
 <dl className="analysis-basis"><div><dt>采用规则</dt><dd>{base.metric} · 快照v{rule.version}</dd></div><div><dt>数据来源</dt><dd>{table?.name} / {sheet?.name}</dd></div><div><dt>强制范围</dt><dd>{base.scope_description}<br/>{conditionText(base.scope,sheet?.columns??[])}</dd></div><div><dt>已确认分子</dt><dd>{conditionText(base.numerator,sheet?.columns??[])}</dd></div><div><dt>基础空值／精度</dt><dd>{nullPolicyLabel[base.null_policy]}；{base.precision}位小数</dd></div></dl>
 <p className="calc-help">项目规则保持不变。探索筛选只与强制范围取交集，无法扩大范围；组内比例用该组分子÷该组分母。范围计数仍按基础规则涉及的字段检查空值，不会因移除分子条件而放宽空值排除。</p>
 {!!turn.payload.original_proposal?.questions.length&&<div className="calc-warning"><b>请明确确认</b>{turn.payload.original_proposal.questions.map((q,i)=><p key={i}>{q}</p>)}</div>}
 {quick&&!manual&&<><p>按「{demoGroup.name}」分组统计满意记录占比，保留空值组。</p><button className="button button-primary" disabled={busy} onClick={()=>onConfirm(proposed,'已核对演示指标、范围、所属学院分组及空值策略。')}>{busy?'正在执行后台计算…':'确认方案并计算'}</button> <button className="button button-secondary small" disabled={busy} onClick={()=>setManual(true)}>手动核对或调整方案</button></>}
 {(!quick||manual)&&<fieldset disabled={busy}><label className="work-field">统计方式<select aria-label="分析统计方式" value={plan.operation} onChange={e=>edit({operation:e.target.value as Plan['operation']})}><option value="ratio">规则指标记录占比</option><option value="count">范围内记录数（全部计数）</option></select></label>
 <label className="work-field">按一个字段分组<select aria-label="分析分组字段" value={plan.group_by??''} onChange={e=>edit({group_by:e.target.value||null,group_null_policy:e.target.value?'keep':null})}><option value="">不分组：当前范围总体</option>{sheet?.columns.map(c=><option key={c.id} value={c.id}>{c.letter} · {c.label}</option>)}</select></label>
 {plan.group_by&&<label className="work-field">分组字段空值策略<select aria-label="分组字段空值策略" value={plan.group_null_policy??''} onChange={e=>edit({group_null_policy:e.target.value as Plan['group_null_policy']})}><option value="">请明确选择</option><option value="keep">保留为独立空值组</option><option value="exclude">排除分组空值记录（影响总体范围）</option><option value="block">遇到分组空值暂停产出数值</option></select></label>}
 <details><summary>追加探索筛选（等值／并且）</summary><CalculationConditions title="探索" help="继承的条件不能悄悄移除；新增条件改变本次统计范围，需重新确认。" columns={sheet?.columns??[]} items={plan.exploration} disabled={busy||!sheet} onChange={exploration=>edit({exploration})}/></details>
 <label className="work-field">人工修改说明{changed?'（必填）':'（选填）'}<textarea aria-label="分析方案修改说明" maxLength={1500} value={reason} onChange={e=>setReason(e.target.value)}/></label>
 <label className="calc-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>已核对指标、对象、范围、分组、空值和精度。按记录／行计算，不去重；仅描述这些记录。</span></label>
 <button className="button button-primary" disabled={busy||!confirmed||changed&&!reason.trim()||!!plan.group_by&&!plan.group_null_policy} onClick={()=>onConfirm(plan,reason)}>{busy?'正在执行后台计算…':'确认方案并计算'}</button></fieldset>}
 <details><summary>模型原始方案（不会被人工修改覆盖）</summary><pre>{JSON.stringify(proposed,null,2)}</pre></details>
 </section>
}
