import { useEffect, useState } from 'react'
import type { Asset, Preview, Project } from '../api'
import { api, displayDate } from '../api'
import type { User } from '../api'
import type { CalculationRun } from '../calculationTypes'
import { WorkShell, RequestError } from '../components/WorkShell'
import { Brand, Icon } from '../components/ui'

const cases = [
  { id: 'campus', title: '校园调查报告', category: '统计口径', question: '满意率应以全部回收问卷，还是有效且回答该题的记录为分母？', files: 'CSV 表格、调查说明、报告片段', note: '合成示例记录展示口径改变会如何影响比例。', visual: '72% → 80%', formula: '144 ÷ 180 = 80%' },
  { id: 'growth', title: '经营月报', category: '变化比较', question: '金额增长率与占比上升的百分点，如何准确区分？', files: '月度数值与报告片段', note: '相同的起点和终点，在金额与占比语境中含义不同。', visual: '50 → 60', formula: '金额相对增长20%；占比变化10个百分点。' },
  { id: 'feedback', title: '活动反馈总结', category: '加权统计', question: '参与人数不同的活动，整体满意率能否直接平均？', files: '分组人数与满意人数', note: '对比按组规模加权与简单平均两种口径。', visual: '30人 + 70人', formula: '合并人数后计算，不把小组比例直接等权平均。' },
  { id: 'insufficient', title: '证据不充分的结论', category: '证据边界', question: '缺少去年数据时，能否判断满意率提升了多少？', files: '当前期间报告片段', note: '没有同口径基期数据时，保持证据不足。', visual: '缺少基期', formula: '不生成提升幅度，也不推断因果关系。' },
]

function PublicHeader() {
  return <header className="site-header"><div className="nav-shell"><a className="brand-link" href="/" aria-label="数有依据首页"><Brand /></a><nav className="desktop-nav"><a href="/#analysis">产品能力</a><a href="/cases" aria-current={location.pathname === '/cases' ? 'page' : undefined}>案例体验</a><a href="/guide" aria-current={location.pathname === '/guide' ? 'page' : undefined}>使用帮助</a></nav><div className="nav-actions"><a className="login-link" href="/auth">登录</a><a className="button button-primary nav-cta" href="/auth?next=%2Fapp">新建项目<Icon name="arrow" /></a></div><nav className="compact-public-nav" aria-label="网站导航"><a href="/#analysis">产品能力</a><a href="/cases" aria-current={location.pathname === '/cases' ? 'page' : undefined}>案例体验</a><a href="/guide" aria-current={location.pathname === '/guide' ? 'page' : undefined}>使用帮助</a></nav></div></header>
}

export function CasesPage() {
  const [active, setActive] = useState(cases[0])
  useEffect(() => { document.title = '案例体验 · 数有依据' }, [])
  return <div className="site-page"><PublicHeader /><main className="site-page-main"><div className="site-page-heading"><p className="section-kicker">合成案例 · 界面预览</p><h1>案例体验</h1><p>选择一个常见问题，查看适用的资料、分析边界与示例计算。此处为合成数据预览，不会写入个人项目。</p></div>
    <div className="case-experience-layout"><nav className="case-picker" aria-label="选择案例">{cases.map(item => <button key={item.id} className={active.id === item.id ? 'selected' : ''} onClick={() => setActive(item)}><span>{item.category}</span><b>{item.title}</b><small>{item.question}</small></button>)}</nav>
      <section className="case-preview" aria-live="polite"><div className="preview-label"><span>案例预览 · 合成资料</span><span>{active.category}</span></div><h2>{active.title}</h2><p>{active.question}</p><div className="case-preview-visual"><small>示例摘要</small><strong>{active.visual}</strong><span>{active.formula}</span></div><dl><div><dt>包含资料</dt><dd>{active.files}</dd></div><div><dt>预览边界</dt><dd>{active.note}</dd></div></dl><details><summary>查看工作流程</summary><ol><li>将表格、报告与规则资料放在同一项目内。</li><li>确认范围、字段、指标定义及来源。</li><li>由已接通的后台计算或单条核验功能生成有来源的记录。</li></ol></details><p className="preview-disclaimer">本页仅展示案例结构。案例副本创建、示例文件包和访客隔离工作区尚未接通；不会伪造“已打开案例”或保存结果。</p><div className="preview-actions"><button className="button button-secondary" disabled title="隔离演示项目尚未接通">打开隔离演示项目</button><a className="button button-primary" href="/#demo">查看首页交互示例<Icon name="arrow" /></a></div></section></div>
  </main><footer className="site-page-footer"><a href="/">返回首页</a><a href="/guide">使用帮助</a><a href="/auth">登录并新建项目</a></footer></div>
}

