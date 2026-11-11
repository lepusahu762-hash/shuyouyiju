import { useEffect, useState } from 'react'
import { api, emptyRules } from '../api'
import type { Asset, FieldMeaning, Project, Rules, Sheet } from '../api'
import { Icon } from './ui'
import { RequestError } from './WorkShell'

function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    function warn(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = '' }
    if (dirty) window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
}

export function RulesEditor({ project }: { project: Project }) {
  const [rules, setRules] = useState<Rules>({ ...emptyRules, ...project.rules })
  const [version, setVersion] = useState(project.rules_version)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  useUnsavedWarning(dirty)
  function change(key: keyof Rules, value: string) { setRules(current => ({ ...current, [key]: value })); setDirty(true); setSaved(false); setError('') }
  async function save() {
    setBusy(true); setError('')
    try {
      const result = await api<{ rules: Rules; rules_version: number }>(`/projects/${project.id}/rules`, { method: 'PUT', body: JSON.stringify({ version, rules }) })
      setVersion(result.rules_version); setDirty(false); setSaved(true)
    } catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }
  return <section className="rules-editor"><div className="inspector-heading"><h2>项目统计口径</h2><span>{dirty ? '未保存' : `v${version}`}</span></div><p className="inspector-description">由你明确范围与定义，供后续分析和核验使用。</p><label className="work-field">对象范围<input value={rules.scope} maxLength={1000} placeholder="例如：全校有效答题问卷" disabled={busy} onChange={event => change('scope', event.target.value)} /></label><label className="work-field">统计期间<input value={rules.period} maxLength={500} placeholder="例如：2026 年秋季" disabled={busy} onChange={event => change('period', event.target.value)} /></label><label className="work-field">指标定义与计算口径<textarea rows={4} value={rules.definition} maxLength={10000} placeholder="例如：满意率 = 满意人数 ÷ 有效且回答该题的人数" disabled={busy} onChange={event => change('definition', event.target.value)} /></label><label className="work-field">空值与异常处理决定<textarea rows={2} value={rules.missing_policy} maxLength={2000} placeholder="先记录处理决定，不会自动改写数据" disabled={busy} onChange={event => change('missing_policy', event.target.value)} /></label><label className="work-field">补充说明<textarea rows={2} value={rules.notes} maxLength={5000} placeholder="规则来源、单位、舍入要求等" disabled={busy} onChange={event => change('notes', event.target.value)} /></label>{error && <RequestError message={error} />}<button className="button button-primary inspector-save" disabled={busy || !dirty} onClick={save}>{busy ? '正在保存…' : '保存统计口径'}<Icon name="check" /></button><p className="save-status" role="status">{saved ? '统计口径已保存到项目。' : dirty ? '有未保存的内容。' : version ? '已保存的口径，可继续修改。' : '填写后点击保存。'}</p></section>
}

export function FieldsEditor({ asset, sheet, onDirty, onSaved }: { asset: Asset; sheet?: Sheet; onDirty: (dirty: boolean) => void; onSaved: (fields: Record<string, FieldMeaning>, version: number) => void }) {
  const [fields, setFields] = useState(asset.annotations)
  const [version, setVersion] = useState(asset.annotation_version)
  const [columnId, setColumnId] = useState(sheet?.columns[0]?.id ?? '')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  useUnsavedWarning(dirty)
  const selected = sheet?.columns.find(column => column.id === columnId) ?? sheet?.columns[0]
  const value = selected ? fields[selected.id] ?? { meaning: '', unit: '' } : { meaning: '', unit: '' }
  function change(key: keyof FieldMeaning, content: string) {
    if (!selected) return
    setFields(current => ({ ...current, [selected.id]: { ...value, [key]: content } })); setDirty(true); onDirty(true); setSaved(false); setError('')
  }
  async function save() {
    setBusy(true); setError('')
    try {
      const result = await api<{ annotations: Record<string, FieldMeaning>; annotation_version: number }>(`/assets/${asset.id}/fields`, { method: 'PUT', body: JSON.stringify({ version, fields }) })
      setVersion(result.annotation_version); setDirty(false); onDirty(false); setSaved(true); onSaved(result.annotations, result.annotation_version)
    } catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }
  return <section className="fields-editor"><div className="inspector-heading"><h2>字段说明</h2><span>{dirty ? '未保存' : `v${version}`}</span></div><p className="inspector-description">按列位置区分字段，即使表头重复也不会覆盖。</p>{selected ? <><label className="work-field">选择字段<select aria-label="选择字段" value={selected.id} disabled={busy} onChange={event => setColumnId(event.target.value)}>{sheet?.columns.map(column => <option key={column.id} value={column.id}>{column.letter} · {column.label}</option>)}</select></label><label className="work-field">字段含义<input maxLength={1000} value={value.meaning} disabled={busy} placeholder="例如：有效且回答本题的人数" onChange={event => change('meaning', event.target.value)} /></label><label className="work-field">单位<input maxLength={100} value={value.unit} disabled={busy} placeholder="例如：人、份、元、%" onChange={event => change('unit', event.target.value)} /></label>{error && <RequestError message={error} />}<button className="button button-secondary inspector-save" disabled={busy || !dirty} onClick={save}>{busy ? '正在保存…' : '保存字段说明'}</button><p className="save-status" role="status">{saved ? '字段说明已保存。' : dirty ? '字段说明有未保存的修改。' : '补充说明不会修改原始表头。'}</p></> : <p className="inspector-description">当前工作表没有可编辑的字段。</p>}</section>
}
