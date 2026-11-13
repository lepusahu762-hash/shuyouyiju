import '../Work.css'
import '../SitePages.css'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, ApiError, authHref } from '../api'
import type { Project, User } from '../api'
import { Brand, Icon } from './ui'
import { tabKeys } from './navigation'

export function RequestError({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="work-error" role="alert"><Icon name="info" /><span>{message}</span>{retry && <button onClick={retry}>重试</button>}<a href={authHref()}>重新登录</a></div>
}

export function WorkShell({ children, project = false }: { children: (user: User) => ReactNode; project?: boolean }) {
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [projectResponse, setProjectResponse] = useState<{ id: string; project: Project | null; error?: string } | null>(null)
  const projectId = window.location.pathname.match(/^\/app\/projects\/([0-9a-f-]{36})\//)?.[1]
  const route = window.location.pathname.replace(/\/$/, '') || '/'
  const personalActive = route === '/app/me'
  const templateActive = route === '/app/templates'
  const routeProjectResponse = projectResponse?.id === projectId ? projectResponse : null
  const projectInfo = routeProjectResponse?.project ?? null
  const projectError = routeProjectResponse?.error
  useEffect(() => {
    let active = true
    api<User>('/auth/me').then(value => { if (active) { setUser(value); setError('') } }).catch(cause => {
      if (!active) return
      if (cause instanceof ApiError && cause.status === 401) window.location.replace(authHref())
      else setError((cause as Error).message)
    })
    return () => { active = false }
  }, [attempt])
  useEffect(() => {
    if (!user || !projectId) return
    let active = true
    api<Project>(`/projects/${projectId}`).then(value => { if (active) setProjectResponse({ id: projectId, project: value }) }).catch(cause => {
      if (active) setProjectResponse({ id: projectId, project: null, error: (cause as Error).message })
    })
    return () => { active = false }
  }, [user, projectId])
  async function logout() {
    setLeaving(true)
    try { await api('/auth/logout', { method: 'POST' }); window.location.assign('/auth') }
    catch (cause) { setError((cause as Error).message); setLeaving(false) }
  }
  const projectTabs = projectId ? [
    ['materials', '资料与口径', `/app/projects/${projectId}/materials`],
    ['analysis', '数据分析', `/app/projects/${projectId}/analysis`],
    ['verify', '结论核验', `/app/projects/${projectId}/verify`],
    ['review', '修改与交付', `/app/projects/${projectId}/review`],
  ] as const : []
  const activeProjectTab = route.endsWith('/materials') ? 'materials' : route.endsWith('/analysis') || route.endsWith('/calculations') ? 'analysis' : route.endsWith('/verify') || route.endsWith('/ai-verification') ? 'verify' : route.endsWith('/review') ? 'review' : ''
  return <div className="work-app" onKeyDown={tabKeys}><a className="skip-link" href="#work-main">跳到工作内容</a><header className="work-header"><a href="/" aria-label="数有依据，返回首页"><Brand /></a><span className="work-header-divider" /><a href="/app" className="workspace-breadcrumb">工作空间</a>{projectInfo && <><span className="work-header-divider" /><span className="workspace-project-name" title={projectInfo.name}>{projectInfo.name}</span></>}<div className="work-account"><span className="user-avatar" aria-hidden="true">{user?.email[0].toUpperCase() || '·'}</span><span className="account-email" title={user?.email}>{user?.email ?? '正在检查登录…'}</span>{user && <button onClick={logout} disabled={leaving}>{leaving ? '正在退出…' : '退出登录'}</button>}</div></header>{user && <nav className="work-mobile-nav" aria-label="工作区导航"><a className={route === '/app' ? 'active' : ''} href="/app">工作空间</a><a className={templateActive ? 'active' : ''} href="/app/templates">模板中心</a><a href="/cases">案例体验</a><a className={personalActive ? 'active' : ''} href="/app/me">个人空间</a><a href="/guide">帮助</a></nav>}<div className="work-frame"><aside className="work-sidebar"><p className="sidebar-label">工作空间</p><a className={`sidebar-link ${route === '/app' ? 'active' : ''}`} href="/app"><Icon name="table" />工作空间</a><a className={`sidebar-link ${templateActive ? 'active' : ''}`} href="/app/templates"><Icon name="file" />模板中心</a><a className="sidebar-link" href="/cases"><Icon name="chart" />案例体验</a><div className="sidebar-bottom"><a className={`sidebar-link ${personalActive ? 'active' : ''}`} href="/app/me"><Icon name="link" />个人空间</a><a href="/guide">使用帮助<Icon name="arrow" /></a></div><div className="sidebar-meta">测试阶段<br />邮件验证与模板保存尚未接通</div></aside><main className={`work-main ${project ? 'materials-main' : ''}`} id="work-main" tabIndex={-1}>{error && <RequestError message={error} retry={() => setAttempt(value => value + 1)} />}{!user ? <div className="work-loading" role="status">{error ? '连接恢复后即可继续查看自己的项目。' : '正在读取账户信息…'}</div> : <>{projectId && <><div className="project-context"><div><span>当前项目</span><strong title={projectError}>{projectInfo?.name ?? (projectError ? '无法读取项目' : '正在读取项目…')}</strong></div><span className="project-context-goal">{projectInfo?.goal === 'analysis' ? '分析数据' : projectInfo?.goal === 'verify' ? '核验已有报告' : '项目'}</span><a href={`/app/projects/${projectId}/calculations#calculation-history`}>历史与版本<small> · 版本对比预览</small></a></div><nav className="project-nav" aria-label="项目主要工作区">{projectTabs.map(([key, label, href], index) => <a key={key} href={href} aria-current={activeProjectTab === key ? 'page' : undefined} className={activeProjectTab === key ? 'current' : ''}><span>{String(index + 1).padStart(2, '0')}</span>{label}</a>)}</nav></>}{children(user)}</>}</main></div></div>
}
