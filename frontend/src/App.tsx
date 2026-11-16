import { Component, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Brand, Icon } from './components/ui'
import './App.css'

class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <main className="not-found" role="alert"><Brand /><h1>页面暂时未能打开。</h1><p>可能是连接中断或页面版本已更新。请重新加载；已保存的项目与记录仍在后台。</p><button className="button button-primary" onClick={() => location.reload()}>重新加载页面</button><a href="/app">返回工作空间</a></main> : this.props.children
  }
}

// Native links support browser history and new tabs. Vite serves the SPA entry
// on direct /auth refresh; production hosts need the same history fallback.
async function loadPage() {
  const pathname = window.location.pathname.replace(/\/$/, '') || '/'
  if (pathname === '/') { const { HomePage } = await import('./pages/HomePage'); return <HomePage /> }
  if (pathname === '/auth') { const { AuthPage } = await import('./pages/AuthPage'); return <AuthPage /> }
  if (pathname === '/cases') { const { CasesPage } = await import('./pages/SitePages'); return <CasesPage /> }
  if (pathname === '/guide') { const { GuidePage } = await import('./pages/SitePages'); return <GuidePage /> }
  if (pathname === '/app') { const { WorkspacePage } = await import('./pages/WorkspacePage'); return <WorkspacePage /> }
  if (pathname === '/app/templates') { const { TemplatesPage } = await import('./pages/TemplatesPage'); return <TemplatesPage /> }
  if (pathname === '/app/me') { const { PersonalPage } = await import('./pages/SitePages'); return <PersonalPage /> }
  const materialRoute = pathname.match(/^\/app\/projects\/([0-9a-f-]{36})\/materials$/)
  if (materialRoute) { const { MaterialsPage } = await import('./pages/MaterialsPage'); return <MaterialsPage projectId={materialRoute[1]} /> }
  const calculationRoute = pathname.match(/^\/app\/projects\/([0-9a-f-]{36})\/(?:analysis|calculations)$/)
  if (calculationRoute) { const { CalculationsPage } = await import('./pages/CalculationsPage'); return <CalculationsPage projectId={calculationRoute[1]} /> }
  const aiRoute = pathname.match(/^\/app\/projects\/([0-9a-f-]{36})\/(?:verify|ai-verification)$/)
  if (aiRoute) { const { AIVerificationPage } = await import('./pages/AIVerificationPage'); return <AIVerificationPage projectId={aiRoute[1]} /> }
  const reviewRoute = pathname.match(/^\/app\/projects\/([0-9a-f-]{36})\/review$/)
  if (reviewRoute) { const { ReviewPage } = await import('./pages/ReviewPage'); return <ReviewPage projectId={reviewRoute[1]} /> }
  return <main className="not-found"><a href="/"><Brand /></a><p className="section-kicker">404 · 页面不存在</p><h1>这个页面还没有到这里。</h1><p>回到首页，继续体验数据与证据的联动。</p><a className="button button-primary" href="/">返回首页<Icon name="arrow" /></a></main>
}

// A normal loading state avoids React Suspense's fallback reveal delay for the
// first route. Imports remain split by page; the error boundary covers failures.
function Routes() {
  const [page, setPage] = useState<{ content?: ReactNode; error?: Error } | null>(null)
  useEffect(() => {
    let active = true
    loadPage().then(content => { if (active) setPage({ content }) }).catch(error => { if (active) setPage({ error }) })
    return () => { active = false }
  }, [])
  if (page?.error) throw page.error
  return page ? page.content : <main className="page-loading" role="status"><Brand /><p>正在打开页面…</p></main>
}

function App() {
  return <PageBoundary><Routes /></PageBoundary>
}

export default App
