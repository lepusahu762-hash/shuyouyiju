import type { CalculationRun, CalculationSpec, NumericCheck } from './calculationTypes'

export type AIConfig = { configured: boolean; test_mode: boolean; missing: string[]; configuration_error: string | null; provider: string; model: string; region: string; max_requests: number; max_tool_calls: number; timeout_seconds: number }
export type Candidate = { quote: string; reported_value: string; metric: string; unit: 'percent' | 'decimal' | 'percentage_point'; scope: string; supported: boolean; reason: string }
export type Citation = { citation_id: string; asset_id: string; name: string; sha256: string; version: string; location: string; paragraph_index: number; text: string; truncated: boolean; score: number }
export type AIPlan = CalculationSpec & { context_hash: string }
export type RuleSpec = Omit<AIPlan, 'context_hash' | 'confirmed'>
export type RuleSource = { asset_id: string; name: string; paragraph_id: string; paragraph_index: number; location: string; quote: string; text: string; version: string; sha256: string }
export type RuleSnapshot = { id: string; project_id: string; version: number; previous_id: string | null; constraints: RuleSpec; sources: Record<keyof RuleSpec, RuleSource>; fingerprint: string; change_reason: string; created_at: string }
export type RuleCheck = { status: 'legacy' | 'needs_confirmation' | 'stale' | 'conflict' | 'confirmed'; message: string; snapshot_id?: string; version: string; conflicts: { field: keyof RuleSpec; label: string; required: unknown; suggested: unknown; actual: unknown; source: RuleSource }[] }
export type AITask = {
  rule_check: RuleCheck;
  id: string; project_id: string; status: string; saved_status: string; stale: boolean; context_hash: string;
  source: { asset_id: string; name: string; excerpt: string; paragraph_index: number; paragraph: { id: string; location: string; text: string } };
  payload: { candidates?: Candidate[]; selected?: number; citations?: Citation[]; citation_ids?: string[]; plan?: AIPlan | null;
    questions?: string[]; explanation?: string; message?: string; confirmed_plan?: AIPlan; resolution?: string; confirmed_at?: string;
    draft_plan?: AIPlan; rule_snapshot?: RuleSnapshot; confirmed_rule_id?: string; plan_revisions?: { event: string; at: string; plan?: AIPlan; previous_rule_id?: string; snapshot_id?: string }[];
    model: { model: string; region: string; provider: string }; prompt_version: string };
  request_count: number; tool_count: number; trace: { event: string; name?: string; at: string; summary?: unknown; usage?: unknown; result?: unknown }[];
  run_id: string | null; run?: CalculationRun; check?: NumericCheck; error: string | null; created_at: string; updated_at: string;
}
export const aiStatus: Record<string, string> = { extracting: '正在提取陈述', candidates: '请选择一条陈述', searching: '正在检索项目规则', planning: '正在生成核验方案', awaiting_confirmation: '等待你确认口径', calculating: '正在调用计算工具', completed: '单条核验已保存', insufficient: '证据不足／超出本轮能力', failed: '本阶段失败，可检查后重试', cancelled: '任务已取消', stale: '资料或口径变化，待重新复核' }
export const aiBusy = new Set(['extracting', 'searching', 'planning', 'calculating'])
