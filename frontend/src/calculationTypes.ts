import type { Column, Rules, FieldMeaning } from './api'

export type Condition = { column_id: string; kind: 'text' | 'number' | 'boolean'; value: string }
export type CalculationSpec = {
  asset_id: string; sheet_id: string; operation: 'count' | 'ratio'; metric: string; scope_description: string;
  scope: Condition[]; numerator: Condition[]; null_policy: 'exclude' | 'keep' | 'block'; precision: number; confirmed: boolean;
}
export type RunStatus = 'completed' | 'needs_confirmation' | 'insufficient' | 'stale'
export type NumericResult = {
  status: RunStatus; message: string; unit: string; total: number; included: number; excluded: number;
  numerator: number; denominator: number; numerator_unmatched: number; null_rows: number; numeric_unmatched_rows: number;
  reasons: Record<string, { count: number; label: string }>; exact_fraction: { numerator: number; denominator: number; percent_multiplier: number } | null;
  unrounded_decimal: string | null; display_value: string | null; rounding: string; comparison_rule: string;
}
export type CalculationRun = {
  id: string; project_id: string; created_at: string; method_version: string; status: RunStatus; stale: boolean; stale_reasons: string[];
  spec: CalculationSpec; source: { asset_id: string; name: string; sheet_id: string; sheet_name: string; source_id: string; source_version: number;
    sha256: string; parsed_fingerprint: string; columns: Column[]; annotations: Record<string, FieldMeaning> };
  result: NumericResult; context?: { rules: Partial<Rules>; rules_version: number };
}
export type EvidenceRow = { id: string; source_row: number; source_line: number; cells: (string | number | boolean | null)[];
  in_scope: boolean; in_numerator: boolean; reason: string; reason_label: string }
export type Evidence = { run_id: string; group: string; total: number; offset: number; limit: number; columns: Column[]; rows: EvidenceRow[] }
export type NumericCheck = {
  id: string; run_id: string; created_at: string; status: 'consistent' | 'different' | 'insufficient' | 'needs_confirmation' | 'stale'; stale: boolean; stale_reasons: string[];
  report: { asset_id: string; name: string; sha256: string; paragraph: { id: string; location: string; text: string } };
  spec: { precision: number; confirmed: boolean };
  result: { status: string; message: string; reported_value: string; calculated_value: string | null; difference_pp: string | null; comparison_rule: string };
}
export type Page<T> = { items: T[]; total: number; offset: number; limit: number }
export const calculationStatus: Record<string, string> = { completed: '计算完成', consistent: '与数据一致', different: '存在差异',
  insufficient: '证据不足', needs_confirmation: '需要确认', stale: '待重新计算／复核' }
export const nullPolicyLabel = { exclude: '排除条件字段有空值的记录', keep: '保留空值记录，空值不匹配等值条件', block: '遇到条件字段空值暂停产出数值' }
export function conditionText(items: Condition[], columns: Column[]) {
  return items.length ? items.map(item => `${columns.find(column => column.id === item.column_id)?.label ?? '缺失字段'} = ${JSON.stringify(item.value)}（${item.kind === 'text' ? '文本' : item.kind === 'number' ? '数值' : '布尔'}）`).join(' 并且 ') : '全部记录（无附加条件）'
}
