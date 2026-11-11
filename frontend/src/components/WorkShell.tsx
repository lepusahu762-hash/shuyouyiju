import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, ApiError, authHref } from '../api'
import type { User } from '../api'
import { Brand, Icon } from './ui'

export function RequestError({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="work-error" role="alert"><Icon name="info" /><span>{message}</span>{retry && <button onClick={retry}>重试</button>}<a href={authHref()}>重新登录</a></div>
}

export function WorkShell({ children, project = false }: { children: (user: User) => ReactNode; project?: boolean }) {
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    let active = true
    api<User>('/auth/me').then(value => { if (active) { setUser(value); setError('') } }).catch(cause => {
      if (!active) return
      if (cause instanceof ApiError && cause.status === 401) window.location.replace(authHref())
      else setError((cause as Error).message)
    })
    return () => { active = false }
  }, [attempt])
  async function logout() {
    setLeaving(true)
    try { await api('/auth/logout', { method: 'POST' }); window.location.assign('/auth') }
    catch (cause) { setError((cause as Error).message); setLeaving(false) }
  }
  return <div className="work-app"><a className="skip-link" href="#work-main">跳到工作内容</a><header className="work-header"><a href="/" aria-label="数有依据，返回首页"><Brand /></a><span className="work-header-divider" /><a href="/app" className="workspace-breadcrumb">我的工作空间</a><div className="work-account"><span className="user-avatar" aria-hidden="true">{user?.email[0].toUpperCase() || '·'}</span><span className="account-email" title={user?.email}>{user?.email ?? '正在检查登录…'}</span>{user && <button onClick={logout} disabled={leaving}>{leaving ? '正在退出…' : '退出登录'}</button>}</div></header><div className="work-frame"><aside className="work-sidebar"><p className="sidebar-label">个人空间</p><a className="sidebar-link active" href="/app"><Icon name="table" />我的项目</a><a className="sidebar-link" href="/#cases"><Icon name="chart" />体验合成示例</a><div className="sidebar-bottom"><p>测试阶段</p><span>账户已可使用<br />邮件验证尚未接通</span><a href="/#faq">使用与数据说明<Icon name="arrow" /></a></div></aside><main className={`work-main ${project ? 'materials-main' : ''}`} id="work-main" tabIndex={-1}>{error && <RequestError message={error} retry={() => setAttempt(value => value + 1)} />}{!user ? <div className="work-loading" role="status">{error ? '连接恢复后即可继续查看自己的项目。' : '正在读取账户信息…'}</div> : children(user)}</main></div></div>
}
