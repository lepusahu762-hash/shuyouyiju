import { useState } from 'react'
import { formatNumber, rate, satisfiedRate, survey, totals } from '../demoData'
import { Icon, SampleNote, Status } from './ui'

export function AnalysisDemo() {
  const [metric, setMetric] = useState<'rate' | 'count'>('rate')
  const [college, setCollege] = useState(1)
  const row = survey[college]
  const isRate = metric === 'rate'
  return <div className="analysis-demo product-stage">
    <div className="question-bubble"><span className="question-avatar">我</span><span>{isRate ? '各学院的满意率是多少？' : '各学院有多少份有效答题？'}</span><Icon name="arrow" /></div>
    <div className="chart-paper">
      <div className="chart-heading"><div><span className="document-label">DATA, WITH CONTEXT</span><h3>{isRate ? '各学院满意率' : '各学院有效答题数'}</h3></div><span className="example-label">示例结果</span></div>
      <div className="bar-chart"><div className="chart-grid" aria-hidden="true"><span>{isRate ? '100%' : '100份'}</span><span>{isRate ? '50%' : '50份'}</span><span>0</span></div><div className="chart-columns">{survey.map((item, index) => { const value = isRate ? rate(item.satisfied, item.valid)! : item.valid; return <button className={`chart-column ${college === index ? 'is-selected' : ''}`} key={item.college} aria-label={`查看${item.college}计算依据：${formatNumber(value)}${isRate ? '%' : '份'}`} aria-pressed={college === index} onClick={() => setCollege(index)}><span className="column-area"><span className="column-bar" style={{ height: `${value}%` }}><b>{formatNumber(value)}{isRate ? '%' : ''}</b></span></span><span>{item.college}</span></button> })}</div></div>
      <div className="chart-basis" aria-live="polite"><span><Icon name="link" />{row.college} · 计算依据</span><strong>{isRate ? `${row.satisfied} ÷ ${row.valid} = ${formatNumber(rate(row.satisfied, row.valid)!)}%` : `有效且回答本题：${row.valid} 份`}</strong></div>
      <p className="chart-footnote">{isRate ? '满意人数 ÷ 有效答题人数 · 点击柱形查看依据' : '按有效且回答本题的问卷计数 · 点击柱形查看依据'}</p>
    </div>
    <div className="question-options" aria-label="选择示例问题"><span>试试问</span><button aria-pressed={isRate} onClick={() => setMetric('rate')}>各学院满意率？</button><button aria-pressed={!isRate} onClick={() => setMetric('count')}>有效答题有多少？</button></div>
    <SampleNote>合成示例 · 选择预设问题，查看本地计算结果</SampleNote>
  </div>
}

export function VerificationDemo() {
  const [finding, setFinding] = useState<'rate' | 'comparison'>('rate')
  return <div className="verification-demo product-stage">
    <div className="report-paper"><div className="paper-tab"><Icon name="file" /><span>校园调查报告 · 示例摘录</span></div><span className="document-label">02 / 调查结果与分析</span><h3>一份报告里的<br />两个待确认结论。</h3><p>本次共回收问卷 200 份，<br />其中有效且回答本题的问卷 180 份。</p><button aria-pressed={finding === 'rate'} className={`report-sentence ${finding === 'rate' ? 'is-selected' : ''}`} onClick={() => setFinding('rate')}><span>全校满意率为 <mark>72%</mark>。</span><Icon name="link" /></button><button aria-pressed={finding === 'comparison'} className={`report-sentence ${finding === 'comparison' ? 'is-selected' : ''}`} onClick={() => setFinding('comparison')}><span>比去年提高 <mark>8 个百分点</mark>。</span><Icon name="link" /></button><div className="paper-lines" aria-hidden="true"><i /><i /></div></div>
    <div className="finding-float" aria-live="polite"><div className="finding-float-top"><span className="finding-symbol"><Icon name={finding === 'rate' ? 'chart' : 'info'} /></span><Status tone={finding === 'rate' ? 'difference' : 'neutral'}>{finding === 'rate' ? '存在差异' : '证据不足'}</Status></div><h4>{finding === 'rate' ? '数字没错，分母呢？' : '这个比较，还缺一份依据。'}</h4>{finding === 'rate' ? <><p>按有效答题人数计算</p><div className="finding-formula">144 ÷ 180 = <strong>80%</strong></div><p>72% 对应的是总回收数口径。<br />本题定义的分母是 180。</p></> : <><p>仅有本期数据，无法计算同比变化。</p><div className="missing-file">需要去年同口径调查数据</div><p>缺少资料时，保留未解决状态。</p></>}</div>
    <SampleNote>合成示例 · 点击高亮句子，查看预设核验解释</SampleNote>
  </div>
}

type ReviewState = 'original' | 'pending' | 'reviewed'
export function ReviewDemo() {
  const [state, setState] = useState<ReviewState>('original')
  const [passed, setPassed] = useState(false)
  const [revisionValue, setRevisionValue] = useState<number | null>(null)
  function review() {
    // A real local numeric comparison of the synthetic revision, not an AI run.
    if (revisionValue === null) return
    setPassed(Math.abs(revisionValue - rate(totals.satisfied, totals.valid)!) < 0.005)
    setState('reviewed')
  }
  return <div className="review-demo product-stage">
    <div className="revision-sheet"><div className="revision-heading"><span><Icon name="edit" />修订对照</span><span className="example-label">本地示例</span></div><div className="revision-original"><span className="revision-label">原句 · 报告 v1</span><p>全校满意率为 <del>72%</del>。</p></div><div className="revision-proposed"><span className="revision-label">{state === 'original' ? '修订建议' : '修订稿 · 报告 v2'}</span><p>本次调查中，有效且回答该题的<br className="desktop-break" />问卷满意率为 <ins>{satisfiedRate}%</ins>。</p><span className="revision-source"><Icon name="link" />依据：{totals.satisfied} ÷ {totals.valid} = {satisfiedRate}%</span></div><div className="revision-action"><Status tone={state === 'original' ? 'difference' : state === 'pending' ? 'pending' : passed ? 'success' : 'difference'}>{state === 'original' ? '待处理建议' : state === 'pending' ? '待复核' : passed ? '与示例数据一致' : '存在差异'}</Status>{state === 'original' ? <button className="button button-primary small" onClick={() => { setRevisionValue(satisfiedRate); setState('pending') }}>接受修改<Icon name="check" /></button> : state === 'pending' ? <button className="button button-primary small" onClick={review}>复核示例<Icon name="arrow" /></button> : <button className="reset-button" onClick={() => { setState('original'); setPassed(false); setRevisionValue(null) }}>重置修订</button>}</div><p className="revision-feedback" role="status">{state === 'original' ? '先确认措辞与统计口径，再接受建议。' : state === 'pending' ? '修订已应用于本地示例。内容发生变化，请重新复核。' : `本地数值复核：${totals.satisfied} ÷ ${totals.valid} = ${satisfiedRate}%，与修订值${passed ? '一致' : '不一致'}。`}</p></div>
    <div className="review-timeline"><span className="done"><Icon name="check" />发现差异</span><i /><span className={state !== 'original' ? 'done' : ''}>{state !== 'original' ? <Icon name="check" /> : <span className="timeline-dot" />}确认修改</span><i /><span className={state === 'reviewed' ? 'done' : ''}>{state === 'reviewed' ? <Icon name="check" /> : <span className="timeline-dot" />}重新复核</span></div>
    <SampleNote>合成示例 · 仅复核当前数字；“同比提高”仍然证据不足</SampleNote>
  </div>
}
