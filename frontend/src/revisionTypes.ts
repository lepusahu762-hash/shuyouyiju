import type { AIPlan, RuleSnapshot } from './aiTypes'
import type { CalculationRun, NumericCheck, Page } from './calculationTypes'

export type RevisionTarget = { index: number; text: string; value: string; prefix: string; suffix: string }
export type RevisionListItem = { id: string; version: number; text: string; action: string; created_at: string }
export type RevisionSource = {
  source_rule_conflicts: string[]; check: NumericCheck; run: CalculationRun; targets: RevisionTarget[]; rule_snapshot: RuleSnapshot | null;
  current_rule: RuleSnapshot | null; context_hash: string; head_id: string | null; versions: Page<RevisionListItem>;
}
export type RevisionConfirmation = { id: string; valid: boolean; created_at: string; context_hash: string; rule_snapshot: RuleSnapshot;
  plan: AIPlan; reported_value: string; text_fingerprint: string; method_version: string }
export type RevisionRecheck = { id: string; created_at: string; result: NumericCheck['result']; stale: boolean; stale_reasons: string[];
  run: CalculationRun; confirmation: RevisionConfirmation }
export type ReportRevision = RevisionListItem & {
  thread_id: string; parent_id: string | null; head_id: string; restored_from: string | null; reason: string; status: string; target_index: number;
  basis: { report: NumericCheck['report']; source_check: NumericCheck; run: CalculationRun; rule_snapshot: RuleSnapshot | null; target: RevisionTarget };
  confirmation: RevisionConfirmation | null; rechecks: RevisionRecheck[]; recheck_block_reason: string | null;
}
export const revisionStatus: Record<string, string> = { pending: '待复核', manual_required: '待人工核验', consistent: '单条数字与数据一致',
  different: '存在差异', insufficient: '证据不足', needs_confirmation: '需要确认', stale: '已过期 · 待复核' }
export const revisionAction: Record<string, string> = { suggestion: '接受数值建议', edit: '手动编辑', keep: '保留原句并说明', restore: '恢复为旧版内容' }
