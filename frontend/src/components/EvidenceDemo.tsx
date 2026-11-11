import { useState } from 'react'
import { claims, formatNumber, getScopeData, rate, scopes, survey, totals } from '../demoData'
import type { ClaimId, Scope } from '../demoData'
import { Icon, SampleNote, Status } from './ui'
import { scrollToId } from './navigation'

export function EvidenceDemo() {
  const [selected, setSelected] = useState<ClaimId>('satisfaction')
  const [scope, setScope] = useState<Scope>('全校')
  const data = getScopeData(scope)
  const value = formatNumber(rate(data.satisfied, data.valid)!)
  const claim = claims.find(item => item.id === selected)!
  const changedScope = scope !== '全校'
  const tone = selected === 'comparison' ? 'neutral' : changedScope ? 'pending' : claim.tone
  const status = selected === 'comparison' ? '证据不足' : changedScope ? '待复核' : claim.status

  return <div className="evidence-demo" id="demo" tabIndex={-1}>
    <div className="evidence-toolbar"><div className="project-name"><span className="project-icon"><Icon name="file" /></span><strong>校园满意度调查</strong><span className="example-label">交互示例</span></div><label className="scope-control">统计范围<select aria-label="证据统计范围" value={scope} onChange={event => setScope(event.target.value as Scope)}>{scopes.map(item => <option key={item}>{item}</option>)}</select></label></div>
    <div className="evidence-grid">
      <div className="evidence-report">
        <p className="panel-label"><span>01</span> 点选一句结论</p>
        <div className="paper-heading"><span className="document-label">SURVEY REPORT</span><h3>校园满意度调查报告</h3><p>调查结果与分析 · 报告 v1</p></div>
        <div className="claim-list">{claims.map((item, index) => <button key={item.id} className={`claim ${selected === item.id ? 'is-selected' : ''}`} id={`claim-${item.id}`} aria-pressed={selected === item.id} aria-controls="linked-evidence" onClick={() => setSelected(item.id)}><span className="claim-number">0{index + 1}</span><span className="claim-text">{item.id === 'sample' ? <>共回收 <b>200</b> 份问卷，<br />其中有效答题 <b>180</b> 份。</> : item.id === 'satisfaction' ? <>满意人数为 <b>144</b> 人，<br />全校满意率为 <mark>72%</mark>。</> : <>满意率比去年提高<br /><b>8 个百分点</b>。</>}</span><Icon name="arrow" /></button>)}</div>
        <button className="mobile-evidence-link text-link" onClick={() => scrollToId('linked-evidence')}>查看对应依据<Icon name="down" /></button>
        <p className="paper-footnote">报告原句保持不变，点选即可核对。</p>
      </div>
      <div className="evidence-result" id="linked-evidence" tabIndex={-1}>
        <p className="panel-label"><span>02</span> 核对计算依据</p>
        <div className="result-heading"><h3>{selected === 'satisfaction' ? `${scope}满意率` : claim.label}</h3><Status tone={tone}>{status}</Status></div>
        {selected === 'satisfaction' ? <><div className="metric-main"><strong>{value}<span>%</span></strong><span>按当前范围与口径计算</span></div><div className="equation"><div><b>{data.satisfied}</b><span>满意人数</span></div><i>÷</i><div><b>{data.valid}</b><span>有效答题</span></div><i>× 100%</i></div><div className="compare-bars"><div><span>报告原值</span><i><b style={{ width: '72%' }} /></i><strong>72%</strong></div><div><span>当前计算</span><i><b style={{ width: `${value}%` }} /></i><strong>{value}%</strong></div></div><p className="result-explanation">{changedScope ? `当前仅计算${scope}。原句描述“全校”，范围已变化，需重新确认主体和数值。` : '144 ÷ 200 得到 72%；按本题定义，应使用 180 份有效答题作为分母。'}</p></> : selected === 'sample' ? <><div className="sample-metrics"><div><strong>{data.received}</strong><span>回收问卷 / 份</span></div><div><strong>{data.valid}</strong><span>有效答题 / 份</span></div></div><p className="result-explanation">{changedScope ? `这是${scope}的数据，原句为全校样本数。请确认报告范围后再复核。` : '68 + 56 + 76 = 200 份回收问卷；60 + 50 + 70 = 180 份有效答题。原句与全校汇总一致。'}</p></> : <div className="missing-result"><span className="missing-icon"><Icon name="file" /></span><h4>还缺去年的数据</h4><p>本期满意率为 {value}%，但仅有本期数据，无法判断是否提高了 8 个百分点。</p><span className="missing-file">需补充：去年同范围、同口径数据</span></div>}
        <p className="source-line"><Icon name="link" />{scope} · 数据 v1 · 规则 v1</p>
        <span className="sr-only" role="status">已选择{claim.label}，范围{scope}，{status}。{selected !== 'comparison' ? `有效答题${data.valid}，满意${data.satisfied}。` : '缺少去年数据。'}</span>
      </div>
      <div className="evidence-sources">
        <p className="panel-label"><span>03</span> 追溯数据与规则</p>
        <div className={`source-card ${selected === 'comparison' ? 'source-muted' : ''}`}><div className="source-card-title"><Icon name="table" /><strong>调查汇总表</strong><span>示例数据</span></div><table className={`source-table selected-${selected}`}><caption className="sr-only">各学院问卷汇总，回收与有效答题单位为份，满意单位为人；选中的范围和相关字段高亮。</caption><thead><tr><th scope="col">学院</th><th scope="col">回收</th><th scope="col">有效</th><th scope="col">满意</th></tr></thead><tbody>{survey.map(row => <tr key={row.college} className={scope === '全校' || scope === row.college ? 'row-linked' : ''}><th scope="row">{row.college}</th><td>{row.received}</td><td>{row.valid}</td><td>{row.satisfied}</td></tr>)}</tbody><tfoot><tr className={scope === '全校' ? 'row-linked' : ''}><th scope="row">全校</th><td>{totals.received}</td><td>{totals.valid}</td><td>{totals.satisfied}</td></tr></tfoot></table><p className="source-location">示例汇总行 A2:D4 · 数据 v1</p></div>
        <div className="rule-card"><div className="source-card-title"><Icon name="file" /><strong>{selected === 'sample' ? '样本纳入规则' : selected === 'comparison' ? '同比比较条件' : '满意率统计口径'}</strong></div><blockquote>{selected === 'sample' ? '回收数包含所有回收问卷；有效答题数仅计有效且回答本题的问卷。' : selected === 'comparison' ? '比较两期变化，需要同一对象范围、同一统计口径的两期数据。' : <>满意人数 ÷ <em>有效且回答该题的人数</em> × 100%</>}</blockquote><p className="source-location">合成规则说明 · {selected === 'sample' ? '第 1 条' : selected === 'comparison' ? '第 3 条' : '第 2 条'}</p></div>
      </div>
    </div>
    <div className="evidence-footer"><span><span className="scope-dot" />{changedScope ? '范围变化：原报告相关结论待复核' : '结论 → 计算 → 数据与规则，一处对应'}</span><button onClick={() => { setScope('全校'); setSelected('satisfaction') }}>重置示例</button></div>
    <SampleNote>合成示例 · 数值由前端计算，结论解释为预设示例；未调用 AI 或后端核验服务。</SampleNote>
  </div>
}
