import { useCallback, useEffect, useState } from 'react'
import type { Asset, Preview, Project } from '../api'
import { api, displayDate } from '../api'
import type { AIConfig, AIPlan, AITask } from '../aiTypes'
import { aiBusy, aiStatus } from '../aiTypes'
import { calculationStatus, conditionText, nullPolicyLabel } from '../calculationTypes'
import { WorkShell, RequestError } from '../components/WorkShell'
import { PlanFields, PlanRuleCheck, RuleComparison, RuleSetup, RuleStatus } from '../components/RuleConstraints'
import { CalculationEvidence } from '../components/CalculationEvidence'
import { RuleRetrievalEvidence } from '../components/RuleRetrievalEvidence'

function PlanEditor({ task, tables, busy, submit, onBound }: { task: AITask; tables: Asset[]; busy: boolean; submit: (body: unknown) => Promise<void>; onBound: (task: AITask) => void }) {
  const candidate = task.payload.candidates?.[task.payload.selected ?? 0]
  const [plan, setPlan] = useState<AIPlan>(task.payload.draft_plan ?? task.payload.plan ?? { asset_id: '', sheet_id: '', operation: 'ratio', metric: candidate?.metric ?? '',
    scope_description: candidate?.scope ?? '', scope: [], numerator: [], null_policy: 'block', precision: 0, confirmed: false, context_hash: task.context_hash })
  const [resolution, setResolution] = useState('')
  const [ruleIds, setRuleIds] = useState<string[]>(task.payload.citation_ids ?? [])
  const [rulesConfirmed, setRulesConfirmed] = useState(false)
  const [checkedPlan, setCheckedPlan] = useState('')
  const table = tables.find(item => item.id === plan.asset_id)
  const sheet = table?.summary.sheets?.find(item => item.id === plan.sheet_id)
  function edit(patch: Partial<AIPlan>) { setCheckedPlan(''); setPlan(value => ({ ...value, ...patch, confirmed: false })) }
  return <><RuleSetup task={task} tables={tables} onBound={onBound} /><form onSubmit={event => { event.preventDefault(); void submit({ plan, resolution, citation_ids: ruleIds, rules_confirmed: rulesConfirmed, rule_snapshot_id: task.payload.rule_snapshot?.id, reported_value: candidate?.reported_value }) }} className="ai-plan-editor">
    <p className="calc-step">03 · 检查方案并确认</p><h2>先确认这条结论的依据。</h2>
    <p className="ai-plan-explanation">AI 方案建议（尚未核验）：{task.payload.explanation || 'AI 未能确定全部字段，请手动补全；仍需引用实际统计规则。'}</p>
    <div className="ai-plan-summary"><p><b>指标</b>{plan.metric || '待确定'}</p><p><b>统计范围</b>{plan.scope_description || '待确定'}</p><p><b>分母</b>{conditionText(plan.scope, sheet?.columns ?? [])}</p><p><b>分子</b>{conditionText(plan.numerator, sheet?.columns ?? [])}</p><p><b>空值与精度</b>{nullPolicyLabel[plan.null_policy]} · {plan.precision} 位小数</p><p><b>数据来源</b>{table?.name ?? '待选择'} / {sheet?.name ?? '待选择工作表'} · {sheet?.row_count ?? '—'} 条记录</p></div>
    {!!task.payload.questions?.length && <div className="calc-warning"><b>以下事项需要具体确认</b><ul>{task.payload.questions.map((q, i) => <li key={i}>{q}</li>)}</ul></div>}
    <fieldset className="ai-rule-choice"><legend>本次采用的真实规则</legend>{task.payload.citations?.map(c => <label key={c.citation_id}><input type="checkbox" checked={ruleIds.includes(c.citation_id)} onChange={event => { setRuleIds(ids => event.target.checked ? [...ids, c.citation_id] : ids.filter(id => id !== c.citation_id)); setRulesConfirmed(false); edit({}) }} /><span><b>{c.name} · {c.location}</b>{c.text}</span></label>)}</fieldset>
    <label className="calc-confirm"><input type="checkbox" checked={rulesConfirmed} onChange={event => { setRulesConfirmed(event.target.checked); edit({}) }} /><span>我已核对所选规则。存在冲突时必须修正方案，或明确保存新规则快照；确认说明不能绕过规则检查。</span></label>
    <PlanRuleCheck task={task} tables={tables} plan={plan} onChecked={check => { setCheckedPlan(!check.conflicts.length && check.status !== 'stale' && !!task.payload.rule_snapshot ? JSON.stringify({ ...plan, confirmed: false }) : ''); setPlan(p => ({ ...p, confirmed: false })) }} />
    <details className="ai-adjustments"><summary>手动调整最终方案的字段、条件与精度</summary><PlanFields plan={plan} tables={tables} edit={edit} disabled={busy} /></details>
    <label className="work-field">确认说明{task.payload.questions?.length ? '（必填）' : '（选填）'}<textarea aria-label="确认说明" value={resolution} required={!!task.payload.questions?.length} maxLength={1500} placeholder="例如：已核对规则第1段，以有效记录为分母；采用保留空值，按记录统计。请写实际处理依据。" onChange={event => { setResolution(event.target.value); setPlan(p => ({ ...p, confirmed: false })) }} /></label>
    <label className="calc-confirm"><input type="checkbox" checked={plan.confirmed} onChange={event => setPlan(value => ({ ...value, confirmed: event.target.checked }))} /><span>我已核对原文 {candidate?.reported_value}%、规则、字段、范围、空值和精度。仅核验这一条记录占比，不表示整篇报告通过。</span></label>
    <button className="button button-primary calc-run-button" disabled={busy || checkedPlan !== JSON.stringify({ ...plan, confirmed: false }) || !plan.confirmed || !rulesConfirmed || !ruleIds.length || !sheet || !plan.numerator.length}>确认方案，执行真实计算</button><p className="calc-help">修改设置后需要重新确认。已保存且未变化的方案在失败重试时直接复用，不重复要求确认。</p>
  </form></>
}

