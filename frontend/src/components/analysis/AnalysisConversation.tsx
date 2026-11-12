import { useState } from 'react'
import type { AnalysisSession, AnalysisTurn } from '../../analysisTypes'
import { analysisStatus } from '../../analysisTypes'
import { displayDate } from '../../api'

export function AnalysisConversation({session,turn,parentId,onParent,onSelect,onAsk,onPage,offset,busy,consent,onConsent}:{session:AnalysisSession|null;turn:AnalysisTurn|null;parentId:string;onParent:(id:string)=>void;onSelect:(t:AnalysisTurn)=>void;onAsk:(q:string)=>void;onPage:(n:number)=>void;offset:number;busy:boolean;consent:boolean;onConsent:(v:boolean)=>void}){
 const [question,setQuestion]=useState('')
 return <section className="calc-card analysis-conversation"><p className="calc-step">01 · 提问与会话</p><h2>围绕已确认口径继续分析</h2>
 <p className="calc-help">只支持记录数、记录占比、单字段分组、最高最低与等值追加筛选。预测、因果、任意公式不在本轮范围。</p>
 <div className="analysis-messages" aria-label="分析会话记录">{!session?.items.length&&<p className="empty-panel">还没有问题。先确认项目规则，再描述要统计的指标与分组字段。</p>}{session?.items.map(t=><button className={t.id===turn?.id?'selected':''} key={t.id} onClick={()=>onSelect(t)}><b>{t.question}</b><span>{analysisStatus[t.status]} · {displayDate(t.created_at)}</span>{t.payload.answer&&<p>{t.payload.answer.message}</p>}</button>)}</div>
 {!!session?.total&&<div className="calc-pagination"><span>{offset+1}–{Math.min(offset+20,session.total)} / {session.total} 条</span><button disabled={!offset} onClick={()=>onPage(offset-20)}>前20条</button><button disabled={offset+20>=session.total} onClick={()=>onPage(offset+20)}>后20条</button></div>}
 <label className="work-field">本次继承的已确认分析<select aria-label="继承分析" value={parentId} onChange={e=>onParent(e.target.value)} disabled={busy}><option value="">独立问题（不继承探索筛选）</option>{session?.items.filter(t=>t.saved_status==='completed'&&!t.stale&&t.run).map(t=><option value={t.id} key={t.id}>{t.question}</option>)}</select></label>
 <p className="calc-help">继承来自具体计算方案与记录，不从聊天文字猜范围；连续分析只追加条件。要清除探索筛选，请选独立问题。</p>
 <form onSubmit={e=>{e.preventDefault();if(question.trim()){onAsk(question.trim());setQuestion('')}}}><label className="work-field">分析问题<textarea aria-label="对话分析问题" maxLength={2000} rows={3} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="例如：各学院满意率是多少？分组字段为空时保留为空值组。" disabled={busy}/></label>
 <label className="calc-confirm"><input type="checkbox" checked={consent} onChange={e=>onConsent(e.target.checked)}/><span>同意发送必要问题、字段说明、最多5个取值样本及相关规则到百炼。不会发送完整原始表格。</span></label>
 <button className="button button-primary" disabled={busy||!session||!question.trim()||!consent}>{busy?'正在处理当前问题…':'提交分析问题'}</button></form>
 <div className="analysis-followups"><button disabled={busy||!parentId} onClick={()=>onAsk('哪个最低？')}>哪个最低？</button><button disabled={busy||!parentId} onClick={()=>onAsk('哪个最高？')}>哪个最高？</button><button disabled={busy||!parentId} onClick={()=>onAsk('查看选中组的记录。')}>查看选中组的记录</button></div>
 <p className="calc-help">上述三个明确追问只读取已保存结果，不调用模型、不重新计算；“查看记录”需先选中一组。</p>
 </section>
}
