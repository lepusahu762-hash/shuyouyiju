import { useEffect, useState } from 'react'
import type { Asset } from './api'
import { api } from './api'
import type { AIPlan, Citation, RuleCheck, RuleSnapshot, RuleSpec } from './aiTypes'
import fixtureHashes from './unifiedDemoFiles.json'

const names = {
  table: '统一演示_12条.csv',
  report: '统一演示_报告50.docx',
  image: '统一演示_满意50.png',
} as const

export const demoRuleName = '统一演示_统计规则'
export const demoRuleSha = 'f76c6071d38fd0c27b54c7528b3725ff300f4e9bdc2ff7feb13b05f9cab3cabe'
export const demoReportText = '本独立合成演示中，有效记录满意率为50%。'
export const demoQuestion = '各学院有效记录满意率是多少？按所属学院分组，保留分组空值，使用已确认规则；不限定期间，单位为记录。'

// This is the unmodified paragraph from the shipped practice pack's rule TXT.
export const demoRuleText = '独立合成参赛演示，非真实调查。使用“统一演示_12条.csv”的“CSV 数据”工作表；也提供内容相同的XLSX作为替代，不应重复纳入计算。指标为“有效记录满意率”。统计单位为记录/行，不自动称为人数，不去重，不限定期间。分母为纳入状态等于“有效”的全部记录；分子在上述分母内筛选反馈等级等于“满意”的记录。反馈等级为空的有效记录仍计入分母，必须保留空值，不得因评价缺失排除。采用分子记录数÷分母记录数×100%，显示及比较均为0位小数，十进制四舍五入后严格相等。可按所属学院分组；分组字段为空时保留为空值组，零分母不产生百分比、不参加排名。报告文字和图中“满意50%”标签均为待核验陈述，不是规则给出的答案。'

export type RuleHead = { items: RuleSnapshot[]; current_id: string | null; current_valid: boolean; context_hash: string }

export function useDemoRuleHead(projectId: string, enabled: boolean, revision = '') {
  const [result, setResult] = useState<{ key: string; head: RuleHead | null; error: string } | null>(null)
  const key = `${projectId}:${revision}`
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    api<RuleHead>(`/projects/${projectId}/rule-snapshots`, { signal: controller.signal })
      .then(head => {
        if (!controller.signal.aborted) setResult({ key, head, error: '' })
      })
      .catch(cause => {
        if (!controller.signal.aborted) setResult({ key, head: null, error: (cause as Error).message })
      })
    return () => controller.abort()
  }, [enabled, key, projectId])
  return enabled && result?.key === key ? result : null
}

export function inspectUnifiedDemo(assets: Asset[]) {
  const tableFiles = assets.filter(asset => asset.name === names.table)
  const reportFiles = assets.filter(asset => asset.name === names.report)
  const imageFiles = assets.filter(asset => asset.name === names.image)
  if (!tableFiles.length && !reportFiles.length && !imageFiles.length) return { demo: null, issue: '' }
  if ([tableFiles, reportFiles, imageFiles].some(files => files.length > 1)) {
    return { demo: null, issue: '当前项目有重复同名的演示资料。请使用每种演示文件只上传一次的项目。' }
  }
  const [table] = tableFiles, [report] = reportFiles, [image] = imageFiles
  if (!table || !report || !image) {
    const missing = [!table && names.table, !report && names.report, !image && names.image].filter(Boolean)
    return { demo: null, issue: `启用演示预填还需要在本项目上传 ${missing.join('、')}。` }
  }
  const demoAssets = [table, report, image]
  const failed = demoAssets.filter(asset => asset.status === 'failed')
  if (failed.length) {
    return { demo: null, issue: `请重试解析这几份演示资料：${failed.map(asset => asset.name).join('、')}。` }
  }
  const notReady = demoAssets.filter(asset => asset.status !== 'ready')
  if (notReady.length) {
    return { demo: null, issue: `这几份演示资料尚未解析完成：${notReady.map(asset => asset.name).join('、')}。` }
  }
  if (table.kind !== 'table' || report.kind !== 'report' || image.kind !== 'image' || !fixtureHashes.some(hashes =>
    table.sha256 === hashes[names.table] && report.sha256 === hashes[names.report] && image.sha256 === hashes[names.image])) {
    return { demo: null, issue: '这组文件的指纹与登记的演示资料不同。请使用练习包里的三份原件，或核对后登记这组文件。' }
  }

  const sheet = table.summary.sheets?.find(item => item.name === 'CSV 数据')
  const scope = sheet?.columns.find(column => column.name === '纳入状态')
  const numerator = sheet?.columns.find(column => column.name === '反馈等级')
  const group = sheet?.columns.find(column => column.name === '所属学院')
  if (!sheet || sheet.row_count !== 12 || !scope || !numerator || !group) {
    return { demo: null, issue: '请检查演示 CSV 是否已解析为含 12 条记录的「CSV 数据」表，以及字段是否齐全。' }
  }

  const spec: RuleSpec = {
    asset_id: table.id,
    sheet_id: sheet.id,
    operation: 'ratio',
    metric: '有效记录满意率',
    scope_description: '纳入状态为有效；不限定期间',
    scope: [{ column_id: scope.id, kind: 'text', value: '有效' }],
    numerator: [{ column_id: numerator.id, kind: 'text', value: '满意' }],
    null_policy: 'keep',
    precision: 0,
  }
  return { demo: { table, report, image, sheet, group, spec }, issue: '' }
}