const guides = [
  { id: 'start', title: '快速上手', body: <><p>注册并进入工作空间，新建项目后从“资料与口径”上传CSV／XLSX表格和DOCX报告。先指定统计规则资料，再核对字段、范围与空值策略。</p><p>“数据分析”目前提供可复核的条件计数和比例；“结论核验”支持选择报告段落，人工确认方案后比较单条百分比。每次已完成运行会进入原项目历史。</p><a className="text-link" href="/app">进入我的工作空间<Icon name="arrow" /></a></> },
  { id: 'limits', title: '使用边界', body: <><p>已接通：账户与项目隔离、表格与DOCX解析、资料预览、手动计数／比例、条件组合、原始记录证据、单条数字核验、规则快照和AI辅助方案。</p><p>尚未接通：自然语言对话分析、分组图表计算、图像识别、报告修订保存、复核队列、成果导出、模板持久化、个人收藏／导出记录及历史版本差异。</p><p>模型建议不是核验结果。关键字段、口径、空值策略、精度和规则原文仍需用户确认；没有证据时不推断因果或基期变化。</p></> },
  { id: 'privacy', title: '资料与隐私', body: <><p>项目与文件接口在后台校验账户归属。上传原件与解析结果分开保存，统计使用已解析数据，不改写原文件。</p><p>AI辅助核验会把完成当前任务所需的报告片段、字段样本及命中的规则段落发送至已配置的百炼模型服务。手动计算不调用模型。尚未接通邮件验证和密码找回。</p><p>该项目为本地测试版本，未部署公网；不要把测试环境当作正式生产服务。</p></> },
  { id: 'verification', title: '验证记录', body: <><p>本地现有验收覆盖账户隔离、资料解析、条件计算、证据分页、规则冲突阻断和AI单条核验。测试数量及真实模型调用情况以仓库最新 AI_PREVIEW.md 中逐轮记录为准。</p><p>模拟模型测试与真实模型验收分别记录；模拟结果不会标成真实模型输出。首页和案例页内的示例均为合成材料。</p></> },
  { id: 'project', title: '项目说明', body: <><p>《数有依据》连接表格、统计规则、报告陈述与可定位证据，辅助检查数字在已确认口径下是否一致。</p><p>它不证明原始数据真实，也不自动证明因果关系。对话式分析、图表核验、修订交付和导出仍在后续开发范围。</p><a href="/">返回品牌首页</a></> },
]

export function GuidePage() {
  const [active, setActive] = useState(guides[0].id)
  useEffect(() => { document.title = '使用帮助与项目说明 · 数有依据' }, [])
  return <div className="site-page"><PublicHeader /><main className="site-page-main guide-main"><div className="site-page-heading"><p className="section-kicker">帮助与项目说明</p><h1>了解当前可以完成的工作。</h1><p>功能边界以现有接口与验收记录为准，页面预览不等同于服务已接通。</p></div><div className="guide-layout"><nav className="guide-nav" aria-label="帮助目录" role="tablist">{guides.map(tab => <button key={tab.id} role="tab" aria-selected={active === tab.id} onClick={() => setActive(tab.id)}>{tab.title}</button>)}</nav><section className="guide-content" role="tabpanel"><h2>{guides.find(tab => tab.id === active)?.title}</h2>{guides.find(tab => tab.id === active)?.body}</section></div></main><footer className="site-page-footer"><a href="/cases">案例体验</a><a href="/auth">登录</a><a href="/">返回首页</a></footer></div>
}

const templateCards = [
  ['校园调查统计口径', '调查数据', '包含有效样本范围、分子分母说明和来源记录的结构预览。'],
  ['经营月报检查清单', '月度报表', '包含期间、金额单位与增长／百分点定义的结构预览。'],
  ['活动反馈摘要', '反馈统计', '包含分组样本规模、加权说明及空值规则的结构预览。'],
]

