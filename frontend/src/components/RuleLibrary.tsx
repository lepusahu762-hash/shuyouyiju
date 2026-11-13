import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Asset } from '../api'
import type { RuleSnapshot, Retrieval } from '../aiTypes'
import { RuleRetrievalEvidence } from './RuleRetrievalEvidence'
import { RequestError } from './WorkShell'

// Uses the existing project-scoped rule roles and immutable snapshots.
export function RuleLibrary({ projectId, assets, onConfirm, onRolesChanged }: { projectId: string; assets: Asset[]; onConfirm:()=>void; onRolesChanged:()=>Promise<void> }) {
  const [data, setData] = useState<{ roles: string[]; snapshots: RuleSnapshot[]; currentId: string | null; valid:boolean } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [query,setQuery]=useState('')
  const [retrieval,setRetrieval]=useState<Retrieval|null>(null)
  const [searching,setSearching]=useState(false)
  async function search(){
    if(!query.trim()||searching)return
    setSearching(true);setError('');setRetrieval(null)
    try{setRetrieval(await api<Retrieval>(`/projects/${projectId}/rule-search?q=${encodeURIComponent(query.trim())}`))}
    catch(cause){setError((cause as Error).message)}finally{setSearching(false)}
  }
  useEffect(() => {
    let active = true
    Promise.all([api<string[]>(`/projects/${projectId}/rule-materials`), api<{ items: RuleSnapshot[]; current_id: string | null;current_valid:boolean }>(`/projects/${projectId}/rule-snapshots`)]).then(([roles, head]) => {
      if (active) { setData({ roles, snapshots: head.items, currentId: head.current_id,valid:head.current_valid }); setError('') }
    }).catch(cause => { if (active) setError((cause as Error).message) })
    return () => { active = false }
  }, [projectId, attempt])
  async function toggle(assetId: string, enabled: boolean) {
    if (!data || busy) return
    setBusy(true); setSaved(false)
    try {
      await api(`/projects/${projectId}/rule-materials/${assetId}`, { method: 'PUT', body: JSON.stringify({ enabled }) })
      await onRolesChanged()
      setData(current => current ? { ...current, roles: enabled ? [...current.roles, assetId] : current.roles.filter(id => id !== assetId) } : null)
      setSaved(true); setError(''); setAttempt(value => value + 1)
    } catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }
  const reports = assets.filter(asset => asset.kind === 'report' && asset.status === 'ready')
  const snapshot = data?.snapshots.find(item => item.id === data.currentId)
  return <section className="rule-library"><div className="inspector-heading"><h2>统计规则与依据库</h2><span>{data ? `${data.roles.length} 份` : '读取中'}</span></div><p className="inspector-description">指定可检索的 DOCX／保存文本。依据来自本项目真实段落；勾选资料不会自动确认其中的统计口径。</p>
    {error && <RequestError message={error} retry={() => setAttempt(value => value + 1)} />}
    {!reports.length && <p className="inspector-description">上传规则 DOCX，或使用“补充规则说明”保存规则文本，再将它指定为规则资料。</p>}
    {reports.map(asset => <label className="library-material" key={asset.id}><input type="checkbox" disabled={!data || busy} checked={data?.roles.includes(asset.id) ?? false} onChange={event => void toggle(asset.id, event.target.checked)} /><span>{asset.name}<small>设为统计规则资料</small></span></label>)}
    <p className="inspector-description">已指定规则资料：{data?.roles.length??0}份；已确认结构化规则：{data?.valid?`当前v${snapshot?.version}`:snapshot?'依据变化，需重新确认':'尚未确认'}。</p>
    {saved && <p className="save-status" role="status">规则资料指定已保存。已有运行会按当前资料变化情况提示待复核。</p>}
    <form className="rule-library-search" onSubmit={e=>{e.preventDefault();void search()}}><label>检索已指定规则<input aria-label="检索已指定规则" value={query} maxLength={200} placeholder="输入指标、期间或口径问题" onChange={e=>setQuery(e.target.value)}/></label><button className="button button-secondary small" disabled={searching||!query.trim()}>{searching?'检索中…':'查找规则原文'}</button></form>
    {retrieval&&<RuleRetrievalEvidence projectId={projectId} citations={retrieval.items} retrieval={retrieval}/>}
    <details><summary>已保存的结构化约束</summary><p className="inspector-description">{snapshot ? `当前规则快照 v${snapshot.version}：${snapshot.change_reason}` : data ? '尚无当前规则快照。' : '正在读取规则快照…'}</p><p className="inspector-description">{data?.valid?'当前结构化规则依据有效。':'尚无有效已确认快照，或依据已变化。'} 历史快照不会被覆盖。</p></details>
    <button className="button button-primary small" onClick={onConfirm}>确认统计规则</button>
  </section>
}
