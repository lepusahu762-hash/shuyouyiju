import '../SitePages.css'
import { useEffect, useState } from 'react'
import type { User } from '../api'
import { capabilities } from '../capabilities'
import { tabKeys } from '../components/navigation'
import { WorkShell } from '../components/WorkShell'
import { Brand, Icon } from '../components/ui'

const cases = [
  { id: 'campus', title: '校园调查报告', category: '统计口径', question: '满意率应以全部回收问卷，还是有效且回答该题的记录为分母？', files: 'CSV 表格、调查说明、报告片段', note: '合成示例记录展示口径改变会如何影响比例。', support: '工作区支持单条百分比核验，需自行上传资料与确认规则。', visual: '72% → 80%', formula: '144 ÷ 180 = 80%' },
  { id: 'growth', title: '经营月报', category: '变化比较', question: '金额增长率与占比上升的百分点，如何准确区分？', files: '月度数值与报告片段', note: '相同的起点和终点，在金额与占比语境中含义不同。', support: '仅示例：工作区尚不支持增长率计算。', visual: '50 → 60', formula: '金额相对增长20%；占比变化10个百分点。' },
  { id: 'feedback', title: '活动反馈总结', category: '加权统计', question: '参与人数不同的活动，整体满意率能否直接平均？', files: '分组人数与满意人数', note: '对比按组规模加权与简单平均两种口径。', support: '仅示例：工作区支持记录分组占比，不支持任意加权均值。', visual: '30人 + 70人', formula: '合并人数后计算，不把小组比例直接等权平均。' },
  { id: 'insufficient', title: '证据不充分的结论', category: '证据边界', question: '缺少去年数据时，能否判断满意率提升了多少？', files: '当前期间报告片段', note: '没有同口径基期数据时，保持证据不足。', support: '工作区遇缺失依据需澄清或停止，不能编造基期数值。', visual: '缺少基期', formula: '不生成提升幅度，也不推断因果关系。' },
]

function PublicHeader() {
  return <header className="site-header"><div className="nav-shell"><a className="brand-link" href="/" aria-label="数有依据首页"><Brand /></a><nav className="desktop-nav"><a href="/#analysis">产品能力</a><a href="/cases" aria-current={location.pathname === '/cases' ? 'page' : undefined}>案例体验</a><a href="/guide" aria-current={location.pathname === '/guide' ? 'page' : undefined}>使用帮助</a></nav><div className="nav-actions"><a className="login-link" href="/auth">登录</a><a className="button button-primary nav-cta" href="/auth?next=%2Fapp">新建项目<Icon name="arrow" /></a></div><nav className="compact-public-nav" aria-label="网站导航"><a href="/#analysis">产品能力</a><a href="/cases" aria-current={location.pathname === '/cases' ? 'page' : undefined}>案例体验</a><a href="/guide" aria-current={location.pathname === '/guide' ? 'page' : undefined}>使用帮助</a></nav></div></header>
}

export function CasesPage() {
  const [active, setActive] = useState(cases[0])
  useEffect(() => { document.title = '案例体验 · 数有依据' }, [])
  return <div className="site-page" onKeyDown={tabKeys}><PublicHeader /><main className="site-page-main"><div className="site-page-heading"><p className="section-kicker">合成案例 · 界面预览</p><h1>案例体验</h1><p>选择一个常见问题，查看适用的资料、分析边界与示例计算。此处为合成数据预览，不会写入个人项目。</p></div>
    <div className="case-experience-layout"><nav className="case-picker" aria-label="选择案例">{cases.map(item => <button key={item.id} className={active.id === item.id ? 'selected' : ''} onClick={() => setActive(item)}><span>{item.category}</span><b>{item.title}</b><small>{item.question}</small></button>)}</nav>
      <section className="case-preview" aria-live="polite"><div className="preview-label"><span>案例预览 · 合成资料</span><span>{active.category}</span></div><h2>{active.title}</h2><p>{active.question}</p><p className="case-support">{active.support}</p><div className="case-preview-visual"><small>示例摘要</small><strong>{active.visual}</strong><span>{active.formula}</span></div><dl><div><dt>包含资料</dt><dd>{active.files}</dd></div><div><dt>预览边界</dt><dd>{active.note}</dd></div></dl><details><summary>查看工作流程</summary><ol><li>将表格、报告与规则资料放在同一项目内。</li><li>确认范围、字段、指标定义及来源。</li><li>由已接通的后台计算或单条核验功能生成有来源的记录。</li></ol></details><p className="preview-disclaimer">本页仅展示案例结构。案例副本创建、示例文件包和访客隔离工作区尚未接通；不会伪造“已打开案例”或保存结果。</p><div className="preview-actions"><button className="button button-secondary" disabled title="隔离演示项目尚未接通">打开隔离演示项目</button><a className="button button-primary" href="/#demo">查看首页交互示例<Icon name="arrow" /></a></div></section></div>
  </main><footer className="site-page-footer"><a href="/">返回首页</a><a href="/guide">使用帮助</a><a href="/auth">登录并新建项目</a></footer></div>
}

