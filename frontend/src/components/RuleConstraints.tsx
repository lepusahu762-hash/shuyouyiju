import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Asset } from '../api'
import type { AIPlan, AITask, RuleCheck, RuleSnapshot, RuleSpec } from '../aiTypes'
import { conditionText, nullPolicyLabel } from '../calculationTypes'
import { CalculationConditions } from './CalculationConditions'


type RuleTask = Pick<AITask,'id'|'project_id'|'context_hash'|'rule_check'> & {payload:Pick<AITask['payload'],'plan'|'rule_snapshot'|'plan_revisions'|'citations'> & {draft_plan?:AIPlan|null}}

const ruleFields: [keyof RuleSpec, string][] = [['asset_id', '表格资料'], ['sheet_id', '工作表'], ['operation', '计算类型'], ['metric', '指标'], ['scope_description', '统计范围说明'], ['scope', '分母／范围条件'], ['numerator', '分子条件'], ['null_policy', '空值策略'], ['precision', '显示及比较精度']]
function ruleValue(key: keyof RuleSpec, value: unknown, tables: Asset[], spec?: RuleSpec) {
  const table = tables.find(t => t.id === spec?.asset_id)
  const sheet = table?.summary.sheets?.find(s => s.id === spec?.sheet_id)
  if (value === undefined || value === null) return '未提供'
  if (key === 'null_policy') return nullPolicyLabel[value as AIPlan['null_policy']]
  if (key === 'precision') return `${value} 位小数`
  if (key === 'operation') return value === 'ratio' ? '分子 ÷ 分母的记录占比' : '记录计数'
  if (key === 'asset_id') return tables.find(t => t.id === value)?.name ?? String(value)
  if (key === 'sheet_id') return table?.summary.sheets?.find(s => s.id === value)?.name ?? String(value)
  if (key === 'scope' || key === 'numerator') return conditionText(value as AIPlan['scope'], sheet?.columns ?? [])
  return String(value)
}

