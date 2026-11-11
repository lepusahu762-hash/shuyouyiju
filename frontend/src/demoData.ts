// All entries below are synthetic, prescribed by product specification §19.
// This homepage presents a saved example; it does not run an AI verification.
export const survey = [
  { college: 'A 学院', received: 68, valid: 60, satisfied: 45 },
  { college: 'B 学院', received: 56, valid: 50, satisfied: 45 },
  { college: 'C 学院', received: 76, valid: 70, satisfied: 54 },
] as const

export const totals = survey.reduce(
  (sum, row) => ({
    received: sum.received + row.received,
    valid: sum.valid + row.valid,
    satisfied: sum.satisfied + row.satisfied,
  }),
  { received: 0, valid: 0, satisfied: 0 },
)

export const satisfiedRate = (totals.satisfied / totals.valid) * 100
export type Scope = '全校' | typeof survey[number]['college']
export const scopes: Scope[] = ['全校', ...survey.map(row => row.college)]
export function getScopeData(scope: Scope) {
  return scope === '全校' ? totals : survey.find(row => row.college === scope)!
}
export function rate(satisfied: number, valid: number) {
  return valid === 0 ? null : satisfied / valid * 100
}
export function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value)
}
// Additional synthetic cases; formulas and charts share these inputs.
export const monthlyRevenue = { previous: 50, current: 60, unit: '万元' }
export const feedbackGroups = [
  { name: '工作坊', attendees: 30, satisfied: 27 },
  { name: '分享会', attendees: 70, satisfied: 49 },
]
export type ClaimId = 'sample' | 'satisfaction' | 'comparison'
export type EvidenceTab = 'calculation' | 'data' | 'definition'

export const claims: { id: ClaimId; label: string; status: string; tone: string }[] = [
  { id: 'sample', label: '问卷样本', status: '与数据一致', tone: 'success' },
  { id: 'satisfaction', label: '全校满意率', status: '存在差异', tone: 'difference' },
  { id: 'comparison', label: '同比变化', status: '证据不足', tone: 'neutral' },
]

export const evidenceTabs: { id: EvidenceTab; label: string }[] = [
  { id: 'calculation', label: '计算过程' },
  { id: 'data', label: '原始数据' },
  { id: 'definition', label: '口径定义' },
]