export function unifiedDemo(assets: Asset[]) {
  return inspectUnifiedDemo(assets).demo
}

export type UnifiedDemo = NonNullable<ReturnType<typeof unifiedDemo>>

export function demoRules(demo: UnifiedDemo): { key: keyof RuleSpec; label: string; value: string; quote: string }[] {
  return [
    { key: 'asset_id', label: '表格资料', value: demo.table.name, quote: '使用“统一演示_12条.csv”的“CSV 数据”工作表' },
    { key: 'sheet_id', label: '工作表', value: demo.sheet.name, quote: '使用“统一演示_12条.csv”的“CSV 数据”工作表' },
    { key: 'operation', label: '计算类型', value: '记录占比', quote: '采用分子记录数÷分母记录数×100%' },
    { key: 'metric', label: '指标', value: demo.spec.metric, quote: '指标为“有效记录满意率”' },
    { key: 'scope_description', label: '统计范围说明', value: demo.spec.scope_description, quote: '不限定期间。分母为纳入状态等于“有效”的全部记录' },
    { key: 'scope', label: '分母条件', value: '纳入状态等于有效', quote: '分母为纳入状态等于“有效”的全部记录' },
    { key: 'numerator', label: '分子条件', value: '分母中反馈等级等于满意', quote: '分子在上述分母内筛选反馈等级等于“满意”的记录' },
    { key: 'null_policy', label: '空值策略', value: '有效记录的空评价仍计入分母', quote: '反馈等级为空的有效记录仍计入分母，必须保留空值' },
    { key: 'precision', label: '显示及比较精度', value: '0 位小数', quote: '显示及比较均为0位小数，十进制四舍五入后严格相等' },
  ]
}

export function matchesDemoRule(snapshot: RuleSnapshot, demo: UnifiedDemo): boolean {
  const matchesConditions = (actual: RuleSpec['scope'], expected: RuleSpec['scope']) =>
    actual.length === expected.length && actual.every((item, i) =>
      item.column_id === expected[i].column_id && item.kind === expected[i].kind && item.value === expected[i].value)
  return demoRules(demo).every(({ key }) => key === 'scope' || key === 'numerator'
    ? matchesConditions(snapshot.constraints[key], demo.spec[key])
    : snapshot.constraints[key] === demo.spec[key])
}

export function currentDemoRule(head: RuleHead | null, demo: UnifiedDemo) {
  const snapshot = head?.items.find(item => item.id === head.current_id)
  return head?.current_valid && snapshot && matchesDemoRule(snapshot, demo) ? snapshot : null
}

export function demoCitationIds(snapshot: RuleSnapshot, citations: Citation[] = []) {
  const sources = Object.values(snapshot.sources)
  return citations.filter(citation => sources.some(source =>
    source.paragraph_id === citation.citation_id && source.asset_id === citation.asset_id
    && source.sha256 === citation.sha256 && source.version === citation.version
  )).map(citation => citation.citation_id)
}

type PendingTask = {
  id: string; project_id: string; status: string; stale: boolean; context_hash: string; run_id: string | null;
  payload: { rule_snapshot?: RuleSnapshot; citations?: Citation[] }
}

export async function checkedDemoPlan<T extends PendingTask>(
  task: T, path: string, demo: UnifiedDemo, reviewedSnapshot: RuleSnapshot, targetStillMatches: (fresh: T) => boolean,
) {
  const [head, fresh] = await Promise.all([
    api<RuleHead>(`/projects/${task.project_id}/rule-snapshots`), api<T>(path),
  ])
  const snapshot = currentDemoRule(head, demo)
  if (!snapshot || snapshot.id !== reviewedSnapshot.id || fresh.stale || fresh.run_id ||
      fresh.status !== 'awaiting_confirmation' || !targetStillMatches(fresh)) {
    throw new Error('规则、资料或核验目标已变化。请刷新后核对当前方案。')
  }
  const citationIds = demoCitationIds(snapshot, fresh.payload.citations)
  if (!citationIds.length) throw new Error('本任务未检索到已确认规则的原文，请切换到手动核对。')

  const bound = fresh.payload.rule_snapshot?.id === snapshot.id ? fresh : await api<T>(`${path}/bind-rule`, {
    method: 'POST', body: JSON.stringify({ snapshot_id: snapshot.id }),
  })
  const plan: AIPlan = { ...snapshot.constraints, context_hash: bound.context_hash, confirmed: false }
  const { rule_check } = await api<{ rule_check: RuleCheck }>(`${path}/plan-check`, {
    method: 'POST', body: JSON.stringify({ plan }),
  })
  if (rule_check.snapshot_id !== snapshot.id || rule_check.conflicts.length ||
      !['needs_confirmation', 'confirmed'].includes(rule_check.status)) throw new Error(rule_check.message)
  return { plan: { ...plan, confirmed: true }, citation_ids: citationIds, rule_snapshot_id: snapshot.id }
}
