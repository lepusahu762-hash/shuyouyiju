import type { Citation, Retrieval } from '../aiTypes'
import './RuleRetrievalEvidence.css'

export function RuleRetrievalEvidence({projectId,citations,retrieval,selected=[]}:{projectId:string;citations:Citation[];retrieval?:Retrieval;selected?:string[]}) {
  return <div className="rule-retrieval-evidence">
    <p className="calc-help">{retrieval ? `${retrieval.strategy_version} · ${retrieval.duration_ms} ms · ${retrieval.status==='no_evidence'?'未找到依据':'候选待确认'}` : '历史检索快照 · 未记录新策略元数据，未重新检索'}</p>
    {retrieval&&<details><summary>查询与检索方式</summary><p>{retrieval.query}</p><p>{retrieval.query_source}</p><p>本地BM25二值词频、通用词语提示和相邻条款补齐，不使用向量或模型检索。</p><p>{retrieval.notice}</p></details>}
    {!citations.length&&<p className="calc-empty-small">未检索到相关规则。请指定资料或补充指标、期间与对象，不会用示例规则替代。</p>}
    {citations.map(c=><article className="ai-rule" key={c.citation_id}><b>{c.name}</b><p>{c.location} · {selected.includes(c.citation_id)?'方案引用':'检索候选'} · {c.context_role==='adjacent_context'?'相邻限制条款':c.context_role==='scope_context'?'适用范围原文':c.context_role==='possible_conflict'?'可能冲突，请确认':'相关原文'}</p><p>{c.text}</p>{c.truncated&&<small>本段为按句/条款节选，省略位置已标注，请定位原文核对。</small>}
      {c.applicability&&<details><summary>适用信息 · 需要确认</summary><p>原文期间：{c.applicability.periods.join('、')||'未明确'}</p><p>{c.applicability.scope_quote||'没有明确范围标题，请人工核对对象与适用范围。'}</p><p>{c.applicability.note}</p></details>}
      <details><summary>来源与版本</summary><code>{c.citation_id}</code><code>{c.version}</code><code>{c.sha256}</code>{c.excerpt_ranges&&<p>原文字符范围：{c.excerpt_ranges.map(r=>`${r.start}–${r.end}`).join('、')}</p>}</details>
      <a href={`/app/projects/${projectId}/materials?asset=${c.asset_id}&paragraph=${encodeURIComponent(c.citation_id)}&offset=${Math.floor(c.paragraph_index/50)*50}`}>定位当前规则原文 ↗</a></article>)}
  </div>
}
