import { useEffect, useState } from 'react'
import { api } from '../../api'
import type { AnalysisGroup, GroupRun } from '../../analysisTypes'

export function AnalysisChart({run,selected,onSelect}:{run:GroupRun;selected:string;onSelect:(key:string)=>void}){
 const [offset,setOffset]=useState(0),[order,setOrder]=useState('source'),[data,setData]=useState<{items:AnalysisGroup[];total:number}|null>(null),[error,setError]=useState('')
 useEffect(()=>{let active=true;api<{items:AnalysisGroup[];total:number}>(`/runs/${run.id}/groups?offset=${offset}&limit=20&order=${order}`).then(d=>{if(active){setData(d);setError('')}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[run.id,offset,order])
 const comparable=run.result.status==='completed'
 const ratio=run.spec.operation==='ratio',unit=ratio?'%':'条',max=ratio?100:Math.max(1,...(data?.items??[]).map(g=>Number(g.result.display_value??0)))
 return <section className="calc-card analysis-chart"><div className="calc-card-heading"><h2>分组结果与图表</h2><button className="text-link" onClick={()=>onSelect('')}>返回全部</button></div>
 {!comparable&&<p className="calc-warning" role="status">执行已结束，整体统计尚不可比较。图表与计数仅供诊断，不显示正式百分比、不进行最高最低或并列排名。</p>}
 <p>{comparable?'总体':'诊断计数'} <strong>{run.result.display_value??'无有效值'}{run.result.display_value!==null?unit:''}</strong> · 分子{run.result.numerator}／分母{run.result.denominator} · 排除{run.result.excluded}／总计{run.result.total}条</p><p className="calc-help">{run.result.aggregation_note} {run.result.extrema?.rule}</p>
 <label className="work-field">展示排序<select aria-label="分组排序" value={order} disabled={!comparable} onChange={e=>{setOrder(e.target.value);setOffset(0)}}><option value="source">来源出现顺序</option><option value="ascending">数值从低到高</option><option value="descending">数值从高到低</option></select></label>
 {error&&<p role="alert">{error}</p>}{!data?<p>正在读取保存的分组…</p>:<><p className="calc-help">共{data.total}组；本页图表与数据表展示第{data.total?offset+1:0}–{Math.min(offset+20,data.total)}组，最多20组，不代表只有这些组。零分母／待确认组不参与排名。</p>
 <div className="analysis-chart-scroll"><div className="analysis-bars" aria-label="单字段分组柱状图">{data.items.map(g=><button aria-label={`选择分组 ${g.label}（${g.type}）`} aria-pressed={selected===g.key} className="analysis-bar" key={g.key} onClick={()=>onSelect(g.key)}><span className="analysis-bar-label">{g.label}<small>{g.type}</small></span><span className="analysis-bar-track"><i style={{width:comparable&&g.result.display_value!==null?`${Math.max(0,Math.min(100,Number(g.result.display_value)/max*100))}%`:'0%'}}/></span><b>{comparable?(g.result.display_value??'无有效值'):'暂停·诊断'}{comparable&&g.result.display_value!==null?unit:''}</b><small>n={g.result.denominator}</small></button>)}</div></div>
 <div className="calc-table-scroll"><table className="calc-data-table"><caption>与图表相同的保存结果 · 单位记录／行</caption><thead><tr><th>类别及类型</th><th>分子</th><th>分母</th><th>结果</th><th>排除</th></tr></thead><tbody>{data.items.map(g=><tr key={g.key} className={selected===g.key?'focused-evidence-row':''}><th><button aria-label={`表格选择 ${g.label}（${g.type}）`} onClick={()=>onSelect(g.key)}>{g.label}（{g.type}）</button></th><td>{g.result.numerator}</td><td>{g.result.denominator}</td><td>{comparable?(g.result.display_value??g.result.message):'整体暂停，仅供诊断'}{comparable&&g.result.display_value!==null?unit:''}</td><td>{g.result.excluded}</td></tr>)}</tbody></table></div>
 <div className="calc-pagination"><button disabled={!offset} onClick={()=>setOffset(v=>v-20)}>前20组</button><button disabled={offset+20>=data.total} onClick={()=>setOffset(v=>v+20)}>后20组</button></div></>}
 </section>
}