function Templates() {
  const [filter, setFilter] = useState('全部')
  const [query, setQuery] = useState('')
  const shown = templateCards.filter(item => (filter === '全部' || item[1] === filter) && item.join(' ').includes(query.trim()))
  return <><div className="work-page-heading"><div><p className="section-kicker">复用结构 · 预览</p><h1>模板中心</h1><p>展示可复用的口径和报告结构。模板保存与套用尚未接入。</p></div></div><div className="template-toolbar"><label className="project-search">搜索模板<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="查找名称或用途" /></label><div className="segmented-control">{['全部', '调查数据', '月度报表', '反馈统计'].map(item => <button key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div></div><div className="template-grid">{shown.map(item => <article className="template-item" key={item[0]}><div className="template-topline"><span>{item[1]}</span><span>界面预览</span></div><h2>{item[0]}</h2><p>{item[2]}</p><details><summary>预览目录结构</summary><ul><li>数据范围与字段</li><li>指标定义及来源</li><li>需要人工确认的口径</li></ul></details><button className="button button-secondary small" disabled title="模板 API 尚未接通">使用模板</button></article>)}</div>{!shown.length && <p className="calc-empty-small">没有匹配模板。可以更改筛选条件。</p>}<div className="preview-disclaimer">收藏、创建副本、编辑和保存模板尚未接通；本页没有写入个人模板记录。</div></>
}

export function TemplatesPage() { useEffect(() => { document.title = '模板中心 · 数有依据' }, []); return <WorkShell>{(_user: User) => <Templates />}</WorkShell> }

function Personal({ user }: { user: User }) {
  const [active, setActive] = useState('account')
  const [reduceMotion, setReduceMotion] = useState(() => localStorage.getItem('syj-reduce-motion') === 'true')
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduceMotion)
    localStorage.setItem('syj-reduce-motion', String(reduceMotion))
  }, [reduceMotion])
  const sections = [
    ['account', '账户资料'], ['favorites', '收藏'], ['exports', '导出记录'], ['preferences', '偏好设置'], ['privacy', '数据与隐私'],
  ]
  return <><div className="work-page-heading"><div><p className="section-kicker">账户与个人记录</p><h1>个人空间</h1><p>只展示本账户真实读取到的资料；未接通的记录入口会明确说明。</p></div></div><div className="personal-layout"><nav className="personal-nav" aria-label="个人空间区域" role="tablist">{sections.map(([key,label]) => <button key={key} role="tab" aria-selected={active === key} onClick={() => setActive(key)}>{label}</button>)}</nav><section className="personal-panel" role="tabpanel"><h2>{sections.find(s => s[0] === active)?.[1]}</h2>{active === 'account' ? <dl className="personal-facts"><div><dt>登录邮箱</dt><dd>{user.email}</dd></div><div><dt>邮箱验证</dt><dd>{user.is_verified ? '已验证' : '尚未接通'}</dd></div><div><dt>账户类型</dt><dd>个人测试账户</dd></div></dl> : active === 'preferences' ? <div><p>显示偏好目前跟随本机浏览器设置，不会同步到其他设备。</p><label className="calc-confirm"><input type="checkbox" checked={reduceMotion} onChange={e => setReduceMotion(e.target.checked)} /><span>减少界面动效（仅本机）</span></label><p className="calc-help">当前账户没有服务端偏好设置记录。</p></div> : <div className="personal-empty"><span className="empty-icon"><Icon name={active === 'favorites' ? 'link' : 'file'} /></span><h3>{active === 'favorites' ? '收藏功能尚未接通。' : active === 'exports' ? '尚无可查询的导出记录。' : '数据管理入口尚未接通。'}</h3><p>{active === 'favorites' ? '分析结果收藏与个人收藏列表尚未建立。' : active === 'exports' ? '本版本没有生成可下载的交付件，也不会显示虚构记录。' : '账户数据导出与删除能力尚未提供。'}</p></div>}</section></div></>
}

export function PersonalPage() { useEffect(() => { document.title = '个人空间 · 数有依据' }, []); return <WorkShell>{user => <Personal user={user} />}</WorkShell> }

