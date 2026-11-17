import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api, displayDate } from '../api'
import type { Project } from '../api'
import { WorkShell, RequestError } from '../components/WorkShell'
import { Icon } from '../components/ui'

function Workspace() {
  const [projects, setProjects] = useState<Project[]>([])
  const [deletedProjects, setDeletedProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletedError, setDeletedError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [name, setName] = useState('')
  const [goal, setGoal] = useState<'analysis' | 'verify'>('analysis')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const newProjectButton = useRef<HTMLButtonElement>(null)
  const deletedSummary = useRef<HTMLElement>(null)
  const load = useCallback((signal?: AbortSignal) => {
    return Promise.allSettled([
      api<Project[]>('/projects', { signal }),
      api<Project[]>('/projects/deleted', { signal }),
    ]).then(([active, deleted]) => {
      if (signal?.aborted) return
      if (active.status === 'fulfilled') { setProjects(active.value); setError('') }
      else setError((active.reason as Error).message)
      if (deleted.status === 'fulfilled') { setDeletedProjects(deleted.value); setDeletedError('') }
      else setDeletedError((deleted.reason as Error).message)
      setLoading(false)
    })
  }, [])
  useEffect(() => {
    document.title = '我的工作空间 · 数有依据'
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])
  function reload() {
    if (loading || saving || restoring) return
    setLoading(true)
    void load()
  }
  function open(button: HTMLButtonElement, project: Project | null = null, action: 'edit' | 'delete' = 'edit') {
    trigger.current = button
    setEditing(project)
    setDeleting(action === 'delete')
    setName(project?.name ?? '')
    setGoal(project?.goal ?? 'analysis')
    setFormError('')
    requestAnimationFrame(() => {
      dialog.current?.showModal()
      if (action === 'delete') cancelButton.current?.focus()
      else nameInput.current?.focus()
    })
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving || restoring) return
    if (!deleting && !name.trim()) { setFormError('请输入项目名称。'); return }
    setSaving(true); setFormError('')
    try {
      if (deleting && editing) {
        await api<void>(`/projects/${editing.id}`, { method: 'DELETE' })
        setProjects(current => current.filter(item => item.id !== editing.id))
        setDeletedProjects(current => [editing, ...current.filter(item => item.id !== editing.id)])
        setNotice(`「${editing.name}」已移入已删除项目。`)
        trigger.current = newProjectButton.current
        dialog.current?.close()
        return
      }
      const project = await api<Project>(editing ? `/projects/${editing.id}` : '/projects', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify({ name: name.trim(), ...(editing ? {} : { goal }) }) })
      if (editing) { setProjects(current => current.map(item => item.id === project.id ? project : item)); dialog.current?.close() }
      else window.location.assign(`/app/projects/${project.id}/materials`)
    } catch (cause) { setFormError((cause as Error).message) }
    finally { setSaving(false) }
  }
  async function restoreProject(project: Project) {
    if (restoring || saving) return
    setRestoring(project.id)
    setDeletedError('')
    try {
      const restored = await api<Project>(`/projects/${project.id}/restore`, { method: 'POST' })
      setDeletedProjects(current => current.filter(item => item.id !== restored.id))
      setProjects(current => [restored, ...current.filter(item => item.id !== restored.id)]
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)))
      setNotice(`已恢复「${restored.name}」。`)
      deletedSummary.current?.focus()
    } catch (cause) { setDeletedError((cause as Error).message) }
    finally { setRestoring(null) }
  }
  const filtered = projects.filter(project => project.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  return <><div className="work-page-heading"><div><p className="section-kicker">你的数据与报告，从这里开始</p><h1>我的工作空间</h1><p>保存资料，整理口径，让下一步分析有据可循。</p></div><button ref={newProjectButton} className="button button-primary" disabled={!!restoring} onClick={event => open(event.currentTarget)}><Icon name="plus" />新建项目</button></div>
    {error && <RequestError message={error} retry={reload} />}
    <div className="projects-toolbar"><div><strong>全部项目</strong><span className="count-badge">{projects.length}</span></div><label className="project-search"><span>搜索项目</span><input type="search" placeholder="按名称查找" value={search} onChange={event => setSearch(event.target.value)} /></label></div>
    {loading ? <div className="work-loading" role="status">正在加载项目…</div> : projects.length === 0 && !error ? <div className="workspace-empty"><span className="empty-icon"><Icon name="file" /></span><h2>第一份资料，从一个项目开始。</h2><p>新建项目，上传表格或报告。<br />资料与已保存的口径会在下次登录时保留。</p><button className="button button-primary" onClick={event => open(event.currentTarget)}>创建第一个项目<Icon name="plus" /></button><a href="/#demo">也可以先体验合成示例<Icon name="arrow" /></a></div> : <div className="projects-table-wrap" tabIndex={0} role="region" aria-label="项目列表，可横向滚动"><table className="projects-table"><caption className="sr-only">当前账户的个人项目</caption><thead><tr><th>项目名称</th><th>目标</th><th>资料</th><th>创建时间</th><th>最近修改</th><th><span className="sr-only">操作</span></th></tr></thead><tbody>{filtered.map(project => <tr key={project.id}><th scope="row"><a href={`/app/projects/${project.id}/materials`}><span className="project-row-icon"><Icon name="file" /></span><span>{project.name}</span></a></th><td><span className="goal-tag">{project.goal === 'analysis' ? '分析数据' : '核验已有报告'}</span></td><td>{project.asset_count} 份</td><td>{displayDate(project.created_at)}</td><td>{displayDate(project.updated_at)}</td><td><button className="table-action" onClick={event => open(event.currentTarget, project)} aria-label={`重命名 ${project.name}`}>重命名</button><button type="button" className="table-action table-action-danger" disabled={!!restoring} onClick={event => open(event.currentTarget, project, 'delete')} aria-label={`删除 ${project.name}`}>删除</button><a className="table-action" href={`/app/projects/${project.id}/materials`}>打开<Icon name="arrow" /></a></td></tr>)}</tbody></table>{filtered.length === 0 && <p className="search-empty">没有找到“{search}”相关项目。<button onClick={() => setSearch('')}>清除搜索</button></p>}</div>}
    {!!notice && <p className="project-list-notice" role="status">{notice}</p>}
    {!loading && <details className="deleted-projects">
      <summary ref={deletedSummary}>已删除项目 <span className="count-badge">{deletedProjects.length}</span></summary>
      {deletedError && <RequestError message={deletedError} retry={reload} />}
      {deletedProjects.length ? <ul>
        {deletedProjects.map(project => <li key={project.id}>
          <span>{project.name}</span>
          <button className="table-action" disabled={!!restoring || saving} onClick={() => void restoreProject(project)}
            aria-label={`恢复 ${project.name}`}>{restoring === project.id ? '正在恢复…' : '恢复'}</button>
        </li>)}
      </ul> : !deletedError && <p>暂无已删除项目。</p>}
    </details>}
    <p className="work-footnote"><Icon name="info" />下一步：打开项目，在“资料与口径”上传资料并独立确认规则，再进入分析或单条核验。报告文字的单条修订、确定性复核和PDF已接通；整篇改写和其他格式导出未实现。</p>
    <dialog ref={dialog} className="work-dialog" aria-labelledby="project-dialog-title"
      aria-describedby={deleting ? 'delete-project-help' : undefined}
      onCancel={event => { if (saving) event.preventDefault() }} onClose={() => trigger.current?.focus()}>
      <form onSubmit={submit}>
        <div className="work-dialog-heading">
          <h2 id="project-dialog-title">{deleting ? '删除项目' : editing ? '重命名项目' : '新建项目'}</h2>
          <button className="icon-button" type="button" aria-label="关闭项目表单" onClick={() => dialog.current?.close()} disabled={saving}><Icon name="close" /></button>
        </div>
        {deleting ? <p id="delete-project-help" className="dialog-help">
          将 <strong>「{editing?.name}」</strong> 移入已删除项目。之后可以恢复整个项目及其资料。
        </p> : <>
          <label className="work-field">项目名称<input ref={nameInput} maxLength={120} placeholder="例如：校园满意度调查" value={name} onChange={event => setName(event.target.value)} disabled={saving} /></label>
          {!editing && <fieldset className="goal-options">
            <legend>你想先做什么？</legend>
            <label className={goal === 'analysis' ? 'chosen' : ''}><input type="radio" name="goal" value="analysis" checked={goal === 'analysis'} onChange={() => setGoal('analysis')} /><Icon name="chart" /><span><strong>分析数据</strong><small>先整理数据表与指标口径</small></span></label>
            <label className={goal === 'verify' ? 'chosen' : ''}><input type="radio" name="goal" value="verify" checked={goal === 'verify'} onChange={() => setGoal('verify')} /><Icon name="file" /><span><strong>核验已有报告</strong><small>先放入报告和数据依据</small></span></label>
          </fieldset>}
          <p className="dialog-help">{editing ? '修改名称不会改变已有资料。' : '创建后进入“资料与口径”，整理本次项目的输入。'}</p>
        </>}
        {formError && <p className="field-error" role="alert">{formError}</p>}
        <div className="work-dialog-actions">
          <button ref={cancelButton} className="button button-secondary" type="button" onClick={() => dialog.current?.close()} disabled={saving}>取消</button>
          {deleting ? <button className="button button-danger" disabled={saving}>{saving ? '正在删除…' : '确认删除'}</button>
            : <button className="button button-primary" disabled={saving}>{saving ? '正在保存…' : editing ? '保存名称' : '创建项目'}<Icon name="arrow" /></button>}
        </div>
      </form>
    </dialog>
  </>
}
export function WorkspacePage() { return <WorkShell>{() => <Workspace />}</WorkShell> }
