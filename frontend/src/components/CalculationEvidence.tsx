import '../Calculations.css'
import '../AI.css'
import { useEffect, useState } from 'react'
import { api } from '../api'
import type { CalculationRun, Evidence, EvidenceRow, NumericResult } from '../calculationTypes'
import { RequestError } from './WorkShell'

export function CalculationEvidence({ run, category, summary }: { run: CalculationRun; category?:string; summary?:NumericResult }) {
  const [group, setGroup] = useState('denominator')
  const [offset, setOffset] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [response, setResponse] = useState<{ key: string; data?: Evidence; error?: string } | null>(null)
  const [focused, setFocused] = useState<EvidenceRow | null>(null)
  const key = `${run.id}:${category??'all'}:${group}:${offset}:${attempt}`
  const current = response?.key === key ? response : null
  useEffect(() => {
    const controller = new AbortController()
    api<Evidence>(`/runs/${run.id}/evidence?group=${group}&offset=${offset}&limit=25${category?'&category='+encodeURIComponent(category):''}`, { signal: controller.signal })
      .then(data => setResponse({ key, data })).catch(cause => { if (!controller.signal.aborted) setResponse({ key, error: (cause as Error).message }) })
    return () => controller.abort()
  }, [run.id, group, offset, key, category])
  const data = current?.data
  const counts = summary ?? run.result
  return <section className="calc-card evidence-card" aria-labelledby="calc-evidence-title"><div className="calc-card-heading"><div><p className="calc-step">03 · 原始记录</p><h2 id="calc-evidence-title">每个计数，都能找到原行。</h2></div><span className="calc-soft-tag">保存的证据快照</span></div>
    <p className="calc-help">{run.source.name} · {run.source.sheet_name}。每页最多 25 条；来源行号不含任何重新排序。{run.result.status !== 'completed' && '当前运行未产出有效数值，下列分组仅供排查。'}</p>
    <label className="evidence-group">查看记录<select aria-label="证据记录分组" value={group} onChange={event => { setGroup(event.target.value); setOffset(0); setFocused(null) }}><option value="denominator">纳入范围／分母 · {counts.denominator} 条</option><option value="numerator">符合条件／分子 · {counts.numerator} 条</option><option value="unmatched">分母内未匹配分子 · {counts.numerator_unmatched} 条</option><option value="excluded">排除范围 · {counts.excluded} 条</option><option value="all">全部来源记录 · {counts.total} 条</option></select></label>
    {focused && <div className="record-focus" role="status"><strong>已定位源行 {focused.source_row}</strong><p>{focused.reason_label}</p><code>{focused.id}</code><dl>{run.source.columns.map((column, i) => <div key={column.id}><dt>{column.letter} · {column.label}</dt><dd>{focused.cells[i] === null || focused.cells[i] === '' ? '（空值）' : String(focused.cells[i])}</dd></div>)}</dl><a className="text-link" href={`/app/projects/${run.project_id}/materials?asset=${run.source.asset_id}&sheet=${run.source.sheet_id}&row=${focused.source_row}`}>在资料页定位当前原始行 ↗</a><p className="calc-help">这里展示运行时快照。若资料变化，资料页展示当前版本，请以本次保存的证据为准。</p></div>}
    {current?.error ? <RequestError message={current.error} retry={() => setAttempt(value => value + 1)} /> : !data ? <p className="calc-loading" role="status">正在加载证据记录…</p> : <><div className="calc-table-scroll" tabIndex={0} aria-label="计算证据表格，可横向滚动"><table className="calc-data-table"><caption className="sr-only">{run.source.name}的保存记录；点击源行可以定位</caption><thead><tr><th>定位源行</th>{data.columns.map(column => <th key={column.id}>{column.letter} · {column.label}</th>)}<th>纳入依据</th></tr></thead><tbody>{data.rows.map(row => <tr key={row.id} className={row.id === focused?.id ? 'focused-evidence-row' : ''}><th scope="row"><button aria-label={`定位源行 ${row.source_row}`} onClick={() => setFocused(row)}>{row.source_row} ↗</button></th>{row.cells.map((cell, i) => <td key={i}>{cell === null || typeof cell === 'string' && !cell.trim() ? <span className="null-cell">空值</span> : String(cell)}</td>)}<td className="reason-cell">{row.reason_label}</td></tr>)}</tbody></table>{!data.total && <p className="calc-empty-small">本分组没有记录。</p>}</div><div className="calc-pagination"><span>共 {data.total} 条 · {data.total ? offset+1 : 0}–{Math.min(offset+25, data.total)}</span><div><button disabled={!offset} onClick={() => { setOffset(value => Math.max(0, value-25)); setFocused(null) }}>上一页</button><button disabled={offset+25 >= data.total} onClick={() => { setOffset(value => value+25); setFocused(null) }}>下一页</button></div></div></>}
  </section>
}