function TaskEvidence({ task }: { task: AITask }) {
  const [tab, setTab] = useState('comparison')
  const run = task.run
  const check = task.check
  const citations = task.payload.citations ?? []
  return <div className="ai-evidence"><div className="ai-tabs" role="tablist" aria-label="核验证据">{[['comparison', '比较结果'], ['rows', '原始数据'], ['rules', '规则原文']].map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} id={`ai-tab-${value}`} aria-controls="ai-evidence-panel" onClick={() => setTab(value)}>{label}</button>)}</div>
    <div role="tabpanel" id="ai-evidence-panel" aria-labelledby={`ai-tab-${tab}`}>
    {tab === 'comparison' && (check && run ? <><div className={`ai-result state-${check.status}`}><span>{calculationStatus[check.status]}</span><strong>{check.result.calculated_value ?? '—'}<small>%</small></strong><p>{check.result.message}</p></div>
      <dl className="ai-comparison"><div><dt>报告值</dt><dd>{check.result.reported_value}%</dd></div><div><dt>计算值</dt><dd>{check.result.calculated_value ?? '—'}%</dd></div><div><dt>计算值 − 报告值</dt><dd>{check.result.difference_pp ?? '—'} <small>个百分点</small></dd></div></dl>
      <p className="ai-formula">{run.result.numerator} ÷ {run.result.denominator} × 100% = {run.result.display_value ?? '未产出有效值'}{run.result.display_value !== null ? '%' : ''}</p>
      <p className="calc-help">完整工作表 {run.result.total} 条；分母 {run.result.included} 条；排除 {run.result.excluded} 条。单位：记录／行，不去重。空值 {run.result.null_rows} 条；数值字段未匹配 {run.result.numeric_unmatched_rows} 条。</p>
      <p className="calc-help">{check.result.comparison_rule}</p><details className="calculation-details"><summary>查看已确认方案、公式及未舍入值</summary><div className="ai-plan-summary"><p>{conditionText(run.spec.scope, run.source.columns)}</p><p>分子：{conditionText(run.spec.numerator, run.source.columns)}</p><p>{nullPolicyLabel[run.spec.null_policy]}；{run.spec.precision} 位小数</p><p>未舍入值：<code>{run.result.unrounded_decimal ?? '无有效值'}</code></p><p>精确分数：{JSON.stringify(run.result.exact_fraction)}</p><p>来源：{run.source.name} / {run.source.sheet_name}</p><code>{run.source.source_id}</code><p>方法：{run.method_version}</p><p>人工确认依据：{task.payload.resolution || '无补充'}</p><p>原报告：{check.report.paragraph.text}</p></div></details>
      <a className="button button-primary small" href={`/app/projects/${task.project_id}/review?check=${check.id}`}>去修订这条原句 ↗</a><a className="text-link" href={`/app/projects/${task.project_id}/calculations?run=${run.id}`}>在原有计算历史中查看本次运行与核验 ↗</a></> : <div className="ai-empty-result"><h3>核验结果将在计算后出现</h3><p>{task.payload.message || '选择一条陈述，检查规则与方案后，后台才会计算并比较。人工确认本身不代表核验通过。'}</p></div>)}
    {tab === 'rows' && (run ? <CalculationEvidence run={run} key={run.id} /> : <p className="calc-empty-small">尚未运行计算，没有可展示的原始行证据。</p>)}
    {tab === 'rules' && <RuleRetrievalEvidence projectId={task.project_id} citations={citations} retrieval={task.payload.retrieval} selected={task.payload.citation_ids}/>}
    </div>
  </div>
}