export function PlanFields({ plan, tables, edit, disabled }: { plan: AIPlan; tables: Asset[]; edit: (patch: Partial<AIPlan>) => void; disabled: boolean }) {
  const table = tables.find(t => t.id === plan.asset_id)
  const sheet = table?.summary.sheets?.find(s => s.id === plan.sheet_id)
  return <fieldset disabled={disabled} className="rule-plan-fields">
    <label className="work-field">表格资料<select value={plan.asset_id} onChange={e => edit({ asset_id: e.target.value, sheet_id: '', scope: [], numerator: [] })}><option value="">请选择</option>{tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    <label className="work-field">工作表<select value={plan.sheet_id} onChange={e => edit({ sheet_id: e.target.value, scope: [], numerator: [] })}><option value="">请选择</option>{table?.summary.sheets?.map(s => <option value={s.id} key={s.id}>{s.name} · {s.row_count} 条</option>)}</select></label>
    <label className="work-field">计算类型<select value={plan.operation} onChange={e => edit({ operation: e.target.value as AIPlan['operation'] })}><option value="ratio">记录占比</option><option value="count">记录计数</option></select></label>
    <label className="work-field">指标<input value={plan.metric} maxLength={120} onChange={e => edit({ metric: e.target.value })} /></label>
    <label className="work-field">范围说明<textarea value={plan.scope_description} maxLength={1000} onChange={e => edit({ scope_description: e.target.value })} /></label>
    <CalculationConditions title="范围" help="并且组合；没有条件表示全表，仍须明确确认。" columns={sheet?.columns ?? []} items={plan.scope} onChange={scope => edit({ scope })} disabled={disabled || !sheet} />
    <CalculationConditions title="分子" help="只在分母范围内筛选。" columns={sheet?.columns ?? []} items={plan.numerator} onChange={numerator => edit({ numerator })} disabled={disabled || !sheet} />
    <label className="work-field">空值处理<select value={plan.null_policy} onChange={e => edit({ null_policy: e.target.value as AIPlan['null_policy'] })}>{Object.entries(nullPolicyLabel).map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select></label>
    <label className="work-field">显示与比较精度<select value={plan.precision} onChange={e => edit({ precision: Number(e.target.value) })}>{Array.from({ length: 7 }, (_, i) => <option key={i} value={i}>{i} 位小数</option>)}</select></label>
  </fieldset>
}

export function RuleStatus({ check }: { check: RuleCheck }) {
  const labels = { legacy: '历史兼容 · 未执行新版检查', needs_confirmation: '待确认', stale: '已过期 · 重新检查', conflict: '存在冲突 · 已阻止执行', confirmed: '已确认' }
  return <div className={`rule-status rule-${check.status}`} role="status"><b>{labels[check.status]}</b><p>{check.message}</p></div>
}

export function RuleComparison({ task, plan, check, tables }: { task: RuleTask; plan: AIPlan; check: RuleCheck; tables: Asset[] }) {
  const bound = task.payload.rule_snapshot
  if (!bound) return <RuleStatus check={check} />
  const conflicts = check.conflicts.map(c => c.field)
  function row(key: keyof RuleSpec, label: string) {
    const source = bound!.sources[key]
    return <article className={`rule-compare-row ${conflicts.includes(key) ? 'has-conflict' : ''}`} key={key}>
      <b>{label}{conflicts.includes(key) && <span>冲突</span>}</b><div className="rule-three-values">
        <div><small>规则要求</small><p>{ruleValue(key, bound!.constraints[key], tables, bound!.constraints)}</p></div>
        <div><small>AI 原建议</small><p>{ruleValue(key, task.payload.plan?.[key], tables, task.payload.plan ?? undefined)}</p></div>
        <div><small>最终方案</small><p>{ruleValue(key, plan[key], tables, plan)}</p></div></div>
      <details open={conflicts.includes(key)}><summary>规则原文 · {source.name} · {source.location}</summary><blockquote>{source.quote}</blockquote><a className="text-link" href={`/app/projects/${task.project_id}/materials?asset=${source.asset_id}&paragraph=${encodeURIComponent(source.paragraph_id)}&offset=${Math.floor(source.paragraph_index / 50) * 50}`}>定位规则来源 ↗</a></details>
    </article>
  }
  return <section className="rule-comparison"><RuleStatus check={check} /><p className="calc-help">绑定规则 v{bound.version} · {bound.change_reason}。精确比对已确认的字段、条件与口径；不自动推断规则语义。</p>
    {ruleFields.filter(([key]) => conflicts.includes(key)).map(([key, label]) => row(key, label))}
    <details className="rule-all-fields"><summary>展开{conflicts.length ? '其余' : '全部'}规则、AI 建议与最终方案</summary>{ruleFields.filter(([key]) => !conflicts.includes(key)).map(([key, label]) => row(key, label))}</details>
    <details><summary>不可变规则快照与方案修改记录</summary><p className="calc-help">快照 {bound.id}<br />指纹 {bound.fingerprint}</p>{task.payload.plan_revisions?.map((r, i) => <p key={i} className="calc-help">{r.at} · {r.event === 'bind_rule' ? '重新绑定规则，清除旧确认' : '保存方案修改'}{r.plan && ` · ${nullPolicyLabel[r.plan.null_policy]}`}</p>)}</details>
  </section>
}

export function RuleSetup<T extends RuleTask>({ task, tables, onBound, taskBase="/ai-tasks" }: { task: T; tables: Asset[]; onBound: (task: T) => void; taskBase?:string }) {
  const [head, setHead] = useState<{ items: RuleSnapshot[]; current_id: string | null; context_hash: string } | null>(null)
  const [draft, setDraft] = useState<AIPlan>({ ...(task.payload.rule_snapshot?.constraints ?? task.payload.draft_plan ?? task.payload.plan ?? { asset_id: '', sheet_id: '', operation: 'ratio', metric: '', scope_description: '', scope: [], numerator: [], null_policy: 'block', precision: 0 }), confirmed: false, context_hash: task.context_hash })
  const [sources, setSources] = useState<Record<string, string>>({})
  const [quotes,setQuotes]=useState<Record<string,string>>({})
  const [confirmed, setConfirmed] = useState<string[]>([])
  const [unresolved, setUnresolved] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { api<typeof head>(`/projects/${task.project_id}/rule-snapshots`).then(setHead).catch(e => setError(e.message)) }, [task.project_id])
  const citations = task.payload.citations ?? []
  async function bind(id: string) {
    const bound = await api<T>(`${taskBase}/${task.id}/bind-rule`, { method: 'POST', body: JSON.stringify({ snapshot_id: id }) })
    onBound(bound)
  }
  async function action(save: boolean) {
    setBusy(true); setError('')
    try {
      if (!head) throw new Error('请先读取当前规则。')
      if (!save) { if (head.current_id) await bind(head.current_id); return }
      const constraints = Object.fromEntries(ruleFields.map(([key]) => [key, draft[key]]))
      for(const [key] of ruleFields){const c=citations.find(c=>c.citation_id===sources[key]);if(c?.quote_options?.length&&!quotes[key])throw new Error('节选段落需逐项选择支持该约束的连续原文条款，不能将省略标记保存为引用。')}
      const snapshot = await api<RuleSnapshot>(`/projects/${task.project_id}/rule-snapshots`, { method: 'POST', body: JSON.stringify({
        previous_id: head.current_id, context_hash: head.context_hash, constraints,
        sources: Object.fromEntries(ruleFields.map(([key]) => { const c = citations.find(c => c.citation_id === sources[key]); return [key, { asset_id: c?.asset_id, paragraph_id: c?.citation_id, quote: c?.quote_options?.length?quotes[key]:c?.text }] })),
        confirmed_fields: confirmed, unresolved: unresolved.trim() ? [unresolved.trim()] : [], change_reason: reason,
      }) })
      setHead(await api(`/projects/${task.project_id}/rule-snapshots`))
      await bind(snapshot.id)
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }
  return <details className="rule-setup" open={!task.payload.rule_snapshot || task.rule_check.status === 'stale'}><summary>明确并保存规则约束{task.payload.rule_snapshot ? '／修改规则' : ' · 必须先完成'}</summary>
    <p className="calc-help">规则约束须由你逐项核对原文。下面预填的是未确认草稿，不代表已确认规则。有歧义或原文缺失时，先补充规则资料并重新生成方案；不能用勾选知晓绕过冲突。保存新版本将使旧确认失效。</p>
    {head?.current_id && <button type="button" className="button button-secondary small" disabled={busy} onClick={() => void action(false)}>绑定当前已确认规则，重新检查</button>}
    <fieldset disabled={busy}><PlanFields plan={draft} tables={tables} disabled={busy} edit={patch => { setDraft(p => ({ ...p, ...patch })); setConfirmed([]) }} />
      <div className="rule-confirm-fields">{ruleFields.map(([key, label]) => <div className="rule-field-confirm" key={key}>
        <b>{label}：{ruleValue(key, draft[key], tables, draft)}</b>
        <label className="work-field">{label}的原文来源<select aria-label={`${label}的原文来源`} value={sources[key] ?? ''} onChange={e => { setSources(s => ({ ...s, [key]: e.target.value })); setQuotes(s=>({...s,[key]:''})); setConfirmed(c => c.filter(k => k !== key)) }}><option value="">选择支持本项的真实规则段落</option>{citations.map(c => <option key={c.citation_id} value={c.citation_id}>{c.name} · {c.location} · {c.text}</option>)}</select></label>
        {sources[key] && <blockquote>{citations.find(c => c.citation_id === sources[key])?.text}</blockquote>}
        {!!citations.find(c=>c.citation_id===sources[key])?.quote_options?.length&&<label className="work-field">{label}的连续原文条款<select value={quotes[key]??''} aria-label={`${label}的连续原文条款`} onChange={e=>{setQuotes(s=>({...s,[key]:e.target.value}));setConfirmed(c=>c.filter(k=>k!==key))}}><option value="">请选择实际支持本项的原文，不包含省略标记</option>{citations.find(c=>c.citation_id===sources[key])?.quote_options?.map((q,i)=><option value={q} key={i}>{q}</option>)}</select></label>}
        <label className="calc-confirm"><input type="checkbox" aria-label={`确认规则${label}`} checked={confirmed.includes(key)} disabled={!sources[key]} onChange={e => setConfirmed(c => e.target.checked ? [...c, key] : c.filter(k => k !== key))} /><span>我已明确本项含义，确认此设置及对应原文。</span></label>
      </div>)}</div>
      <label className="work-field">尚未明确的规则或歧义<textarea value={unresolved} onChange={e => setUnresolved(e.target.value)} placeholder="没有待确认内容时留空；有内容则不能保存为已确认规则。" /></label>
      <label className="work-field">本次规则确认／变更依据<textarea aria-label="规则变更依据" maxLength={1500} value={reason} onChange={e => setReason(e.target.value)} placeholder="说明你如何核对原文；修改已有规则时，明确写出修改原因。" /></label>
      {error && <p className="work-error" role="alert">{error}</p>}
      <button type="button" className="button button-primary" disabled={busy || !head || confirmed.length !== ruleFields.length || !!unresolved.trim() || !reason.trim()} onClick={() => void action(true)}>{busy ? '正在保存与检查…' : '保存新规则快照并检查方案'}</button>
    </fieldset>
    {!!head?.items.length && <details><summary>已保存的规则版本（最近10版）</summary>{head.items.map(s => <p className="calc-help" key={s.id}>v{s.version} · {s.created_at} · {s.change_reason}<br />{s.id}</p>)}</details>}
  </details>
}

export function PlanRuleCheck({ task, tables, plan, onChecked, taskBase="/ai-tasks" }: { task: RuleTask; tables: Asset[]; plan: AIPlan; onChecked: (check: RuleCheck) => void; taskBase?:string }) {
  const [check, setCheck] = useState(task.rule_check)
  const [checked, setChecked] = useState(JSON.stringify({ ...plan, confirmed: false }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dirty = checked !== JSON.stringify({ ...plan, confirmed: false })
  async function inspect() {
    setBusy(true); setError('')
    try {
      const response = await api<{ rule_check: RuleCheck }>(`${taskBase}/${task.id}/plan-check`, { method: 'POST', body: JSON.stringify({ plan: { ...plan, confirmed: false } }) })
      setCheck(response.rule_check); setChecked(JSON.stringify({ ...plan, confirmed: false })); onChecked(response.rule_check)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <><RuleComparison task={task} plan={plan} check={check} tables={tables} />{dirty && <p className="calc-warning">方案已修改，上方保留上次检查结果。请重新检查后再确认。</p>}
    {error && <p className="work-error" role="alert">{error}</p>}<button type="button" className="button button-secondary rule-check-button" disabled={busy || !task.payload.rule_snapshot} onClick={() => void inspect()}>{busy ? '正在检查…' : '保存方案并检查规则'}</button></>
}