const guides = [
  { id: 'start', title: '快速上手', body: <><p>注册并新建项目，在“资料与口径”上传CSV／XLSX，再用“补充规则说明”保存文本并指定为规则资料。点击“确认统计规则”，为各项约束选择真实原文、逐项确认并保存快照，无需先上传待核验报告或图片。</p><p>保存规则后直接进入“数据分析”：提问、检查方案、确认计算、点击分组定位原始行与规则。也可使用手动计数和比例；核验报告时再上传DOCX/文本或PNG/JPEG，选择一条百分比。报告文字核验结果可进入“修改与交付”，保存修订后需另行复核，最后导出选定版本的单条PDF。</p><a className="text-link" href="/app">进入我的工作空间<Icon name="arrow" /></a></> },
  { id: 'limits', title: '使用边界', body: <><p>参赛测试版 · 以下按当前可运行功能列示。首页与案例的合成演示不代表工作区支持所有计算。</p><div className="capability-list">{capabilities.map(c=><article key={c.name}><h3>{c.name}<span>{c.state}</span></h3><p>{c.detail}</p></article>)}</div><p>模板中心已支持添加、编辑个人模板，以及用内置或个人模板创建项目；模板内容仍需结合本次资料人工完善与确认。尚未实现：收藏、个人汇总导出记录、邮件验证/找回密码、隔离访客工作区和公网部署。项目内的单条PDF记录已接通。</p><p>模型建议需人工确认，结果只表示在所选资料和规则下的一条数字比较，不证明数据真实、统计显著性或因果关系。</p></> },
  { id: 'privacy', title: '资料与隐私', body: <><p>项目与文件接口在后台校验账户归属。上传原件与解析结果分开保存，统计使用已解析数据，不改写原文件。</p><p>AI辅助核验会把完成当前任务所需的报告片段、字段样本及命中的规则段落发送至已配置的百炼模型服务。图片识别会发送用户选中的转正图片区域；只处理明确数值，不根据图形大小猜测。手动计算不调用模型。尚未接通邮件验证和密码找回。</p><p>该项目为本地测试版本，未部署公网；不要把测试环境当作正式生产服务。</p></> },
  { id: 'verification', title: '验证记录', body: <><p>本地现有验收覆盖账户隔离、资料解析、条件计算、证据分页、规则冲突阻断和AI单条核验。最新体验验收、性能条件与版本清单见仓库 RELEASE_READINESS.md、EXPERIENCE_PREVIEW.md；业务真实调用按AI_PREVIEW.md逐轮记录。未开展真实用户研究，不声称准确率或用户满意度。</p><p>模拟模型测试与真实模型验收分别记录；模拟结果不会标成真实模型输出。首页和案例页内的示例均为合成材料。</p></> },
  { id: 'project', title: '项目说明', body: <><p>《数有依据》连接表格、统计规则、报告陈述与可定位证据，辅助检查数字在已确认口径下是否一致。</p><p>它不证明原始数据真实，也不自动证明因果关系。复杂对话统计、无标签图形估值、整篇自动改写、批量及DOCX／XLSX导出仍在后续开发范围。</p><a href="/">返回品牌首页</a></> },
]

