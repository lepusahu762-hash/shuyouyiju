import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api, displayDate } from '../api'
import type { Asset, Project } from '../api'
import type { CalculationRun, CalculationSpec, Condition, Page } from '../calculationTypes'
import { calculationStatus, conditionText, nullPolicyLabel } from '../calculationTypes'
import { WorkShell, RequestError } from '../components/WorkShell'
import { CalculationConditions } from '../components/CalculationConditions'
import { CalculationEvidence } from '../components/CalculationEvidence'
import { NumericConclusionCheck } from '../components/NumericConclusionCheck'
import { Icon } from '../components/ui'
import { AnalysisSavedGroups } from '../components/analysis/AnalysisSavedGroups'
import type { GroupRun } from '../analysisTypes'
import { AnalysisWorkspace } from '../components/analysis/AnalysisWorkspace'

type Draft = Omit<CalculationSpec, 'null_policy'> & { null_policy: CalculationSpec['null_policy'] | '' }
type Bundle = { project: Project; assets: Asset[]; context_hash: string }
const initialDraft: Draft = { asset_id: '', sheet_id: '', operation: 'ratio', metric: '', scope_description: '', scope: [], numerator: [], null_policy: '', precision: 0, confirmed: false }

function Results({ run, settingsDiffer, onReuse }: { run: CalculationRun; settingsDiffer: boolean; onReuse: () => void }) {
  const result = run.result
  return <section className="calc-card result-card" aria-labelledby="calculation-result-title"><div className="calc-card-heading"><div><p className="calc-step">02 · 后台计算</p><h2 id="calculation-result-title">{run.spec.metric}</h2></div><span className={`calculation-status state-${run.status}`}>{calculationStatus[run.status]}</span></div>
    {run.stale && <div className="calc-warning" role="status">{run.stale_reasons.join('；')}。这是历史快照，不再代表当前资料；请重新计算后复核。<button onClick={onReuse}>载入原条件重新确认</button></div>}
    {run.method_version.startsWith('record-single-group-')&&<p className="calc-warning">这是分组历史，下面保留分组图表与来源。左侧手动表单仅重算总体，不复用保存的分组或额外空值检查字段；更改分组请进入“对话与分组分析”确认新方案。</p>}
    {settingsDiffer && <p className="calc-warning">设置区与下方保存结果不同。当前展示的仍是 {displayDate(run.created_at)} 的运行；修改设置后请重新确认并运行。</p>}
    <div className="computed-value"><strong>{result.display_value ?? '—'}<small>{result.display_value !== null ? run.spec.operation === 'ratio' ? '%' : ' 条' : ''}</small></strong><div><b>{result.status === 'completed' ? run.spec.operation === 'ratio' ? `${result.numerator} ÷ ${result.denominator} × 100%` : `符合条件的记录数 = ${result.numerator}` : calculationStatus[result.status]}</b><span>{result.message}</span></div></div>
    <dl className="calculation-counts"><div><dt>总记录</dt><dd>{result.total}</dd></div><div><dt>纳入范围{run.spec.operation === 'ratio' ? '／分母' : ''}</dt><dd>{result.included}</dd></div><div><dt>排除范围</dt><dd>{result.excluded}</dd></div><div><dt>符合条件{run.spec.operation === 'ratio' ? '／分子' : ''}</dt><dd>{result.numerator}</dd></div></dl><p className="calc-help">单位始终为记录／行，不自动等同人数，不执行去重。分子只从分母范围筛选。{result.status !== 'completed' && '当前分组仅供排查，不是有效计算结果。'}</p>
    {run.spec.operation === 'ratio' && <figure className="result-chart"><figcaption>范围内记录构成 · {run.source.name} / {run.source.sheet_name}</figcaption><div className="result-chart-row"><span>分母范围</span><div><i style={{ width: result.denominator ? '100%' : '0%' }} /></div><b>{result.denominator} 条</b></div><div className="result-chart-row"><span>符合分子</span><div><i className="numerator" style={{ width: result.denominator ? `${Math.min(100, result.numerator / result.denominator * 100)}%` : '0%' }} /></div><b>{result.numerator} 条</b></div><p>图表复用本次保存的计算结果；单位为记录／行，不去重。</p></figure>}
    <div className="saved-conditions"><p><b>统计范围</b>{run.spec.scope_description}</p><p><b>范围条件</b>{conditionText(run.spec.scope, run.source.columns)}</p><p><b>{run.spec.operation === 'ratio' ? '分子条件' : '计数条件'}</b>{conditionText(run.spec.numerator, run.source.columns)}</p><p><b>空值策略</b>{nullPolicyLabel[run.spec.null_policy]}</p></div>
    <details className="calculation-details"><summary>纳入、排除与未匹配原因</summary>{Object.entries(result.reasons).map(([key, reason]) => <p key={key}><b>{reason.count} 条</b> · {reason.label}</p>)}<p>条件字段有空值：{result.null_rows} 条；数值条件字段含非数值：{result.numeric_unmatched_rows} 条。这两项为诊断计数，可能重叠；上方四类分组互不重叠。</p><p>文本按原文逐字相等，区分大小写和首尾空格；数值方式显式将数字／数字文本转为十进制比较；非数值、空值不匹配数值条件。公式不会执行。</p><p>“排除空值”检查范围与分子使用的所有字段，可同时影响分母；“保留空值”不会删除记录，但空值不能匹配非空等值条件。</p></details>
    <details className="calculation-details source-details"><summary>公式、未舍入值与来源快照</summary><dl><dt>精确值</dt><dd>{result.exact_fraction ? `${result.exact_fraction.numerator} / ${result.exact_fraction.denominator}${run.spec.operation === 'ratio' ? ' × 100%' : ''}` : '当前未产生有效值'}</dd><dt>未作展示舍入的十进制值</dt><dd><code>{result.unrounded_decimal ?? '未产生'}</code><p>精确分数为准；循环小数的十进制展开最多保存 80 位有效数字。</p></dd><dt>展示与比较</dt><dd>{run.spec.precision} 位小数，十进制四舍五入；{result.comparison_rule}</dd><dt>原资料／工作表</dt><dd>{run.source.name} / {run.source.sheet_name}</dd><dt>稳定来源</dt><dd><code>{run.source.source_id}</code></dd><dt>原文件 SHA-256</dt><dd><code>{run.source.sha256}</code></dd><dt>工作表内容指纹</dt><dd><code>{run.source.parsed_fingerprint}</code></dd><dt>口径快照</dt><dd>规则 v{run.context?.rules_version ?? '—'}<pre>{JSON.stringify(run.context?.rules ?? {}, null, 2)}</pre></dd><dt>所用字段</dt><dd>{run.source.columns.filter(column => [...run.spec.scope, ...run.spec.numerator].some(item => item.column_id === column.id)).map(column => <p key={column.id}>{column.letter} · {column.label}<code>{column.id}</code>{run.source.annotations[column.id]?.meaning || '未补充含义'} {run.source.annotations[column.id]?.unit || ''}</p>)}</dd><dt>运行记录</dt><dd><code>{run.id}</code>{displayDate(run.created_at)} · 方法 {run.method_version}</dd></dl></details>
    <p className="calc-save-notice">计算和证据快照已保存。后续变更不会覆盖这次运行。</p>
  </section>
}

