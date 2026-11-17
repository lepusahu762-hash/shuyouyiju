import { useEffect, useState } from 'react'
import { Brand, Icon, SectionCopy } from '../components/ui'
import { AnalysisDemo, ReviewDemo, VerificationDemo } from '../components/FeatureDemos'
import { EvidenceDemo } from '../components/EvidenceDemo'
import { Cases } from '../components/Cases'

const faqs = [
  ['数有依据适合用来做什么？', '适合核对校园调查、活动反馈等材料中的记录数、百分比及统计口径。增长率与加权示例只在首页演示，真实工作区暂不支持这些计算。你可以从一份数据开始分析，也可以从一段报告开始核验。当前首页提供合成数据交互演示；登录后可管理项目和资料、手动计数与计算比例，并使用 AI 辅助核验单条百分比。单条修订、确定性复核与单条PDF导出已接通；图片图表支持明确百分比标签识别、人工确认与单条数据核验；对话式记录统计、单字段分组图表与源行联动已接通；无标签估值、图片PDF及整篇改写、其他格式导出仍在开发。'],
  ['现在可以上传自己的 Excel、Word 或图片吗？', '可以。登录后支持 CSV、XLSX 表格、DOCX 与粘贴文本，也支持 PNG/JPEG 图片。表格用于后台完整记录计算；图片只识别清晰可见的百分比标签，再由你确认对象与规则。PDF导入、扫描件OCR和XLS尚不支持。首页内容为合成示例。'],
  ['这些结果是 AI 实时生成的吗？', '不是。首页的解释与核验场景是预设示例，比例、汇总、图表及示例复核使用前端本地计算。真实项目中的规则检索、后台计算与 AI 单条核验已有独立入口，需按实际配置发起请求；自然语言对话分析支持受限统计方案，确认后执行后台计算。首页不会把预设内容说成实时 AI 结果。'],
  ['“与数据一致”，就代表结论一定真实吗？', '它只表示结论在当前数据、范围与统计口径下得到支持，不能证明原始数据真实。缺少去年数据时，不能判断同比变化；仅有相关关系，也不能直接得出因果结论。'],
  ['我的信息会被保存吗？需要登录才能体验吗？', '首页示例无需登录，操作仅保留在当前页面，刷新后重置。登录后的账户、项目、解析结果和已保存规则保存在后台，原文件单独保存，预览与字段说明不会改写原件。密码经安全哈希存储；后台验证每个项目和文件的归属。'],
]