export function GuidePage() {
  const [active, setActive] = useState(guides.some(g=>g.id===location.hash.slice(1))?location.hash.slice(1):guides[0].id)
  useEffect(() => { document.title = '使用帮助与项目说明 · 数有依据' }, [])
  return <div className="site-page" onKeyDown={tabKeys}><PublicHeader /><main className="site-page-main guide-main"><div className="site-page-heading"><p className="section-kicker">帮助与项目说明</p><h1>了解当前可以完成的工作。</h1><p>功能边界以现有接口与验收记录为准，页面预览不等同于服务已接通。</p></div><div className="guide-layout"><nav className="guide-nav" aria-label="帮助目录" role="tablist">{guides.map(tab => <button key={tab.id} role="tab" aria-selected={active === tab.id} onClick={() => {setActive(tab.id);history.replaceState(null,'','/guide#'+tab.id)}}>{tab.title}</button>)}</nav><section className="guide-content" role="tabpanel"><h2>{guides.find(tab => tab.id === active)?.title}</h2>{guides.find(tab => tab.id === active)?.body}</section></div></main><footer className="site-page-footer"><a href="/cases">案例体验</a><a href="/auth">登录</a><a href="/">返回首页</a></footer></div>
}

function Personal({ user }: { user: User }) {
  const [active, setActive] = useState('account')
  const [reduceMotion, setReduceMotion] = useState(() => {try{return localStorage.getItem('syj-reduce-motion') === 'true'}catch{return false}})
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduceMotion)
    try { localStorage.setItem('syj-reduce-motion', String(reduceMotion)) } catch { /* Disabled storage: applies only until this page is closed. */ }
  }, [reduceMotion])
  const sections = [
    ['account', '账户资料'], ['favorites', '收藏'], ['exports', '导出记录'], ['preferences', '偏好设置'], ['privacy', '数据与隐私'],
  ]
  return <><div className="work-page-heading"><div><p className="section-kicker">账户与个人记录</p><h1>个人空间</h1><p>只展示本账户真实读取到的资料；未接通的记录入口会明确说明。</p></div></div><div className="personal-layout"><nav className="personal-nav" aria-label="个人空间区域" role="tablist">{sections.map(([key,label]) => <button key={key} role="tab" aria-selected={active === key} onClick={() => setActive(key)}>{label}</button>)}</nav><section className="personal-panel" role="tabpanel"><h2>{sections.find(s => s[0] === active)?.[1]}</h2>{active === 'account' ? <dl className="personal-facts"><div><dt>登录邮箱</dt><dd>{user.email}</dd></div><div><dt>邮箱验证</dt><dd>{user.is_verified ? '已验证' : '尚未接通'}</dd></div><div><dt>账户类型</dt><dd>个人测试账户</dd></div></dl> : active === 'preferences' ? <div><p>显示偏好仅作用于本机。允许浏览器存储时可记住；存储被禁用时仅本次页面有效，不同步其他设备。</p><label className="calc-confirm"><input type="checkbox" checked={reduceMotion} onChange={e => setReduceMotion(e.target.checked)} /><span>减少界面动效（仅本机）</span></label><p className="calc-help">当前账户没有服务端偏好设置记录。</p></div> : <div className="personal-empty"><span className="empty-icon"><Icon name={active === 'favorites' ? 'link' : 'file'} /></span><h3>{active === 'favorites' ? '收藏功能尚未接通。' : active === 'exports' ? '账户汇总导出记录尚未接通。' : '数据管理入口尚未接通。'}</h3><p>{active === 'favorites' ? '分析结果收藏与个人收藏列表尚未建立。' : active === 'exports' ? '项目内已支持单条结论PDF及项目导出记录，请打开对应项目的“修改与交付”。此处账户汇总列表尚未接通。' : '账户数据导出与删除能力尚未提供。'}</p></div>}</section></div></>
}

export function PersonalPage() { useEffect(() => { document.title = '个人空间 · 数有依据' }, []); return <WorkShell>{user => <Personal user={user} />}</WorkShell> }
