import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api'
import type { Project } from '../api'
import { WorkShell, RequestError } from '../components/WorkShell'
import { Icon } from '../components/ui'
import '../SitePages.css'
import '../Templates.css'

export type TemplateContent = {
  name: string; category: string; description: string; goal: 'analysis' | 'verify';
  rule_notes: string; report_outline: string;
}
export type ProjectTemplate = TemplateContent & { id: string; version: number; builtin: boolean }
const empty: TemplateContent = { name: '', category: '其他', description: '', goal: 'analysis', rule_notes: '', report_outline: '' }
const categories = ['调查数据', '月度报表', '反馈统计', '其他']

export function TemplateContents({ template }: { template: TemplateContent }) {
  return <div className="template-content">{template.rule_notes && <section><h3>规则草稿 · 待完善</h3><p>{template.rule_notes}</p></section>}{template.report_outline && <section><h3>报告提纲</h3><p>{template.report_outline}</p></section>}</div>
}

function Templates() {
  const [items, setItems] = useState<ProjectTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('全部')
  const [scope, setScope] = useState('全部')
  const [mode, setMode] = useState<'create' | 'edit' | 'apply'>('create')
  const [selected, setSelected] = useState<ProjectTemplate | null>(null)
  const [draft, setDraft] = useState<TemplateContent>(empty)
  const [projectName, setProjectName] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const read = useRef({ epoch: 0 })
  const pending = useRef(false)
  const request = useRef({ key: '', id: '' })
  const load = useCallback(() => {
    const epoch = ++read.current.epoch
    return api<ProjectTemplate[]>('/templates').then(values => {
      if (epoch === read.current.epoch) { setItems(values); setError('') }
    }).catch(cause => { if (epoch === read.current.epoch) setError((cause as Error).message) })
      .finally(() => { if (epoch === read.current.epoch) setLoading(false) })
  }, [])
  useEffect(() => { const tracker = read.current; document.title = '模板中心 · 数有依据'; void load(); return () => { tracker.epoch++ } }, [load])
  function open(button: HTMLButtonElement, action: typeof mode, item: ProjectTemplate | null = null) {
    trigger.current = button; setMode(action); setSelected(item); setFormError('')
    setDraft(item ? { name: item.name, category: item.category, description: item.description, goal: item.goal, rule_notes: item.rule_notes, report_outline: item.report_outline } : { ...empty })
    setProjectName(item?.name ?? ''); request.current = { key: '', id: '' }; dialog.current?.showModal()
  }
  function field<K extends keyof TemplateContent>(key: K, value: TemplateContent[K]) { setDraft(current => ({ ...current, [key]: value })) }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending.current) return
    if (mode !== 'apply' && (!draft.name.trim() || (!draft.rule_notes.trim() && !draft.report_outline.trim()))) {
      setFormError('请填写模板名称，并至少填写规则草稿或报告提纲。'); return
    }
    if (mode === 'apply' && !projectName.trim()) { setFormError('请输入新项目名称。'); return }
    pending.current = true; setSaving(true); setFormError('')
    try {
      if (mode === 'apply' && selected) {
        const key = JSON.stringify([selected.id, selected.version, projectName.trim()])
        if (request.current.key !== key) request.current = { key, id: crypto.randomUUID() }
        const project = await api<Project>(`/templates/${selected.id}/projects`, { method: 'POST', body: JSON.stringify({ name: projectName.trim(), version: selected.version, request_id: request.current.id }) })
        window.location.assign(`/app/projects/${project.id}/materials`)
        return
      }
      const result = await api<ProjectTemplate>(mode === 'edit' && selected ? `/templates/${selected.id}` : '/templates', {
        method: mode === 'edit' ? 'PUT' : 'POST', body: JSON.stringify({ ...draft, ...(mode === 'edit' && selected ? { version: selected.version } : {}) }),
      })
      read.current.epoch++; setLoading(false); setError('')
      setItems(current => [result, ...current.filter(item => item.id !== result.id)])
      setScope('我的模板'); setQuery(''); setCategory('全部')
      setNotice(mode === 'edit' ? '模板修改已保存；已创建项目保留原模板内容。' : '模板已保存到你的账户，可以立即使用。')
      dialog.current?.close()
    } catch (cause) { setFormError((cause as Error).message) }
    finally { pending.current = false; setSaving(false) }
  }
  const shown = items.filter(item => (category === '全部' || item.category === category) && (scope === '全部' || (scope === '内置模板' ? item.builtin : !item.builtin)) && `${item.name} ${item.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  return <div className="templates-page">
    <div className="work-page-heading"><div><p className="section-kicker">保存结构 · 开始下一次工作</p><h1>模板中心</h1><p>添加自己的规则草稿与报告提纲，或用内置模板创建新项目。</p></div><button className="button button-primary" onClick={event => open(event.currentTarget, 'create')}><Icon name="plus" />添加模板</button></div>
    <p className="template-boundary">模板提供起点，不携带原始资料、计算结果或已确认规则。新项目仍需上传资料并独立确认口径。</p>
    {notice && <p className="template-notice" role="status">{notice}</p>}
    {error && <RequestError message={error} retry={() => { setLoading(true); void load() }} />}
    <div className="template-toolbar"><label className="work-field">搜索模板<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="按名称或用途查找" /></label><label className="work-field">模板来源<select aria-label="模板来源" value={scope} onChange={event => setScope(event.target.value)}>{['全部', '我的模板', '内置模板'].map(value => <option key={value}>{value}</option>)}</select></label><label className="work-field">用途分类<select aria-label="用途分类" value={category} onChange={event => setCategory(event.target.value)}>{['全部', ...categories].map(value => <option key={value}>{value}</option>)}</select></label><button className="button button-secondary" disabled={loading} onClick={() => { setLoading(true); void load() }}>刷新列表</button></div>
    {loading ? <div className="work-loading" role="status">正在读取模板…</div> : <><p className="template-count" role="status">找到 {shown.length} 个模板</p><div className="template-grid">{shown.map(item => <article className="template-item" key={item.id} aria-label={item.name}><div className="template-topline"><span>{item.category}</span><span>{item.builtin ? '内置模板' : `我的模板 · v${item.version}`}</span></div><h2>{item.name}</h2><p>{item.description || '复用规则草稿与报告提纲。'}</p><p className="template-goal">项目目标：{item.goal === 'analysis' ? '分析数据' : '核验已有报告'}</p><details><summary>查看模板内容</summary><TemplateContents template={item} /></details><div className="template-actions"><button className="button button-primary" onClick={event => open(event.currentTarget, 'apply', item)}>使用模板</button><button className="button button-secondary" onClick={event => open(event.currentTarget, item.builtin ? 'create' : 'edit', item)}>{item.builtin ? '另存为我的模板' : '编辑模板'}</button></div></article>)}</div>{!shown.length && !error && <div className="workspace-empty"><h2>{scope === '我的模板' && !query && category === '全部' ? '还没有自己的模板' : '没有找到匹配的模板'}</h2><p>可以添加模板，或调整搜索和筛选条件。</p><button className="button button-primary" onClick={event => open(event.currentTarget, 'create')}>添加模板</button></div>}</>}
    <dialog ref={dialog} className="work-dialog template-dialog" aria-labelledby="template-dialog-title" onCancel={event => { if (saving) event.preventDefault() }} onClose={() => trigger.current?.focus()}><form onSubmit={submit}><div className="work-dialog-heading"><h2 id="template-dialog-title">{mode === 'apply' ? '使用模板创建项目' : mode === 'edit' ? '编辑模板' : '添加模板'}</h2><button className="icon-button" type="button" aria-label="关闭模板表单" disabled={saving} onClick={() => dialog.current?.close()}><Icon name="close" /></button></div>
      {mode === 'apply' && selected ? <><p className="dialog-help">使用「{selected.name}」v{selected.version}，为你创建独立项目。已有项目不会被覆盖。</p><label className="work-field">新项目名称<input autoFocus required maxLength={120} value={projectName} onChange={event => setProjectName(event.target.value)} disabled={saving} /></label><TemplateContents template={selected} /><p className="template-boundary">这些内容仍是草稿。下一步上传本次资料，完善规则说明并逐项确认；不会自动核验通过。</p></> : <>
      <label className="work-field">模板名称<input autoFocus required maxLength={120} value={draft.name} onChange={event => field('name', event.target.value)} disabled={saving} placeholder="例如：每月活动反馈统计" /></label>
      <div className="template-form-row"><label className="work-field">用途分类<select aria-label="用途分类" value={draft.category} onChange={event => field('category', event.target.value)} disabled={saving}>{categories.map(value => <option key={value}>{value}</option>)}</select></label><label className="work-field">项目目标<select aria-label="项目目标" value={draft.goal} onChange={event => field('goal', event.target.value as TemplateContent['goal'])} disabled={saving}><option value="analysis">分析数据</option><option value="verify">核验已有报告</option></select></label></div>
      <label className="work-field">用途说明（选填）<textarea aria-label="用途说明（选填）" rows={2} maxLength={500} value={draft.description} onChange={event => field('description', event.target.value)} disabled={saving} placeholder="说明什么时候使用这个模板" /></label>
      <p className="dialog-help">下列两项至少填写一项。用【待填写】标明每个项目需要重新补充的内容。</p>
      <label className="work-field">规则草稿<textarea aria-label="规则草稿" rows={5} maxLength={10000} value={draft.rule_notes} onChange={event => field('rule_notes', event.target.value)} disabled={saving} placeholder="统计范围：【待填写】&#10;指标定义：【待填写】&#10;空值处理：【待确认】" /></label>
      <label className="work-field">报告提纲<textarea aria-label="报告提纲" rows={4} maxLength={10000} value={draft.report_outline} onChange={event => field('report_outline', event.target.value)} disabled={saving} placeholder="一、资料来源&#10;二、统计口径&#10;三、计算结果与证据" /></label><p className="dialog-help">只保存到你的账户。模板不保存账户密钥、原始文件或已确认的规则状态。</p></>}
      {formError && <p className="field-error" role="alert">{formError}</p>}<div className="work-dialog-actions"><button className="button button-secondary" type="button" disabled={saving} onClick={() => dialog.current?.close()}>取消</button><button className="button button-primary" disabled={saving}>{saving ? '正在保存…' : mode === 'apply' ? '创建项目并使用' : '保存模板'}</button></div>
    </form></dialog>
  </div>
}

export function TemplatesPage() { return <WorkShell>{() => <Templates />}</WorkShell> }