function ReviewWorkspace({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [runs, setRuns] = useState<CalculationRun[]>([])
  const [ruleIds, setRuleIds] = useState<string[]>([])
  const [runTotal, setRunTotal] = useState<number | null>(null)
  const [reportOffset, setReportOffset] = useState(0)
  const [reportId, setReportId] = useState('')
  const [previewResponse, setPreviewResponse] = useState<{ assetId: string; offset: number; preview?: Preview; error?: string } | null>(null)
  const [error, setError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [previewAttempt, setPreviewAttempt] = useState(0)
  const preview = previewResponse?.assetId === reportId && previewResponse.offset === reportOffset ? previewResponse.preview : null
  const previewError = previewResponse?.assetId === reportId && previewResponse.offset === reportOffset ? previewResponse.error : undefined
  useEffect(() => {
    let active = true
    Promise.all([api<Project>(`/projects/${projectId}`), api<Asset[]>(`/projects/${projectId}/assets`), api<{ items: CalculationRun[]; total: number }>(`/projects/${projectId}/runs?offset=0&limit=10`), api<string[]>(`/projects/${projectId}/rule-materials`)]).then(([p,a,r,roles]) => {
      if (!active) return
      setProject(p); document.title = `${p.name} · 修改与交付 · 数有依据`; setAssets(a); setRuns(r.items); setRunTotal(r.total); setRuleIds(roles); setReportId(a.find(x => x.kind === 'report' && x.status === 'ready' && !roles.includes(x.id))?.id ?? '')
      setError('')
    }).catch(cause => { if (active) setError((cause as Error).message) })
    return () => { active = false }
  }, [projectId, loadAttempt])
  useEffect(() => {
    if (!reportId) return
    let active = true
    api<Preview>(`/assets/${reportId}/preview?offset=${reportOffset}&limit=20`).then(value => {
      if (active) setPreviewResponse({ assetId: reportId, offset: reportOffset, preview: value })
    }).catch(cause => {
      if (active) setPreviewResponse({ assetId: reportId, offset: reportOffset, error: (cause as Error).message })
    })
    return () => { active = false }
  }, [reportId, reportOffset, previewAttempt])
  if (!project) return error ? <RequestError message={error} retry={() => setLoadAttempt(value => value + 1)} /> : <p className="work-loading">正在读取原稿与历史…</p>
  const reports = assets.filter(a => a.kind === 'report' && a.status === 'ready' && !ruleIds.includes(a.id))
  return <><div className="materials-heading"><div><p className="section-kicker">修改与交付 · 界面预览</p><h1>{project?.name ?? '修改与交付'}</h1><p>查看原稿与已有计算依据；修订保存、复核及导出尚未接通。</p></div></div>{error && <RequestError message={error} retry={() => { setError(''); setLoadAttempt(value => value + 1) }} />}<div className="review-status-band"><b>修订工作区预览</b><span>修订保存尚未接通</span><span>历史计算：{runTotal ?? '—'} 条</span></div><div className="review-layout"><section className="review-document-grid"><div className="review-document"><div className="review-pane-heading"><h2>原稿</h2><label className="work-field">报告资料<select aria-label="原稿报告资料" value={reportId} onChange={e => { setReportId(e.target.value); setReportOffset(0) }}><option value="">选择已保存报告</option>{reports.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label></div>{preview?.paragraphs?.map(p => <article key={p.id}><small>{p.location}</small><p>{p.text}</p><code>{p.id}</code></article>)}<div className="preview-pagination"><span>{preview ? `共 ${preview.total} 段 · 每页20段` : ''}</span><div><button disabled={!reportOffset} onClick={() => setReportOffset(value => Math.max(0, value - 20))}>上一页原稿</button><button disabled={!preview || reportOffset + 20 >= preview.total} onClick={() => setReportOffset(value => value + 20)}>下一页原稿</button></div></div>{reportId && previewError && <RequestError message={previewError} retry={() => setPreviewAttempt(value => value + 1)} />}{reportId && !preview && !previewError && <p className="calc-loading">读取原稿段落…</p>}{!reports.length && <div className="empty-panel"><h3>项目中还没有已解析报告。</h3><p>先到资料与口径上传DOCX或粘贴报告文本。</p><a href={`/app/projects/${projectId}/materials`}>前往资料与口径<Icon name="arrow" /></a></div>}</div><div className="review-document revised"><div className="review-pane-heading"><h2>修订稿</h2><span>尚未保存</span></div><div className="empty-panel"><span className="empty-icon"><Icon name="edit" /></span><h3>当前没有已保存的修订稿。</h3><p>系统尚未提供修改建议的接受、编辑、撤回或修订版本保存接口。原稿保持不变。</p></div><label className="work-field">修订文本<textarea disabled rows={8} placeholder="修订稿编辑将在后续版本接入。" /></label><button className="button button-secondary" disabled title="报告修订接口尚未接通">保存修订</button></div></section><aside className="review-side"><section><h2>修改依据</h2><p className="calc-help">从项目现有计算历史中查看来源快照，此处最多列出最近10条。人工修改不会自动改变原核验状态。</p>{runs.length ? runs.map(run => <a className="review-evidence-link" key={run.id} href={`/app/projects/${projectId}/calculations?run=${run.id}`}><b>{run.spec.metric}</b><span>{run.source.name} · {displayDate(run.created_at)}</span><small>{run.result.display_value ?? '无数值'}{run.spec.operation === 'ratio' && run.result.display_value !== null ? '%' : ''} · {run.stale ? '待复核' : '历史快照'}</small></a>) : <p className="calc-empty-small">还没有计算历史。运行后的结果会保存在数据分析页。</p>}</section><section><h2>版本与复核</h2><p>报告修订版本对比、复核清单及受影响结论追踪尚未实现。</p><a href={`/app/projects/${projectId}/calculations#calculation-history`}>查看现有计算历史<Icon name="arrow" /></a><button className="button button-secondary" disabled title="修订和重新核验接口尚未接通">修改后重新核验</button></section><section><h2>成果导出</h2><p>尚未生成PDF、DOCX、XLSX或图表文件。</p><button className="button button-secondary" disabled title="导出后台尚未接通">预览并导出</button></section></aside></div></>
}

export function ReviewPage({ projectId }: { projectId: string }) { return <WorkShell project>{() => <ReviewWorkspace projectId={projectId} />}</WorkShell> }