export function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => { document.title = '数有依据 · 让每个结论都有数据依据' }, [])
  return <>
    <a className="skip-link" href="#main">跳到主要内容</a>
    <header className="site-header" onKeyDown={event => { if (event.key === 'Escape') { setMenuOpen(false); document.getElementById('menu-toggle')?.focus() } }}><div className="nav-shell"><a className="brand-link" href="/" aria-label="数有依据，返回首页"><Brand /></a><nav className="desktop-nav" aria-label="主导航"><a href="#analysis">产品能力</a><a href="#evidence">证据追溯</a><a href="/cases">案例体验</a><a href="/guide">使用帮助</a></nav><div className="nav-actions"><a className="login-link" href="/auth">登录</a><a className="button button-primary nav-cta" href="#demo">体验示例<Icon name="arrow" /></a><button id="menu-toggle" className="menu-toggle icon-button" aria-label={menuOpen ? '关闭导航菜单' : '打开导航菜单'} aria-expanded={menuOpen} aria-controls="mobile-nav" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'} /></button></div></div>{menuOpen && <nav className="mobile-nav" id="mobile-nav" aria-label="手机导航" onClick={() => setMenuOpen(false)}><a href="#analysis">数据分析</a><a href="#verification">结论核验</a><a href="#evidence">证据追溯</a><a href="#review">修改与复核</a><a href="/cases">案例体验</a><a href="/guide">使用帮助</a></nav>}</header>
    <main id="main" tabIndex={-1}>
      <section className="hero" id="top" aria-labelledby="hero-title"><div className="eyebrow"><span /><span>AI 数据分析与结论验证</span></div><h1 id="hero-title">让每个结论，<br />都有<span className="title-emphasis">数据依据。</span></h1><p className="hero-description">连接表格、图表与报告。<br />从提出问题，到核对结论，让每一步都有据可循。</p><div className="hero-actions"><a className="button button-primary" href="#demo">体验示例<Icon name="arrow" /></a><a className="button button-secondary" href="/auth">新建我的项目<Icon name="plus" /></a></div><p className="hero-note">示例无需登录<span>·</span>从一个数字，开始核对</p><a className="release-link" href="/guide#limits">参赛测试版 · 查看已实现能力与边界<Icon name="arrow" /></a><div className="hero-context"><span><Icon name="table" />读懂数据</span><i /><span><Icon name="link" />找到依据</span><i /><span><Icon name="check" />确认结论</span></div></section>

      <section className="feature-section section-shell" id="analysis" aria-label="数据分析"><div className="feature-layout"><SectionCopy number="01" label="数据分析" title={<>问一句话，<br />看懂一份数据。</>} href="#analysis-demo" action="试试两个示例问题"><p>把想知道的直接说出来。<br />用清楚的图表回答，也把计算依据留在身边。</p><div className="copy-detail"><Icon name="chart" /><span>点选图表，回到对应的数据与计算。</span></div></SectionCopy><div id="analysis-demo" tabIndex={-1}><AnalysisDemo /></div></div></section>

      <section className="feature-section section-shell" id="verification" aria-label="结论核验"><div className="feature-layout reverse"><SectionCopy number="02" label="结论核验" title={<>报告中的数字，<br />经得起再算一次。</>} href="#verification-demo" action="点一句结论，看看差异"><p>数字、范围、分母，都值得再核对。<br />指出问题所在，也解释为什么有差异。</p><div className="copy-detail"><Icon name="file" /><span>证据不够的结论，明确保留未解决状态。</span></div></SectionCopy><div id="verification-demo" tabIndex={-1}><VerificationDemo /></div></div></section>

      <section className="evidence-section section-shell" id="evidence" aria-labelledby="evidence-title"><div className="section-heading centered"><p className="section-kicker"><span>03</span>证据追溯</p><h2 id="evidence-title">点开结论，看见它的来处。</h2><p>一段原文、一份数据、一条规则。<br className="mobile-break" />让它们在同一条证据链上相遇。</p><span className="interaction-hint"><Icon name="link" />试试点选句子，或切换统计范围</span></div><EvidenceDemo /></section>

      <section className="feature-section section-shell review-section" id="review" aria-label="修改与复核"><div className="feature-layout"><SectionCopy number="04" label="修改与复核" title={<>每一次修改，<br />都值得再确认。</>} href="#review-demo" action="体验一次修改与复核"><p>保留原句，给出有依据的修订建议。<br />由你确认修改，再检查新的结论。</p><div className="copy-detail"><Icon name="check" /><span>接受修改后进入待复核，结果清楚可追踪。</span></div></SectionCopy><div id="review-demo" tabIndex={-1}><ReviewDemo /></div></div></section>

      <section className="cases-section section-shell" id="cases" aria-labelledby="cases-title"><div className="section-heading"><p className="section-kicker"><span>05</span>案例体验</p><h2 id="cases-title">从一个熟悉的问题开始。</h2><p>不用准备文件，带着好奇心来就好。</p><a className="text-link" href="/cases">打开案例体验页面<Icon name="arrow" /></a></div><Cases /></section>

      <section className="faq-section section-shell" id="faq" aria-labelledby="faq-title"><div className="section-heading"><p className="section-kicker">还有一些你可能想知道的</p><h2 id="faq-title">常见问题</h2><p>关于体验、数据与核验的边界。</p></div><div className="faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<Icon name="plus" /></summary><p>{answer}</p></details>)}</div></section>

      <section className="final-cta section-shell" aria-labelledby="cta-title"><span className="cta-symbol"><Icon name="link" /></span><h2 id="cta-title">好结论，从有依据开始。</h2><p>让一个数字的来处，成为一份报告的底气。</p><div className="hero-actions"><a className="button button-primary" href="#demo">体验示例<Icon name="arrow" /></a><a className="button button-secondary" href="/auth">新建我的项目<Icon name="plus" /></a></div><p className="cta-note">示例无需登录 · 注册后可保存个人项目与资料</p></section>
    </main>
    <footer className="site-footer"><div className="footer-main section-shell"><div><a href="#top" aria-label="数有依据，返回顶部"><Brand /></a><p>让结论经得起核对。</p></div><nav aria-label="页脚导航"><a href="#analysis">产品能力</a><a href="/cases">案例体验</a><a href="/guide">使用与数据说明</a><a href="/auth">登录 / 注册</a></nav></div><div className="footer-bottom section-shell"><span>© 2026 数有依据</span><span>本地测试版本 · 首页含合成示例</span><a href="#top">回到顶部 ↑</a></div></footer>
  </>
}
