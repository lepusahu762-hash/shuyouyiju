import type { CalculationRun, Condition, NumericResult } from './calculationTypes'
import type { RuleSnapshot, Retrieval, Citation } from './aiTypes'
export type AnalysisPlan={operation:'count'|'ratio';metric:string;group_by:string|null;group_null_policy:'keep'|'exclude'|'block'|null;exploration:Condition[]}
export type AnalysisGroup={key:string;type:string;value:unknown;label:string;result:NumericResult}
export type GroupRun=CalculationRun&{result:NumericResult&{groups?:AnalysisGroup[];group_count?:number;group_null_rows?:number;group_null_excluded?:number;aggregation_note?:string;extrema?:{lowest:string[];highest:string[];rule:string}}}
export type AnalysisTurn={id:string;session_id:string;question:string;parent_id:string|null;status:string;saved_status:string;stale:boolean;request_count:number;run_id:string|null;run?:GroupRun;error:string|null;created_at:string;
 payload:{model:{model:string;region:string};prompt_version:string;rule_snapshot?:RuleSnapshot;retrieval?:Retrieval;citations?:Citation[];proposal_hash?:string;
 original_proposal?:{action:string;plan:AnalysisPlan|null;message:string;questions:string[];citation_ids:string[]};confirmed_plan?:AnalysisPlan;inherited_plan?:AnalysisPlan;
 answer?:{kind?:string;message:string;groups?:string[];tie_count?:number;questions?:string[]};confirmation?:{at:string;plan:AnalysisPlan;reason:string};raw_model_message?:unknown;answer_run_id?:string};trace:unknown[]}
export type AnalysisSession={id:string;project_id?:string;name:string;head_id:string|null;created_at?:string;items:AnalysisTurn[];total:number}
export const analysisStatus:Record<string,string>={understanding:'理解问题',searching:'检索规则',planning:'形成受限方案',awaiting_confirmation:'等待确认',calculating:'执行完整表格计算',completed:'结果已保存',clarify:'需要澄清',unsupported:'超出首版范围',failed:'执行失败',cancelled:'已取消',stale:'依据变化 · 历史结果'}
