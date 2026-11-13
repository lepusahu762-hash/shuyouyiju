import '../Review.css'
import { useCallback, useEffect, useState } from 'react'
import { api, displayDate } from '../api'
import type { NumericCheck, Page, CalculationRun } from '../calculationTypes'
import { calculationStatus, conditionText, nullPolicyLabel } from '../calculationTypes'
import type { RuleSnapshot } from '../aiTypes'
import type { ReportRevision, RevisionConfirmation, RevisionSource } from '../revisionTypes'
import { revisionAction, revisionStatus } from '../revisionTypes'
import { WorkShell, RequestError } from '../components/WorkShell'
import { CalculationEvidence } from '../components/CalculationEvidence'
import { PdfExportPanel } from '../components/PdfExportPanel'

function RuleEvidence({ rule, projectId }: { rule: RuleSnapshot | null; projectId: string }) {
  if (!rule) return <p className="calc-warning">该依据没有绑定结构化规则快照，不会补写旧历史。复核前必须有与原方案相符的当前已确认规则。</p>
  const sources = Object.values(rule.sources).filter((s, i, all) => all.findIndex(v => v.paragraph_id === s.paragraph_id && v.quote === s.quote) === i)
  return <div className="revision-rules"><p>规则快照 v{rule.version} · {displayDate(rule.created_at)}</p>{sources.map((s,i) => <article key={i}><b>{s.name} · {s.location}</b><blockquote>{s.quote}</blockquote><a href={`/app/projects/${projectId}/materials?asset=${s.asset_id}&paragraph=${encodeURIComponent(s.paragraph_id)}&offset=${Math.floor(s.paragraph_index/50)*50}`}>定位规则原文 ↗</a></article>)}<details><summary>规则标识与内容指纹</summary><code>{rule.id}</code><code>{rule.fingerprint}</code></details></div>
}

function PlanSummary({ run, rule }: { run: CalculationRun; rule: RuleSnapshot | null }) {
  const spec = rule?.constraints ?? run.spec
  return <dl className="revision-plan"><div><dt>指标 / 范围</dt><dd>{spec.metric} / {spec.scope_description}</dd></div><div><dt>表格 / 工作表</dt><dd>{run.source.name} / {run.source.sheet_name}</dd></div><div><dt>分母条件</dt><dd>{conditionText(spec.scope,run.source.columns)}</dd></div><div><dt>分子条件</dt><dd>{conditionText(spec.numerator,run.source.columns)}</dd></div><div><dt>空值 / 精度</dt><dd>{nullPolicyLabel[spec.null_policy]}；{spec.precision} 位小数</dd></div><div><dt>统计单位</dt><dd>记录／行，不自动称为人数，不去重</dd></div></dl>
}

