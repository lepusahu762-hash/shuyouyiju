import { HomePage } from './pages/HomePage'
import { AuthPage } from './pages/AuthPage'
import { Brand, Icon } from './components/ui'
import './App.css'
import './Work.css'
import { WorkspacePage } from './pages/WorkspacePage'
import { MaterialsPage } from './pages/MaterialsPage'

// Native links support browser history and new tabs. Vite serves the SPA entry
// on direct /auth refresh; production hosts need the same history fallback.
function App() {
  const pathname = window.location.pathname.replace(/\/$/, '') || '/'
  if (pathname === '/') return <HomePage />
  if (pathname === '/auth') return <AuthPage />
  if (pathname === '/app') return <WorkspacePage />
  const materialRoute = pathname.match(/^\/app\/projects\/([0-9a-f-]{36})\/materials$/)
  if (materialRoute) return <MaterialsPage projectId={materialRoute[1]} />
  return <main className="not-found"><a href="/"><Brand /></a><p className="section-kicker">404 · 页面不存在</p><h1>这个页面还没有到这里。</h1><p>回到首页，继续体验数据与证据的联动。</p><a className="button button-primary" href="/">返回首页<Icon name="arrow" /></a></main>
}

export default App