function Calculations({ projectId }: { projectId: string }) {
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const contextHash = useRef('')
  const [draft, setDraft] = useState<Draft>(initialDraft)
  const [run, setRun] = useState<CalculationRun | null>(null)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [opening, setOpening] = useState(false)
  const [historyOffset, setHistoryOffset] = useState(0)
  const [historyAttempt, setHistoryAttempt] = useState(0)
  const [historyResponse, setHistoryResponse] = useState<{ key: string; data?: Page<CalculationRun>; error?: string } | null>(null)
  const historyKey = `${projectId}:${historyOffset}:${historyAttempt}`
  const history = historyResponse?.key === historyKey ? historyResponse.data : null
  const historyError = historyResponse?.key === historyKey ? historyResponse.error : ''
  const load = useCallback(() => Promise.all([api<Project>(`/projects/${projectId}`), api<Asset[]>(`/projects/${projectId}/assets`), api<{ context_hash: string }>(`/projects/${projectId}/calculation-context`)])
    .then(([project, assets, context]) => {
      if (contextHash.current && contextHash.current !== context.context_hash) setDraft(current => ({ ...current, confirmed: false }))
      contextHash.current = context.context_hash
      setBundle({ project, assets, context_hash: context.context_hash }); setError(''); document.title = `${project.name} · 计算与证据 · 数有依据`
    }).catch(cause => setError((cause as Error).message)), [projectId])
  const refreshRun = useCallback(() => {
    if (!run) return
    void api<CalculationRun>(`/runs/${run.id}`).then(value => { if (value.project_id === projectId) setRun(value) }).catch(cause => setError((cause as Error).message))
  }, [run, projectId])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const rid = new URLSearchParams(window.location.search).get('run')
    if (!rid) return
    const controller = new AbortController()
    api<CalculationRun>(`/runs/${encodeURIComponent(rid)}`, { signal: controller.signal }).then(value => {
      if (value.project_id !== projectId) throw new Error('这条运行不属于当前项目。')
      setRun(value)
      setDraft({ ...value.spec, confirmed: false })
    }).catch(cause => { if (!controller.signal.aborted) setError((cause as Error).message) })
    return () => controller.abort()
  }, [projectId])
  useEffect(() => {
    const controller = new AbortController()
    api<Page<CalculationRun>>(`/projects/${projectId}/runs?offset=${historyOffset}&limit=10`, { signal: controller.signal }).then(data => setHistoryResponse({ key: historyKey, data }))
      .catch(cause => { if (!controller.signal.aborted) setHistoryResponse({ key: historyKey, error: (cause as Error).message }) })
    return () => controller.abort()
  }, [projectId, historyOffset, historyKey])
  useEffect(() => {
    const refresh = () => { void load(); setHistoryAttempt(value => value+1); if (run) void api<CalculationRun>(`/runs/${run.id}`).then(setRun).catch(cause => setError((cause as Error).message)) }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [load, run])
  const tables = bundle?.assets.filter(asset => asset.kind === 'table' && asset.status === 'ready') ?? []
  const reports = bundle?.assets.filter(asset => asset.kind === 'report' && asset.status === 'ready') ?? []
  const table = tables.find(item => item.id === draft.asset_id)
  const sheet = table?.summary.sheets?.find(item => item.id === draft.sheet_id)
  const settingsDiffer = !!run && (['asset_id', 'sheet_id', 'operation', 'metric', 'scope_description', 'scope', 'numerator', 'null_policy', 'precision'] as const).some(key => JSON.stringify(draft[key]) !== JSON.stringify(run.spec[key]))
  function edit(patch: Partial<Draft>) { setDraft(current => ({ ...current, ...patch, confirmed: false })); setFormError('') }
  function setConditions(kind: 'scope' | 'numerator', conditions: Condition[]) { edit({ [kind]: conditions }) }
  function setSelectedRun(value: CalculationRun) {
    setRun(value)
    window.history.replaceState(null, '', window.location.pathname + '?run=' + value.id)
  }
  async function openRun(id: string) {
    setOpening(true)
    try { const value = await api<CalculationRun>(`/runs/${id}`); setSelectedRun(value); setDraft({ ...value.spec, confirmed: false }); setError('') }
    catch (cause) { setError((cause as Error).message) }
    finally { setOpening(false) }
  }
  async function execute(event: FormEvent) {
    event.preventDefault()
    if (busy || !bundle) return
    if (!table || !sheet) { setFormError('请选择已解析成功的表格和工作表。'); return }
    if (!draft.metric.trim() || !draft.scope_description.trim()) { setFormError('请填写指标名称与统计范围说明。'); return }
    if (!draft.null_policy || !draft.confirmed) { setFormError('需要确认：请选择空值处理方式，核对条件与精度，并勾选统计口径确认。'); return }
    if ([...draft.scope, ...draft.numerator].some(item => !item.column_id || !item.value.trim()) || draft.operation === 'ratio' && !draft.numerator.length) { setFormError('请补全字段与等值条件；比例计算至少需要一个分子条件。'); return }
    setBusy(true); setFormError('')
    try {
      const { group_by: _group, group_null_policy: _policy, null_fields: _nullFields, ...manualDraft } = draft as Draft & {group_by?:string;group_null_policy?:string;null_fields?:string[]}
      const result = await api<CalculationRun>(`/projects/${projectId}/runs`, { method: 'POST', body: JSON.stringify({ ...manualDraft, context_hash: bundle.context_hash }) })
      setSelectedRun(result); setHistoryOffset(0); setHistoryAttempt(value => value+1)
    } catch (cause) { setFormError((cause as Error).message) }
    finally { setBusy(false) }
  }
  if (!bundle) return error ? <RequestError message={error} retry={() => void load()} /> : <div className="work-loading" role="status">正在读取项目与计算条件…</div>
  return <><div className="materials-heading"><div><h1>数据分析</h1><p>{bundle.project.name}<span>·</span>手动确认条件的真实记录统计与证据</p></div><a className="button button-secondary small" href="#calculation-history">历史计算<Icon name="down" /></a></div>
    <p className="calc-boundary"><Icon name="info" />按你确认的字段和条件执行后台统计。单位为记录／行；不去重，不调用 AI。</p>{error && <RequestError message={error} retry={() => { void load(); refreshRun() }} />}
    {!tables.length && <div className="calc-warning">当前没有可计算的表格。请到<a href={`/app/projects/${projectId}/materials`}>资料与口径</a>上传 CSV／XLSX 并等待解析完成。</div>}
    <div className="calculation-layout"><section className="calc-card calc-settings"><div className="calc-card-heading"><div><p className="calc-step">01 · 确认统计口径</p><h2>从明确条件开始。</h2></div></div><form onSubmit={execute}><fieldset disabled={busy}><label className="work-field">表格资料<select aria-label="表格资料" value={draft.asset_id} onChange={event => edit({ asset_id: event.target.value, sheet_id: '', scope: [], numerator: [] })}><option value="">选择已上传的表格</option>{tables.map(asset => <option value={asset.id} key={asset.id}>{asset.name}</option>)}</select></label><label className="work-field">计算工作表<select aria-label="计算工作表" value={draft.sheet_id} disabled={!table} onChange={event => edit({ sheet_id: event.target.value, scope: [], numerator: [] })}><option value="">请选择工作表</option>{table?.summary.sheets?.map(item => <option value={item.id} key={item.id}>{item.name} · {item.row_count} 条记录</option>)}</select></label>{sheet && <p className="calc-help">后台读取完整 {sheet.row_count} 条记录，不受预览分页影响。重复表头按列位置区分。</p>}
    <label className="work-field">计算操作<select aria-label="计算操作" value={draft.operation} onChange={event => edit({ operation: event.target.value as Draft['operation'] })}><option value="ratio">条件记录数 ÷ 范围内记录数</option><option value="count">按条件统计记录数</option></select></label><label className="work-field">指标名称<input value={draft.metric} maxLength={120} placeholder="为本次统计命名" onChange={event => edit({ metric: event.target.value })} /></label><label className="work-field">统计范围说明<textarea rows={2} maxLength={1000} value={draft.scope_description} placeholder="说明对象、期间与统计范围" onChange={event => edit({ scope_description: event.target.value })} /></label>
    <CalculationConditions title="范围" help="所有条件以“并且”组合。不添加条件表示全表范围。" columns={sheet?.columns ?? []} items={draft.scope} onChange={items => setConditions('scope', items)} disabled={!sheet || busy} /><CalculationConditions title={draft.operation === 'ratio' ? '分子' : '计数'} help={draft.operation === 'ratio' ? '只在已纳入分母的记录中继续筛选。' : '只在统计范围中计数；不添加表示统计范围内全部记录。'} columns={sheet?.columns ?? []} items={draft.numerator} onChange={items => setConditions('numerator', items)} disabled={!sheet || busy} />
    <label className="work-field">条件字段空值处理<select aria-label="条件字段空值处理" value={draft.null_policy} onChange={event => edit({ null_policy: event.target.value as Draft['null_policy'] })}><option value="">请明确选择</option><option value="exclude">排除：任一条件字段空值的记录</option><option value="keep">保留：空值不匹配非空等值条件</option><option value="block">暂停：存在空值时不产出数值</option></select></label><p className="calc-help">空值包括 null、空字符串及纯空白。检查范围和分子所用的全部字段，不自动填补。文本按原文相等；数值方式显式比较数字及数字文本。</p><label className="work-field">百分比显示与比较精度<select aria-label="百分比显示与比较精度" value={draft.precision} onChange={event => edit({ precision: Number(event.target.value) })}>{Array.from({ length: 7 }, (_, i) => <option value={i} key={i}>{i} 位小数</option>)}</select></label><label className="calc-confirm"><input type="checkbox" checked={draft.confirmed} onChange={event => setDraft(current => ({ ...current, confirmed: event.target.checked }))} /><span>我已确认字段、范围、条件、空值处理和精度；按记录／行统计，不去重。</span></label><p className="calc-help">任何设置变更后需重新确认。比例计算的分子不能为空；空范围条件代表全表。</p>{formError && <RequestError message={formError} />}<button className="button button-primary calc-run-button" disabled={busy || !tables.length}>{busy ? '正在计算并保存…' : '运行计算并保存'}<Icon name="arrow" /></button></fieldset></form><button className="reload-calculation" onClick={() => { edit({}); void load(); refreshRun(); setHistoryAttempt(value => value+1) }} disabled={busy}>重新载入当前资料与口径</button></section>
    {run ? <><Results run={run} settingsDiffer={settingsDiffer} onReuse={() => { setDraft({ ...run.spec, confirmed: false }); void load() }} />{(run as GroupRun).result.groups?<AnalysisSavedGroups key={run.id} run={run as GroupRun}/>:<CalculationEvidence run={run} key={`evidence-${run.id}`} />}<NumericConclusionCheck run={run} reports={reports} key={`check-${run.id}`} onSaved={() => { refreshRun(); setHistoryAttempt(value => value+1) }} /></> : <section className="calc-card calculation-empty"><span className="empty-icon"><Icon name="chart" /></span><h2>先确认条件，再让数字说话。</h2><p>选择表格与字段，明确范围和空值处理。<br />计算后，这里会显示真实结果、公式和原始行。</p><span>已有记录可从下方历史入口打开。</span></section>}
    <section className="calc-card calculation-history" id="calculation-history"><div className="calc-card-heading"><div><p className="calc-step">项目公共入口 · 已保存历史</p><h2>保留每一次计算的依据。</h2></div><span>{history?.total ?? '—'} 次运行</span></div><p className="calc-help">每次运行独立保存。资料或口径变化时旧运行会标为待重新计算，不覆盖旧证据；本页尚无历史版本差异视图。</p>{historyError ? <RequestError message={historyError} retry={() => setHistoryAttempt(value => value+1)} /> : !history ? <p className="calc-loading">正在加载历史…</p> : !history.total ? <p className="calc-empty-small">还没有运行记录，完成第一次计算后会保存在这里。</p> : <><div className="calculation-history-list">{history.items.map(item => <button className={item.id === run?.id ? 'selected' : ''} key={item.id} disabled={opening || busy} onClick={() => void openRun(item.id)}><span><strong>{item.spec.metric}</strong><small>{item.source.name} · {item.source.sheet_name} · {displayDate(item.created_at)}</small></span><span><b>{item.result.display_value ?? '—'}{item.result.display_value === null ? '' : item.spec.operation === 'ratio' ? '%' : ' 条'}</b><small className={`state-${item.status}`}>{calculationStatus[item.status]}</small></span><Icon name="arrow" /></button>)}</div><div className="calc-pagination"><span>第 {historyOffset+1}–{Math.min(historyOffset+10, history.total)} 条</span><div><button disabled={!historyOffset} onClick={() => setHistoryOffset(value => value-10)}>上一组运行</button><button disabled={historyOffset+10 >= history.total} onClick={() => setHistoryOffset(value => value+10)}>下一组运行</button></div></div></>}</section>
    </div>
  </>
}

export function CalculationsPage({ projectId }: { projectId: string }) { const manual=location.pathname.endsWith('/calculations')||new URLSearchParams(location.search).has('run');return <WorkShell project>{() => <><nav className="analysis-tabs" aria-label="数据分析方式"><a aria-current={!manual?'page':undefined} href={`/app/projects/${projectId}/analysis`}>对话与分组分析</a><a aria-current={manual?'page':undefined} href={`/app/projects/${projectId}/calculations`}>手动计算与原历史</a></nav>{manual?<Calculations projectId={projectId}/>:<AnalysisWorkspace projectId={projectId}/>}</>}</WorkShell> }
