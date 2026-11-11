import type { ReactNode } from 'react'

export function Icon({ name, className = '' }: { name: 'arrow' | 'down' | 'file' | 'table' | 'link' | 'check' | 'info' | 'menu' | 'close' | 'chart' | 'edit' | 'eye' | 'eyeOff' | 'back' | 'plus'; className?: string }) {
  const paths = {
    arrow: <path d="M4 12h15M13 6l6 6-6 6" />,
    back: <path d="M20 12H5m6-6-6 6 6 6" />,
    down: <path d="M12 4v15m-6-6 6 6 6-6" />,
    file: <><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5M9 12h6m-6 4h6" /></>,
    table: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16m6-10v10" /></>,
    link: <path d="m9 15 6-6m-6 9-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m0 6a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-1 1" />,
    check: <path d="m5 12 4 4L19 6" />,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-9v1" /></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    chart: <path d="M4 3v17h17M9 15v-4m5 4V6m5 9V9" />,
    edit: <path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14z" />,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    eyeOff: <path d="m3 3 18 18M9 5a13 13 0 0 1 3 0c6 0 10 7 10 7a22 22 0 0 1-4 4M6 6a22 22 0 0 0-4 6s4 7 10 7a12 12 0 0 0 5-1" />,
    plus: <path d="M12 5v14M5 12h14" />,
  }
  return <svg className={`icon ${className}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

export function Brand() {
  return <span className="brand"><svg className="brand-mark" width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect width="32" height="32" rx="9" fill="currentColor" /><path d="M8 21V15m7 6V10m7 11v-5" stroke="white" strokeWidth="3" strokeLinecap="round" /><path d="m21 8 2 2 3-3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg><span>数有依据<span className="brand-dot">.</span></span></span>
}

export function Status({ tone = 'neutral', children }: { tone?: string; children: ReactNode }) {
  return <span className={`status ${tone}`}><span aria-hidden="true">{tone === 'success' ? '✓' : tone === 'difference' ? '!' : tone === 'pending' ? '↻' : '–'}</span>{children}</span>
}

export function SampleNote({ children = '合成示例 · 本地演示，未调用 AI 服务' }: { children?: ReactNode }) {
  return <p className="sample-note"><Icon name="info" /><span>{children}</span></p>
}

export function SectionCopy({ number, label, title, children, href, action }: { number: string; label: string; title: ReactNode; children: ReactNode; href?: string; action?: string }) {
  return <div className="section-copy"><p className="section-kicker"><span>{number}</span>{label}</p><h2>{title}</h2><div className="section-description">{children}</div>{href && <a href={href} className="text-link">{action}<Icon name="arrow" /></a>}</div>
}

