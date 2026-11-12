import {useEffect,useState} from 'react'
import {api} from '../../api'
import type {AnalysisGroup,GroupRun} from '../../analysisTypes'
import {AnalysisChart} from './AnalysisChart'
import {CalculationEvidence} from '../CalculationEvidence'

// Shared project history opens the same immutable grouped run and evidence.
export function AnalysisSavedGroups({run}:{run:GroupRun}){
 const [selected,setSelected]=useState(''),[group,setGroup]=useState<AnalysisGroup|null>(null),[error,setError]=useState('')
 useEffect(()=>{if(!selected)return;let active=true;api<{items:AnalysisGroup[]}>(`/runs/${run.id}/groups?category=${selected}`).then(d=>{if(active){setGroup(d.items[0]??null);setError('')}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[run.id,selected])
 const chosen=group?.key===selected?group:null
 return <><AnalysisChart run={run} selected={selected} onSelect={setSelected}/><section className="calc-card analysis-evidence"><h2>{chosen?`已选 ${chosen.label}（${chosen.type}）`:'保存的原始行证据'}</h2>{error&&<p role="alert">{error}</p>}{!selected||chosen?<CalculationEvidence key={`${run.id}-${selected}`} run={run} category={selected||undefined} summary={chosen?.result}/>:<p>正在读取所选组…</p>}</section></>
}