function ReviewWorkspace({ projectId }: { projectId: string }) {
  const query = new URLSearchParams(window.location.search)
  const checkId = query.get('check') ?? ''
  const targetQuery = query.get('target')
  const targetIndex = targetQuery && /^\d{1,3}$/.test(targetQuery) ? Number(targetQuery) : 0
  const initialRevision = query.get('revision')
  const [sources, setSources] = useState<Page<NumericCheck> | null>(null)
  const [sourceOffset, setSourceOffset] = useState(0)
  const [source, setSource] = useState<RevisionSource | null>(null)
  const [versionOffset, setVersionOffset] = useState(0)
  const [selectedId, setSelectedId] = useState(initialRevision)
  const [revision, setRevision] = useState<ReportRevision | null>(null)
  const [draft, setDraft] = useState('')
  const [action, setAction] = useState('edit')
  const [reason, setReason] = useState('')
  const [restoreId, setRestoreId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [confirmed, setConfirmed] = useState(false)
  const [evidenceTab, setEvidenceTab] = useState('basis')
  const [eventIndex, setEventIndex] = useState(0)
  const prefix = `/projects/${projectId}`
  const url = `/app/projects/${projectId}/review`
  const loadSource = useCallback(() => api<RevisionSource>(`${prefix}/revision-source/${checkId}?target_index=${targetIndex}&offset=${versionOffset}`), [prefix,checkId,targetIndex,versionOffset])

  useEffect(() => {
    document.title = '修改与交付 · 数有依据'
    const controller = new AbortController()
    api<Page<NumericCheck>>(`${prefix}/revision-sources?offset=${sourceOffset}&limit=10`,{signal:controller.signal}).then(setSources).catch(cause => { if (!controller.signal.aborted) setError((cause as Error).message) })
    return () => controller.abort()
  },[prefix,sourceOffset,attempt])
  useEffect(() => {
    if (!checkId) return
    let live = true
    loadSource().then(data => {
      if (!live) return
      setSource(data)
      setSelectedId(previous => previous ?? data.head_id)
      if (!data.head_id && !selectedId) setDraft(data.check.report.paragraph.text)
    }).catch(cause => { if (live) setError((cause as Error).message) })
    return () => { live = false }
  },[checkId,loadSource,attempt,selectedId])
  useEffect(() => {
    if (!selectedId) return
    const controller = new AbortController()
    api<ReportRevision>(`${prefix}/revisions/${selectedId}`,{signal:controller.signal}).then(data => {
      if (data.basis.source_check.id !== checkId || data.target_index !== targetIndex) throw new Error('此版本不属于当前原句和目标数字，请从版本列表重新选择。')
      setRevision(data);setDraft(data.text);setReason(data.reason);setAction('edit');setRestoreId(null);setConfirmed(false);setEventIndex(0)
    }).catch(cause => { if (!controller.signal.aborted) setError((cause as Error).message) })
    return () => controller.abort()
  },[selectedId,prefix,attempt,checkId,targetIndex])

  const original = source?.check.report.paragraph.text ?? ''
  const targetChosen = !!source && (targetQuery !== null || source.targets.length === 1)
  const target = targetChosen ? source?.targets.find(t => t.index === targetIndex) : undefined
  const targetMatches = !!target && Number(target.value) === Number(source?.check.result.reported_value)
  const savedText = revision?.text ?? original
  const dirty = draft !== savedText || action === 'keep' || action === 'restore'
  const historical = !!revision && revision.id !== source?.head_id
  const suggestion = source && target && source.run.result.display_value !== null ? target.prefix + source.run.result.display_value + '%' + target.suffix : null
  const lastEvent = revision?.rechecks[eventIndex]

  function setUrlVersion(id: string) {
    const params = new URLSearchParams({check:checkId,target:String(targetIndex),revision:id})
    history.replaceState(null,'',url+'?'+params)
  }
  function edit(value: string) { setDraft(value);setAction('edit');setRestoreId(null);setNotice('');setConfirmed(false) }
  function resetDraft() { setDraft(savedText);setReason(revision?.reason ?? '');setAction('edit');setRestoreId(null);setNotice('已撤回本次未保存的草稿修改，已保存历史保持不变。') }
  async function save() {
    if (!source || !targetMatches || busy) return
    setBusy('save');setError('');setNotice('')
    try {
      const saved = await api<ReportRevision>(prefix+'/revisions',{method:'POST',body:JSON.stringify({source_check_id:checkId,target_index:targetIndex,expected_head:source.head_id,text:draft,action,reason,restored_from:restoreId})})
      setRevision(saved);setSelectedId(saved.id);setUrlVersion(saved.id);setVersionOffset(0);setSource(await loadSource());setAction('edit');setRestoreId(null);setConfirmed(false)
      setNotice(`修订 v${saved.version} 已由后台保存，${revisionStatus[saved.status]}。保存不代表核验通过。`)
    } catch(cause) { setError((cause as Error).message) }
    finally { setBusy('') }
  }
  async function confirmPlan() {
    if (!revision || !source?.current_rule || busy) return
    setBusy('confirm');setError('');setNotice('')
    try {
      const confirmation = await api<RevisionConfirmation>(`${prefix}/revisions/${revision.id}/confirm`,{method:'POST',body:JSON.stringify({expected_head:revision.id,context_hash:source.context_hash,rule_snapshot_id:source.current_rule.id,plan:{...source.current_rule.constraints,confirmed:true,context_hash:source.context_hash},confirmed})})
      setRevision({...revision,confirmation});setConfirmed(false);setNotice('当前版本与规则方案已确认，尚未复核。下一步运行后台计算。')
    } catch(cause) { setError((cause as Error).message) }
    finally { setBusy('') }
  }
  async function recheck() {
    if (!revision?.confirmation || busy) return
    setBusy('recheck');setError('');setNotice('')
    try {
      const data = await api<ReportRevision>(`${prefix}/revisions/${revision.id}/recheck`,{method:'POST',body:JSON.stringify({expected_head:revision.id,confirmation_id:revision.confirmation.id})})
      setRevision(data);setEventIndex(0);setEvidenceTab('result');setNotice('后台已重新计算并保存此版本的单条比较，原核验记录仍保留。')
    } catch(cause) { setError((cause as Error).message) }
    finally { setBusy('') }
  }

  return <div className="revision-workspace"><div className="materials-heading"><div><p className="section-kicker">04 · 修改与交付</p><h1>修订有依据，保存后再复核。</h1><p>当前仅处理报告中选定的一个百分比。保留原稿与历史，不代表整篇报告通过；支持所选单条结论PDF。</p></div></div>
    {error && <RequestError message={error} retry={() => {setError('');setAttempt(x => x+1)}} />}{notice && <p className="calc-save-notice" role="status">{notice}</p>}
    <details className="revision-source-list" open={!checkId}><summary>选择实际核验原句 {sources ? `· ${sources.total} 条` : ''}</summary><p className="calc-help">修改依据来自下列具体核验记录，不会自动套用项目最近的其他计算。</p>{sources?.items.map(c => <a key={c.id} className={c.id===checkId?'selected':''} href={`${url}?check=${c.id}`}><span>{c.report.name} · {c.report.paragraph.location}</span><b>{c.report.paragraph.text}</b><small>原核验：{calculationStatus[c.status]} · {displayDate(c.created_at)}</small></a>)}{sources && !sources.total && <div className="empty-panel"><h3>还没有可关联的单条数字核验。</h3><p>先完成手动或AI辅助核验，再从结果进入修订。</p><a href={`/app/projects/${projectId}/calculations`}>打开手动计算与核验 ↗</a><a href={`/app/projects/${projectId}/verify`}>打开结论核验 ↗</a></div>}<div className="calc-pagination"><span>核验原句每页10条</span><div><button disabled={!sourceOffset} onClick={() => setSourceOffset(x => x-10)}>上一组原句</button><button disabled={!sources || sourceOffset+10>=sources.total} onClick={() => setSourceOffset(x => x+10)}>下一组原句</button></div></div></details>
    {checkId && !source && !error && <p className="work-loading">正在定位原报告和核验依据…</p>}
    {source && <><div className="revision-status-strip"><span className={`revision-state state-${revision?.status ?? 'pending'}`}>{revision ? `v${revision.version} · ${revisionStatus[revision.status]}` : '尚无保存版本'}</span><span>{source.check.report.name} · {source.check.report.paragraph.location}</span><a href={`/app/projects/${projectId}/materials?asset=${source.check.report.asset_id}&paragraph=${encodeURIComponent(source.check.report.paragraph.id)}`}>定位原报告 ↗</a></div>
      <label className="work-field revision-target">本次修改的目标百分比<select aria-label="本次修改的目标百分比" value={targetChosen ? String(targetIndex) : ''} onChange={e => {if(e.target.value!=='') window.location.href=`${url}?check=${checkId}&target=${e.target.value}`}}><option value="">同段有多个数字，请明确选择位置</option>{source.targets.map(t => <option value={t.index} key={t.index} disabled={Number(t.value)!==Number(source.check.result.reported_value)}>第 {t.index+1} 处：{t.text} · …{t.prefix.slice(-16)}【{t.text}】{t.suffix.slice(0,16)}…{Number(t.value)!==Number(source.check.result.reported_value)?'（属于其他核验对象）':''}</option>)}</select></label>
      {!!source.source_rule_conflicts.length && <p className="calc-warning">原计算与绑定规则存在冲突：{source.source_rule_conflicts.join('、')}。不能接受此数值建议，请先重新建立核验依据。</p>}{!source.rule_snapshot && <p className="calc-warning">此历史核验未绑定已确认规则，不能创建缺少规则依据的修订。请先在结论核验中保存规则，再建立新的核验记录。原结果仍保留。</p>}{!targetMatches && <p className="calc-warning">请先选中与原核验报告值 {source.check.result.reported_value}% 对应的具体位置，随后才能保存修订。不同位置各自保留版本。</p>}
      <div className="revision-layout"><div className="revision-main"><section className="revision-documents" aria-label="原稿与修订稿对照"><article className="revision-document"><header><span>只读原稿</span><small>原核验：{calculationStatus[source.check.result.status]}</small></header><h2>报告原句</h2><p className="revision-original" tabIndex={0} role="region" aria-label="只读原句，长文本可在此区域滚动">{target ? <>{target.prefix}<mark>{target.text}</mark>{target.suffix}</> : original}</p><p className="calc-help">原始上传文件与解析段落保持不变；长原句可在上方区域滚动阅读。</p><details><summary>来源与原核验标识</summary><code>{source.check.report.paragraph.id}</code><code>原核验 {source.check.id}</code><code>计算 {source.run.id}</code><p>原报告值 {source.check.result.reported_value}% · 原计算 {source.check.result.calculated_value ?? '无数值'}%</p></details></article>
      <article className="revision-document revision-editor"><header><span>{revision?`修订 v${revision.version}`:'新修订草稿'}</span><small>{dirty?'草稿有未保存操作':'当前显示已保存内容'}</small></header><h2>修订句</h2><label className="work-field"><span className="sr-only">修订文本</span><textarea aria-label="修订文本" rows={6} value={draft} maxLength={30000} disabled={!!busy || !targetMatches} onChange={e => edit(e.target.value)} /></label><label className="work-field">{action==='keep'?'保留原句的原因（必填）':'修改说明（可选）'}<textarea aria-label="修改说明" rows={2} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} disabled={!!busy} placeholder="说明本次修改或保留的决定；不影响核验结论。" /></label>
      <div className="revision-actions"><button className="button button-primary" disabled={!!busy || !targetMatches || !source.rule_snapshot || !draft.trim() || action==='keep'&&!reason.trim()} onClick={() => void save()}>{busy==='save'?'保存中…': action==='restore'?'恢复并保存为新版本':'保存修订版本'}</button><button className="button button-secondary" disabled={!!busy} onClick={resetDraft}>撤回草稿修改</button></div><p className="calc-help">每次保存都会追加版本，并进入待复核；不会自动通过。</p></article></section>
      <section className="revision-suggestion"><div><p className="calc-step">有依据的数值建议</p><h2>{source.check.result.reported_value}% → {source.run.result.display_value ?? '无可用建议'}%</h2><p>{source.run.result.numerator} ÷ {source.run.result.denominator} × 100% = {source.run.result.display_value ?? '—'}% · 来自原核验关联的计算</p><p className="calc-help">只替换高亮的一个百分比，其他内容保持原样。{source.run.stale && '该依据已过期，需要先建立当前核验依据。'}</p></div><div className="revision-actions"><button className="button button-secondary" disabled={!!busy || !suggestion || !targetMatches || source.run.stale || !!source.source_rule_conflicts.length || !['consistent','different'].includes(source.check.result.status)} onClick={() => {if(suggestion){setDraft(suggestion);setAction('suggestion');setRestoreId(null);setConfirmed(false);setNotice('已接受到草稿，尚未保存或复核。')}}}>接受数值建议</button><button className="button button-secondary" disabled={!!busy || !targetMatches} onClick={() => {setDraft(original);setAction('keep');setReason('');setRestoreId(null);setConfirmed(false);setNotice('请填写保留原因。此决定不会消除原来的差异。')}}>保留原句并说明</button></div></section>
      {revision && <section className="revision-recheck" aria-labelledby="revision-recheck-title"><p className="calc-step">保存 → 确认 → 重新计算</p><h2 id="revision-recheck-title">复核此版本的单条百分比</h2>{historical && <p className="calc-warning">正在查看历史 v{revision.version}。只能复核最新保存版本；可恢复此内容，另存为新版本。</p>}{revision.recheck_block_reason && <p className="calc-warning" role="status">{revision.recheck_block_reason} <a href={`/app/projects/${projectId}/verify`}>前往结论核验建立新依据 ↗</a></p>}{dirty && <p className="calc-warning">请先保存或撤回草稿，再确认已保存版本。</p>}
      <details className="revision-confirmation-plan"><summary>检查当前复核方案与规则 v{source.current_rule?.version ?? '未确认'}</summary><PlanSummary run={source.run} rule={source.current_rule} /><RuleEvidence rule={source.current_rule} projectId={projectId} /></details>
      {revision.confirmation && <p className={revision.confirmation.valid?'calc-help':'calc-warning'}>方案确认：{revision.confirmation.valid?'已保存，执行时后台还会检查资料与规则是否变化':'已失效，必须重新确认'} · {displayDate(revision.confirmation.created_at)}</p>}
      <label className="calc-confirm"><input type="checkbox" checked={confirmed} disabled={!!busy||historical||dirty||!!revision.recheck_block_reason} onChange={e => setConfirmed(e.target.checked)} /><span>我已核对：仅修改目标数字；原句的对象、期间、指标和范围未改变，并适用上述当前规则。</span></label><div className="revision-actions"><button className="button button-secondary" disabled={!!busy||!confirmed||historical||dirty||!!revision.recheck_block_reason} onClick={() => void confirmPlan()}>{busy==='confirm'?'检查并确认中…':'确认此版本方案'}</button><button className="button button-primary" disabled={!!busy||!revision.confirmation?.valid||historical||dirty||!!revision.recheck_block_reason} onClick={() => void recheck()}>{busy==='recheck'?'后台重新计算中…':'执行确定性复核'}</button></div><p className="calc-help">不调用模型。后台验证规则冲突、资料版本和账户权限；数字由完整工作表重新计算，不套用原计算结果。</p></section>}
      <section className="revision-evidence"><div className="ai-tabs" role="tablist" aria-label="修订依据与复核证据">{[['basis','原修改依据'],['result','复核结果'],['rows','原始数据'],['rules','规则原文']].map(([key,label]) => <button role="tab" key={key} aria-selected={evidenceTab===key} onClick={() => setEvidenceTab(key)}>{label}</button>)}</div><div role="tabpanel">
      {evidenceTab==='basis' && <><h2>这条原句的实际核验依据</h2><p>原报告 {source.check.result.reported_value}% · 原计算 {source.check.result.calculated_value ?? '无数值'}% · {calculationStatus[source.check.result.status]}</p><p>{source.check.result.message}</p>{source.check.stale && <p className="calc-warning">{source.check.stale_reasons.join('；')}；当前显示原保存结果。</p>}<PlanSummary run={source.run} rule={source.rule_snapshot} /><p className="calc-help">{source.check.result.comparison_rule}</p><a href={`/app/projects/${projectId}/calculations?run=${source.run.id}`}>打开对应计算与原核验 ↗</a></>}
      {evidenceTab==='result' && (lastEvent ? <><div className={`revision-result state-${lastEvent.result.status}`}><span>{lastEvent.stale?'历史结果 · 当前待复核':revisionStatus[lastEvent.result.status]}</span><strong>{lastEvent.result.calculated_value ?? '—'}%</strong><p>{lastEvent.result.message}</p></div><div className="comparison-values"><div><span>此版本报告值</span><b>{lastEvent.result.reported_value}%</b></div><div><span>重新计算值</span><b>{lastEvent.result.calculated_value ?? '—'}%</b></div><div><span>计算 − 报告</span><b>{lastEvent.result.difference_pp ?? '未比较'} 个百分点</b></div></div><p>{lastEvent.run.result.numerator} ÷ {lastEvent.run.result.denominator} × 100% = {lastEvent.run.result.display_value ?? '无有效值'}% · {displayDate(lastEvent.created_at)}</p><p className="calc-help">{lastEvent.result.comparison_rule}</p><p className="calc-warning">仅核验此修订版本选中的一个百分比，不代表整篇报告通过。{lastEvent.stale_reasons.join('；')}</p><details><summary>复核快照与未舍入值</summary><p>修订版本 {revision?.id}</p><p>计算 {lastEvent.run.id}</p><p>未舍入值 {lastEvent.run.result.unrounded_decimal ?? '无有效值'}</p><p>公式 {JSON.stringify(lastEvent.run.result.exact_fraction)}</p><PlanSummary run={lastEvent.run} rule={lastEvent.confirmation.rule_snapshot} /></details>{(revision?.rechecks.length ?? 0)>1 && <label className="work-field">查看此版本其他复核<select value={eventIndex} onChange={e => setEventIndex(Number(e.target.value))}>{revision?.rechecks.map((e,i) => <option value={i} key={e.id}>{displayDate(e.created_at)} · {revisionStatus[e.result.status]}</option>)}</select></label>}</> : <div className="empty-panel"><h3>此版本尚未执行复核。</h3><p>保存和人工确认都不代表一致。请在上方检查方案，再执行确定性复核。</p></div>)}
      {evidenceTab==='rows' && <CalculationEvidence run={lastEvent?.run ?? source.run} key={lastEvent?.run.id ?? source.run.id} />}
      {evidenceTab==='rules' && <RuleEvidence rule={lastEvent?.confirmation.rule_snapshot ?? revision?.basis.rule_snapshot ?? source.rule_snapshot} projectId={projectId} />}
      </div></section></div>
      <aside className="revision-sidebar"><section><p className="calc-step">原稿与不可覆盖的版本</p><h2>修订历史</h2><p className="calc-help">只列当前原句和目标位置。查看历史不执行计算，不调用模型。</p><div className="revision-version-list"><button className={!revision?'selected':''} onClick={() => {setRevision(null);setDraft(original);setAction('edit');setSelectedId('');history.replaceState(null,'',`${url}?check=${checkId}&target=${targetIndex}`)}}><b>原稿</b><small>原核验：{calculationStatus[source.check.result.status]}</small></button>{source.versions.items.map(v => <button className={revision?.id===v.id?'selected':''} key={v.id} onClick={() => {setSelectedId(v.id);setUrlVersion(v.id);setNotice('');setError('')}}><b>v{v.version} {v.id===source.head_id?'· 最新':''}</b><small>{revisionAction[v.action]} · {displayDate(v.created_at)}</small><span>{v.text}</span></button>)}</div><div className="calc-pagination"><span>共 {source.versions.total} 版</span><div><button disabled={!versionOffset} onClick={() => setVersionOffset(x => x-10)}>上一页</button><button disabled={versionOffset+10>=source.versions.total} onClick={() => setVersionOffset(x => x+10)}>下一页</button></div></div>
      {revision && <details><summary>当前版本记录</summary><p>{revisionAction[revision.action]} · {displayDate(revision.created_at)}</p><p>修改说明：{revision.reason||'未填写'}</p><p>上版：{revision.parent_id??'原稿'}</p><p>恢复来源：{revision.restored_from??'无'}</p><code>{revision.id}</code></details>}{historical && <button className="button button-secondary" disabled={!!busy} onClick={() => {setDraft(revision!.text);setAction('restore');setRestoreId(revision!.id);setReason(`恢复为 v${revision!.version} 内容，追加新版本。`);setNotice('已选恢复内容；点击“恢复并保存为新版本”完成保存，旧历史仍保留。')}}>恢复此内容为新版本</button>}</section>
      <section><h2>成果导出</h2><p>已接通所选单条结论PDF，包含明确版本与复核快照。DOCX／XLSX仍未接通。</p><a className="text-link" href="#pdf-export">生成或查看 PDF ↓</a></section><section><h2>其他计算历史</h2><p>其他运行仅供浏览，不会自动作为本句依据。</p><a href={`/app/projects/${projectId}/calculations#calculation-history`}>查看项目计算历史 ↗</a></section></aside></div></>}
    {(!checkId || source && (!selectedId || revision)) && <PdfExportPanel key={selectedId||'unselected'} projectId={projectId} revision={revision} dirty={dirty}/>}
  </div>
}

export function ReviewPage({ projectId }: { projectId: string }) { return <WorkShell project>{() => <ReviewWorkspace projectId={projectId} />}</WorkShell> }