function AIVerification({ projectId }: { projectId: string }) {
  const [bundle, setBundle] = useState<{ project: Project; assets: Asset[]; config: AIConfig; roles: string[] } | null>(null)
  const [reportId, setReportId] = useState('')
  const [paragraphId, setParagraphId] = useState('')
  const [offset, setOffset] = useState(0)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [excerpt, setExcerpt] = useState('')
  const [task, setTask] = useState<AITask | null>(null)
  const [resume, setResume] = useState<AITask[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [consent, setConsent] = useState(false)
  const load = useCallback(() => {
    return Promise.all([api<Project>(`/projects/${projectId}`), api<Asset[]>(`/projects/${projectId}/assets`), api<AIConfig>('/ai/config'), api<string[]>(`/projects/${projectId}/rule-materials`), api<{ items: AITask[] }>(`/projects/${projectId}/ai-tasks?limit=10`)]).then(([project, assets, config, roles, tasks]) => {
      setBundle({ project, assets, config, roles }); setResume(tasks.items); setError(''); document.title = `${project.name} · AI 辅助核验 · 数有依据`
    }).catch(cause => setError((cause as Error).message))
  }, [projectId])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('task')
    if (!id) return
    const controller = new AbortController()
    api<AITask>(`/ai-tasks/${encodeURIComponent(id)}`, { signal: controller.signal }).then(value => {
      if (value.project_id !== projectId) throw new Error('任务不属于此项目。')
      setTask(value)
    }).catch(cause => { if (!controller.signal.aborted) setError((cause as Error).message) })
    return () => controller.abort()
  }, [projectId])
  useEffect(() => {
    if (!reportId) return
    const controller = new AbortController()
    api<Preview>(`/assets/${reportId}/preview?offset=${offset}&limit=20`, { signal: controller.signal }).then(setPreview)
      .catch(cause => { if (!controller.signal.aborted) setError((cause as Error).message) })
    return () => controller.abort()
  }, [reportId, offset])
  useEffect(() => {
    if (!task || !aiBusy.has(task.status)) return
    const controller = new AbortController()
    const timer = window.setInterval(() => {
      api<AITask>(`/ai-tasks/${task.id}`, { signal: controller.signal }).then(setTask)
        .catch(cause => { if (!controller.signal.aborted) setError((cause as Error).message) })
    }, 1200)
    return () => { window.clearInterval(timer); controller.abort() }
  }, [task])
  useEffect(() => {
    const refresh = () => {
      void load()
      if (task) void api<AITask>(`/ai-tasks/${task.id}`).then(setTask).catch(cause => setError((cause as Error).message))
    }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [load, task])
  const reports = bundle?.assets.filter(a => a.kind === 'report' && a.status === 'ready') ?? []
  const tables = bundle?.assets.filter(a => a.kind === 'table' && a.status === 'ready') ?? []
  const paragraph = preview?.paragraphs?.find(p => p.id === paragraphId)
  const running = !!task && aiBusy.has(task.status)
  function selectTask(value: AITask) { setTask(value); window.history.replaceState(null, '', window.location.pathname + '?task=' + value.id) }
  async function perform(path: string, body?: unknown) {
    if (busy) return
    setBusy(true); setError('')
    try { const value = await api<AITask>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }); selectTask(value); await load() }
    catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }
  async function toggleRole(id: string, enabled: boolean) {
    setBusy(true)
    try { await api(`/projects/${projectId}/rule-materials/${id}`, { method: 'PUT', body: JSON.stringify({ enabled }) }); await load(); if (task) setTask(await api<AITask>(`/ai-tasks/${task.id}`)) }
    catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }
  if (!bundle) return error ? <RequestError message={error} retry={() => void load()} /> : <p className="work-loading">正在读取项目与模型配置…</p>
  return <><div className="materials-heading"><div><a className="material-back" href={`/app/projects/${projectId}/materials`}>← 资料与口径</a><h1>结论核验</h1><p>{bundle.project.name}<span>·</span>AI 辅助核验 · 一次核验一条百分比结论</p></div><a className="button button-secondary small" href={`/app/projects/${projectId}/calculations#calculation-history`}>计算与核验历史 ↗</a></div>
    <div className={`ai-service-banner ${bundle.config.configured ? '' : 'unconfigured'}`}><b>{bundle.config.test_mode ? '模拟模型验收 · 未调用真实 AI' : bundle.config.configured ? '模型配置已读取 · 真实连通性以本次调用结果为准' : '真实 AI 尚未接通'}</b><p>{bundle.config.configured ? `${bundle.config.provider} · ${bundle.config.model} · ${bundle.config.region}` : `后台缺少：${bundle.config.missing.join('、') || bundle.config.configuration_error}`}</p><p>核验会将必要的报告片段、字段及少量示例值、相关规则发送到百炼模型服务。计算和数字比较在后台完成。每任务最多 {bundle.config.max_requests} 次模型请求，失败重试也计入；不支持整篇报告自动通过。</p>{!bundle.config.configured && <p>请按项目 AI_PREVIEW.md 在本机 backend/.env 配置后重启后台。手动核验仍可使用。</p>}</div>
    {error && <RequestError message={error} retry={() => void load()} />}
    <div className="ai-workspace"><section className="calc-card ai-source" aria-label="报告原文"><p className="calc-step">01 · 报告与规则</p><h2>选择需要核验的原文</h2>
      {task && <details className="ai-saved-source" open><summary>当前任务的报告原句 · 保存快照</summary><blockquote className="ai-source-quote">{(() => { const quote = task.payload.candidates?.[task.payload.selected ?? -1]?.quote; const text = task.source.excerpt; if (!quote || !text.includes(quote)) return text; const index = text.indexOf(quote); return <>{text.slice(0, index)}<mark>{quote}</mark>{text.slice(index+quote.length)}</> })()}</blockquote><a className="ai-source-location" href={`/app/projects/${projectId}/materials?asset=${task.source.asset_id}&paragraph=${encodeURIComponent(task.source.paragraph.id)}&offset=${Math.floor(task.source.paragraph_index/50)*50}`}>{task.source.name} · {task.source.paragraph.location} ↗</a></details>}
      <label className="work-field">报告资料<select aria-label="报告资料" value={reportId} disabled={running || busy} onChange={event => { if (event.target.value === reportId) return; setReportId(event.target.value); setParagraphId(''); setPreview(null); setOffset(0); setExcerpt('') }}><option value="">选择 DOCX 或已保存文本</option>{reports.filter(a => !bundle.roles.includes(a.id)).map(a => <option value={a.id} key={a.id}>{a.name}</option>)}</select></label>
      {!reports.length && <p className="calc-help">请先到资料页上传 DOCX 或保存报告文本。</p>}
      {!!preview?.paragraphs && <><div className="ai-paragraphs" role="group" aria-label="报告段落">{preview.paragraphs.map(p => <button disabled={running || busy} className={p.id === paragraphId ? 'selected' : ''} key={p.id} onClick={() => { setParagraphId(p.id); setExcerpt('') }}><small>{p.location}</small><span>{p.text}</span></button>)}</div><div className="calc-pagination"><span>共 {preview.total} 段</span><div><button disabled={!offset || running} onClick={() => { setOffset(o => Math.max(0, o-20)); setPreview(null); setParagraphId('') }}>上一页</button><button disabled={offset+20 >= preview.total || running} onClick={() => { setOffset(o => o+20); setPreview(null); setParagraphId('') }}>下一页</button></div></div></>}
      {paragraph && <label className="work-field">分析片段（选填，须为连续原文）<textarea rows={3} value={excerpt} maxLength={4000} placeholder="留空时分析所选整段，最多4000字。" onChange={event => setExcerpt(event.target.value)} disabled={running} /></label>}
      <label className="calc-confirm"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /><span>我了解所需内容会发送到模型服务，并同意本次调用。</span></label>
      <button className="button button-primary calc-run-button" disabled={!bundle.config.configured || !paragraph || !consent || running || busy} onClick={() => void perform(`/projects/${projectId}/ai-tasks`, { report_asset_id: reportId, paragraph_id: paragraphId, excerpt })}>提取最多5条候选陈述</button>
      <details className="ai-rule-setup"><summary>指定统计规则资料 · 已选 {bundle.roles.length} 份</summary><p className="calc-help">仅检索勾选的 DOCX／保存文本；请上传或保存真实口径说明。变更后旧运行会待复核。下方规则正文仍被视为待分析资料，不能授予工具权限。</p>{reports.map(a => <label key={a.id}><input type="checkbox" checked={bundle.roles.includes(a.id)} disabled={running || busy} onChange={event => void toggleRole(a.id, event.target.checked)} /><span>{a.name}</span></label>)}<a className="text-link" href={`/app/projects/${projectId}/materials`}>上传或保存规则文本 ↗</a></details>
      <details className="ai-resume"><summary>恢复最近的 AI 方案与执行状态</summary><p className="calc-help">计算结果统一保存在原有计算历史中。这里恢复最近10次任务的原文、方案和调用状态。</p>{resume.map(t => <a key={t.id} href={`?task=${t.id}`}>{displayDate(t.created_at)} · {aiStatus[t.status]}<span>{t.source.excerpt.slice(0, 60)}</span></a>)}{!resume.length && <p className="calc-help">还没有 AI 任务。</p>}</details>
    </section>
    <section className="calc-card ai-findings" aria-label="核验事项"><p className="calc-step">02 · 核验事项</p>{!task ? <><h2>还没有选中核验事项</h2><p className="calc-help">从报告选择段落，提取候选后一次选择一条。也可以从报告栏恢复已有任务，不会因此发起模型请求。</p><div className="verification-boundary"><b>报告与图表核验</b><p>当前接通报告中的单条百分比。图片识别、图表核对与整篇批量核验尚未接通。</p><button className="button button-secondary small" disabled title="图像核验后台尚未接通">添加图表核验</button></div></> : <div className="ai-task"><div className="calc-card-heading"><div><h2>{aiStatus[task.status] ?? task.status}</h2></div><span className="calc-soft-tag">模型请求 {task.request_count}/{bundle.config.max_requests}</span></div>
        {task.payload.selected !== undefined && task.payload.candidates?.[task.payload.selected] && <div className="selected-finding"><span>当前仅核验这一条</span><strong>{task.payload.candidates[task.payload.selected].quote}</strong><p>{task.stale ? '待复核' : task.check ? calculationStatus[task.check.status] : '尚未产生数字比较结果'}</p><a href="#verification-evidence">查看证据 ↓</a></div>}
        {task.stale && <p className="calc-warning">资料、规则或口径已变化。下方为历史快照，需要基于当前资料重新提取并核验，旧结果未被覆盖。</p>}
        {task.error && <div className="work-error" role="alert">{task.error}</div>}
        {task.payload.message && <p className="calc-warning">{task.payload.message}</p>}
        {running && <p role="status" className="ai-live-status">{aiStatus[task.status]}… 已完成的阶段会保存。这里不展示模型内部思考或虚构进度。</p>}
        {task.status === 'candidates' && <div className="ai-candidates">{task.payload.candidates?.map((c, index) => <button disabled={busy} key={index} onClick={() => void perform(`/ai-tasks/${task.id}/choose`, { index })}><span>候选 {index+1} · {c.unit === 'percentage_point' ? '百分点' : c.unit === 'decimal' ? '原文小数' : '百分比'}</span><b>{c.quote}</b><small>{c.metric} · {c.scope || '范围待确认'}</small><em>{c.supported ? '选择这一条，检索规则与生成方案 →' : c.reason}</em></button>)}</div>}
        {['extracting', 'searching', 'planning', 'calculating', 'candidates', 'awaiting_confirmation', 'failed'].includes(task.status) && <div className="ai-task-actions">{task.status === 'failed' && <button className="button button-secondary small" disabled={busy || task.request_count >= bundle.config.max_requests} onClick={() => void perform(`/ai-tasks/${task.id}/retry`)}>重试本阶段</button>}<button disabled={busy} onClick={() => void perform(`/ai-tasks/${task.id}/cancel`)}>取消任务</button></div>}
        {task.status === 'cancelled' && <p className="calc-help">取消后不再继续工具步骤；已发出的模型请求可能仍计费。可以重新选择片段开始新任务。</p>}
      </div>}</section>
    <div className="ai-right" aria-label="核验方案与证据">{!task ? <section className="calc-card ai-welcome"><p className="calc-step">03 → 04 · 方案与证据</p><h2>从一句话，到可以复核的证据。</h2><p>选择原文 → 提取陈述 → 检索规则<br />检查方案 → 确认后计算 → 比较并保存</p><div>AI 负责建议<br /><b>数字由真实数据计算，口径由你确认。</b></div><a className="text-link" href={`/app/projects/${projectId}/calculations`}>也可以直接使用手动计算与核验 ↗</a></section> : <>
      {task.status === 'awaiting_confirmation' && <section className="calc-card"><PlanEditor task={task} tables={tables} busy={busy} submit={body => perform(`/ai-tasks/${task.id}/confirm`, body)} onBound={selectTask} key={task.id+(task.payload.rule_snapshot?.id ?? "unbound")} /></section>}
      {task.status !== 'awaiting_confirmation' && <section className="calc-card">{task.payload.rule_snapshot && (task.payload.confirmed_plan || task.payload.draft_plan || task.payload.plan) ? <RuleComparison task={task} tables={tables} plan={(task.payload.confirmed_plan ?? task.payload.draft_plan ?? task.payload.plan)!} check={task.rule_check} /> : <RuleStatus check={task.rule_check} />}{task.status === 'stale' && task.payload.plan && !task.run_id && task.rule_check.status !== 'legacy' && <RuleSetup task={task} tables={tables} onBound={selectTask} />}</section>}
      <section className="calc-card ai-evidence-card" id="verification-evidence"><p className="calc-step">04 · 可追溯的结论</p><TaskEvidence task={task} key={task.id} /></section>
      <details className="calc-card ai-audit"><summary>本次真实调用摘要与保存信息</summary><p className="calc-help">{task.payload.model.model} · {task.payload.model.region} · 提示词 {task.payload.prompt_version}<br />开始 {displayDate(task.created_at)}；最近更新 {displayDate(task.updated_at)}<br />工具调用 {task.tool_count}/{bundle.config.max_tool_calls}。仅显示实际返回和执行的事件，不展示模型内部推理。</p>{task.trace.map((t, i) => <div key={i}><b>{t.event === 'model_response' ? '模型响应' : t.event === 'tool_result' ? '工具计算结果' : `调用 ${t.name}`}</b><small>{displayDate(t.at)}</small><pre>{JSON.stringify(t.summary ?? t.usage ?? t.result, null, 2)}</pre></div>)}<code>{task.id}</code></details>
    </>}</div></div>
  </>
}

export function AIVerificationPage({ projectId }: { projectId: string }) { return <WorkShell project>{() => <AIVerification projectId={projectId} />}</WorkShell> }
