import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Asset } from '../api'
import type { RuleSnapshot } from '../aiTypes'
import { RequestError } from './WorkShell'

// Uses the existing project-scoped rule roles and immutable snapshots.
export function RuleLibrary({ projectId, assets }: { projectId: string; assets: Asset[] }) {
  const [data, setData] = useState<{ roles: string[]; snapshots: RuleSnapshot[]; currentId: string | null } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    let active = true
    Promise.all([api<string[]>(`/projects/${projectId}/rule-materials`), api<{ items: RuleSnapshot[]; current_id: string | null }>(`/projects/${projectId}/rule-snapshots`)]).then(([roles, head]) => {
      if (active) { setData({ roles, snapshots: head.items, currentId: head.current_id }); setError('') }
    }).catch(cause => { if (active) setError((cause as Error).message) })
    return () => { active = false }
  }, [projectId, attempt])
  async function toggle(assetId: string, enabled: boolean) {
    if (!data || busy) return
    setBusy(true); setSaved(false)
    try {
      await api(`/projects/${projectId}/rule-materials/${assetId}`, { method: 'PUT', body: JSON.stringify({ enabled }) })
      setData(current => current ? { ...current, roles: enabled ? [...current.roles, assetId] : current.roles.filter(id => id !== assetId) } : null)
      setSaved(true); setError(''); setAttempt(value => value + 1)
    } catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }
  const reports = assets.filter(asset => asset.kind === 'report' && asset.status === 'ready')
  const snapshot = data?.snapshots.find(item => item.id === data.currentId)
  return <section className="rule-library"><div className="inspector-heading"><h2>统计规则与依据库</h2><span>{data ? `${data.roles.length} 份` : '读取中'}</span></div><p className="inspector-description">指定可检索的 DOCX／保存文本。依据来自本项目真实段落；勾选资料不会自动确认其中的统计口径。</p>
    {error && <RequestError message={error} retry={() => setAttempt(value => value + 1)} />}
    {!reports.length && <p className="inspector-description">上传规则 DOCX，或使用“粘贴报告”保存规则文本，再将它指定为规则资料。</p>}
    {reports.map(asset => <label className="library-material" key={asset.id}><input type="checkbox" disabled={!data || busy} checked={data?.roles.includes(asset.id) ?? false} onChange={event => void toggle(asset.id, event.target.checked)} /><span>{asset.name}<small>设为统计规则资料</small></span></label>)}
    {saved && <p className="save-status" role="status">规则资料指定已保存。已有运行会按当前资料变化情况提示待复核。</p>}
    <details><summary>已保存的结构化约束</summary><p className="inspector-description">{snapshot ? `当前规则快照 v${snapshot.version}：${snapshot.change_reason}` : data ? '尚无当前规则快照。' : '正在读取规则快照…'}</p><p className="inspector-description">逐项规则确认和冲突对照复用结论核验中的现有流程；历史快照不会被覆盖。</p></details>
    <a className="text-link" href={`/app/projects/${projectId}/verify`}>前往规则确认与结论核验 ↗</a>
  </section>
}
