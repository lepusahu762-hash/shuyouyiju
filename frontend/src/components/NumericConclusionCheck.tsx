import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, displayDate } from '../api'
import type { Asset, Preview } from '../api'
import type { CalculationRun, NumericCheck, Page } from '../calculationTypes'
import { calculationStatus } from '../calculationTypes'
import { RequestError } from './WorkShell'

export function NumericConclusionCheck({ run, reports, onSaved }: { run: CalculationRun; reports: Asset[]; onSaved: () => void }) {
  const [reportId, setReportId] = useState('')
  const [paragraphId, setParagraphId] = useState('')
  const [paragraphOffset, setParagraphOffset] = useState(0)
  const [paragraphResponse, setParagraphResponse] = useState<{ key: string; data?: Preview; error?: string } | null>(null)
  const [reportValue, setReportValue] = useState('')
  const [precision, setPrecision] = useState(run.spec.precision)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [checkOffset, setCheckOffset] = useState(0)
  const [checkResponse, setCheckResponse] = useState<{ key: string; data?: Page<NumericCheck>; error?: string } | null>(null)
  const [notice, setNotice] = useState('')
  const reportKey = `${reportId}:${paragraphOffset}:${attempt}`
  const checksKey = `${run.id}:${checkOffset}:${attempt}:${run.stale}`
  const paragraphs = paragraphResponse?.key === reportKey ? paragraphResponse.data : null
  const paragraphError = paragraphResponse?.key === reportKey ? paragraphResponse.error : ''
  const checks = checkResponse?.key === checksKey ? checkResponse.data : null
  const checksError = checkResponse?.key === checksKey ? checkResponse.error : ''
  const selected = paragraphs?.paragraphs?.find(item => item.id === paragraphId)
  useEffect(() => {
    if (!reportId) return
    const controller = new AbortController()
    api<Preview>(`/assets/${reportId}/preview?offset=${paragraphOffset}&limit=20`, { signal: controller.signal }).then(data => setParagraphResponse({ key: reportKey, data }))
      .catch(cause => { if (!controller.signal.aborted) setParagraphResponse({ key: reportKey, error: (cause as Error).message }) })
    return () => controller.abort()
  }, [reportId, paragraphOffset, reportKey])
  useEffect(() => {
    const controller = new AbortController()
    api<Page<NumericCheck>>(`/runs/${run.id}/checks?offset=${checkOffset}&limit=10`, { signal: controller.signal }).then(data => setCheckResponse({ key: checksKey, data }))
      .catch(cause => { if (!controller.signal.aborted) setCheckResponse({ key: checksKey, error: (cause as Error).message }) })
    return () => controller.abort()
  }, [run.id, checkOffset, checksKey])
  function changed() { setConfirmed(false); setError(''); setNotice('') }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!selected || !reportId) { setError('请先从已有报告中选择一个段落。'); return }
    if (!/^\d{1,3}(\.\d{1,6})?$/.test(reportValue) || Number(reportValue) > 100) { setError('请输入原文中 0–100 的百分比数字，最多 6 位小数，不含 %。'); return }
    if (!confirmed) { setError('需要确认：请核对原文数值、指标、范围和精度，再勾选确认。'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      const check = await api<NumericCheck>(`/runs/${run.id}/checks`, { method: 'POST', body: JSON.stringify({ report_asset_id: reportId, paragraph_id: paragraphId, reported_value: reportValue, precision, confirmed }) })
      setNotice(`${calculationStatus[check.status]}：核验记录已保存。`); setCheckOffset(0); setAttempt(value => value + 1); onSaved()
    } catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }
  return <section className="calc-card conclusion-card" aria-labelledby="numeric-check-title"><div className="calc-card-heading"><div><p className="calc-step">04 · 单条数字结论</p><h2 id="numeric-check-title">把一个百分比，与证据比较。</h2></div></div><p className="calc-help">只比较你确认的数字；不判断整篇报告、因果结论或原始数据真实性，不改写原报告。</p>
    {!reports.length ? <p className="calc-empty-small">还没有解析成功的报告。先到<a href={`/app/projects/${run.project_id}/materials`}>资料与口径</a>上传 DOCX 或粘贴文本，再重新计算以纳入这份资料。</p> : <form className="conclusion-form" onSubmit={submit}><fieldset disabled={busy || run.stale}><div className="check-source-grid"><label className="work-field">报告资料<select aria-label="报告资料" value={reportId} onChange={event => { setReportId(event.target.value); setParagraphId(''); setParagraphOffset(0); changed() }}><option value="">选择已有报告</option>{reports.map(report => <option value={report.id} key={report.id}>{report.name}</option>)}</select></label><label className="work-field">报告段落<select aria-label="报告段落" value={selected?.id ?? ''} disabled={!paragraphs} onChange={event => { setParagraphId(event.target.value); changed() }}><option value="">{reportId && !paragraphs ? '正在读取段落…' : '请选择待核验段落'}</option>{paragraphs?.paragraphs?.map((item, i) => <option key={item.id} value={item.id}>P{paragraphOffset+i+1} · {item.text.slice(0, 65)}</option>)}</select></label></div>
    {paragraphError && <RequestError message={paragraphError} retry={() => setAttempt(value => value+1)} />}
    {paragraphs && paragraphs.total > 20 && <div className="calc-pagination"><span>报告共 {paragraphs.total} 段 · 当前 {paragraphOffset+1}–{Math.min(paragraphOffset+20, paragraphs.total)}</span><div><button type="button" disabled={!paragraphOffset} onClick={() => { setParagraphOffset(value => Math.max(0, value-20)); setParagraphId(''); changed() }}>上一组段落</button><button type="button" disabled={paragraphOffset+20 >= paragraphs.total} onClick={() => { setParagraphOffset(value => value+20); setParagraphId(''); changed() }}>下一组段落</button></div></div>}
    {selected && <blockquote className="selected-paragraph"><p>{selected.text}</p><footer>原文 · {selected.location}<code>{selected.id}</code></footer></blockquote>}
    <div className="check-value-grid"><label className="work-field">待核验的报告百分比<div className="percent-input"><input inputMode="decimal" value={reportValue} placeholder="输入原文中的数字" maxLength={10} onChange={event => { setReportValue(event.target.value); changed() }} /><span>%</span></div></label><label className="work-field">报告确认精度<select aria-label="报告确认精度" value={precision} onChange={event => { setPrecision(Number(event.target.value)); changed() }}>{Array.from({ length: 7 }, (_, i) => <option value={i} key={i}>{i} 位小数</option>)}</select></label></div>
    <label className="calc-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>我已确认：输入值来自所选原文；这条数字的指标与范围对应本次计算，精度一致。</span></label><p className="calc-help">人工确认只明确比较前提；最终状态由后台计算决定。本轮识别阿拉伯数字加 %／％。</p>
    <button className="button button-primary" disabled={busy || !selected}>{busy ? '正在核验并保存…' : '核验并保存记录'}</button></fieldset></form>}
    {run.stale && <p className="calc-warning">当前计算已过期，保留历史核验；请重新计算后再核验。</p>}{error && <RequestError message={error} />}{notice && <p className="calc-save-notice" role="status">{notice}</p>}
    <div className="saved-checks"><h3>已保存的核验 {checks ? `· ${checks.total}` : ''}</h3>{checksError ? <RequestError message={checksError} retry={() => setAttempt(value => value+1)} /> : !checks ? <p className="calc-loading">正在读取核验记录…</p> : !checks.total ? <p className="calc-help">尚未保存核验。这条计算可以关联多次比较，各次记录独立保留。</p> : checks.items.map(check => <article className={`numeric-check-result state-${check.status}`} key={check.id}><header><strong>{calculationStatus[check.status]}</strong><time>{displayDate(check.created_at)}</time></header><p>{check.stale ? `${check.stale_reasons.join('；')}，这条历史比较需要复核。` : check.result.message}</p><div className="comparison-values"><div><span>报告值</span><b>{check.result.reported_value}%</b></div><div><span>计算值{check.stale ? '（历史）' : ''}</span><b>{check.result.calculated_value === null ? '未产生' : check.result.calculated_value + '%'}</b></div><div><span>计算 − 报告</span><b>{check.result.difference_pp === null ? '未比较' : check.result.difference_pp + ' 个百分点'}</b></div></div><blockquote>{check.report.paragraph.text}</blockquote><p className="calc-help">{check.report.name} · {check.report.paragraph.location} · 精度 {check.spec.precision} 位小数</p><a className="text-link" href={`/app/projects/${run.project_id}/review?check=${check.id}`}>去修订这条原句 ↗</a><details><summary>比较规则与来源</summary><p>{check.result.comparison_rule}</p><code>{check.report.paragraph.id}</code><p>核验 ID：{check.id} · 原始保存状态：{calculationStatus[check.result.status]}</p></details></article>)}{checks && checks.total > 10 && <div className="calc-pagination"><span>{checkOffset+1}–{Math.min(checkOffset+10, checks.total)}</span><div><button disabled={!checkOffset} onClick={() => setCheckOffset(value => value-10)}>上一组核验</button><button disabled={checkOffset+10 >= checks.total} onClick={() => setCheckOffset(value => value+10)}>下一组核验</button></div></div>}</div>
  </section>
}
