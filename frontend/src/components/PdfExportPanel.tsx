import { useEffect, useRef, useState } from 'react'
import { api, displayDate } from '../api'
import type { Page } from '../calculationTypes'
import type { ReportRevision } from '../revisionTypes'
import { revisionStatus } from '../revisionTypes'
import { RequestError } from './WorkShell'

type ExportRecord = { id:string; revision_id:string; source_check_id:string; recheck_id:string|null; version:number; report_name:string;
  created_at:string; status:'completed'|'failed'; report_status:string; historical:boolean; historical_reasons:string[];
  error:string|null; sha256:string|null; size_bytes:number }
type Preview = { preview_hash:string; snapshot:{ project_name:string; report:{name:string}; status:string; warnings:string[];
  revision:{id:string;version:number;text:string}; original_check:{id:string}; recheck:{id:string;created_at:string;result:{status:string}}|null;
  evidence:{rows:unknown[];limit:number} } }

export function PdfExportPanel({projectId,revision,dirty}:{projectId:string;revision:ReportRevision|null;dirty:boolean}) {
  const [choice,setChoice]=useState('')
  const [preview,setPreview]=useState<Preview|null>(null)
  const [list,setList]=useState<Page<ExportRecord>|null>(null)
  const [offset,setOffset]=useState(0)
  const [attempt,setAttempt]=useState(0)
  const [error,setError]=useState('')
  const [listError,setListError]=useState('')
  const [busy,setBusy]=useState('')
  const [opened,setOpened]=useState<ExportRecord|null>(null)
  const [blobUrl,setBlobUrl]=useState('')
  const [approved,setApproved]=useState(false)
  const [imageUrl,setImageUrl]=useState('')
  const [pageNumber,setPageNumber]=useState(1)
  const [pageCount,setPageCount]=useState(0)
  const [pageBusy,setPageBusy]=useState(false)
  const [zoom,setZoom]=useState(false)
  const [errorAction,setErrorAction]=useState('preflight')
  const fileRequest=useRef(0)
  const prefix=`/projects/${projectId}/exports`
  const selection=revision&&choice ? {source_check_id:revision.basis.source_check.id,revision_id:revision.id,recheck_id:choice==='none'?null:choice}:null

  useEffect(()=>{
    const controller=new AbortController()
    api<Page<ExportRecord>>(`${prefix}?offset=${offset}&limit=10`,{signal:controller.signal}).then(v=>{setList(v);setListError('')}).catch(cause=>{if(!controller.signal.aborted)setListError((cause as Error).message)})
    return ()=>controller.abort()
  },[prefix,offset,attempt])
  useEffect(()=>()=>{if(blobUrl)URL.revokeObjectURL(blobUrl)},[blobUrl])
  useEffect(()=>()=>{if(imageUrl)URL.revokeObjectURL(imageUrl)},[imageUrl])

  async function preflight(){
    if(!selection||busy)return
    setBusy('preview');setErrorAction('preflight');setError('');setPreview(null);setApproved(false)
    try{setPreview(await api<Preview>(prefix+'/preview',{method:'POST',body:JSON.stringify(selection)}))}
    catch(cause){setError((cause as Error).message)}finally{setBusy('')}
  }
  async function openFile(record:ExportRecord){
    const request=++fileRequest.current
    setErrorAction('file');setError('');setBlobUrl('');setImageUrl('');setZoom(false);setOpened(record);setPageCount(0);setPageNumber(1)
    try{
      const response=await fetch(`/api${prefix}/${record.id}/file`,{credentials:'include'})
      if(!response.ok){const data=await response.json();throw new Error(typeof data.detail==='string'?data.detail:'PDF读取失败，请重新登录或重试。')}
      if(!response.headers.get('content-type')?.includes('application/pdf'))throw new Error('后台未返回PDF文件，不能显示为预览成功。')
      const blob=await response.blob()
      if(request!==fileRequest.current)return
      setBlobUrl(URL.createObjectURL(blob))
      await renderPage(record,1,request)
    }catch(cause){if(request===fileRequest.current)setError((cause as Error).message)}
  }
  async function renderPage(record:ExportRecord,number:number,request=fileRequest.current){
    setPageBusy(true);setErrorAction('page');setError('')
    try{
      const response=await fetch(`/api${prefix}/${record.id}/pages/${number}`,{credentials:'include'})
      if(!response.ok){const data=await response.json();throw new Error(data.detail||'PDF页面预览失败，仍可下载原文件。')}
      const image=await response.blob()
      if(request!==fileRequest.current)return
      setPageCount(Number(response.headers.get('X-PDF-Pages')));setPageNumber(number);setImageUrl(URL.createObjectURL(image))
    }catch(cause){if(request===fileRequest.current)setError((cause as Error).message)}finally{if(request===fileRequest.current)setPageBusy(false)}
  }
  async function generate(){
    if(!selection||!preview||!approved||busy)return
    setBusy('generate');setErrorAction('preflight');setError('')
    try{
      const record=await api<ExportRecord>(prefix,{method:'POST',body:JSON.stringify({...selection,preview_hash:preview.preview_hash})})
      setPreview(null);setApproved(false);setOffset(0);setAttempt(x=>x+1)
      if(record.status!=='completed'){setError(record.error||'生成失败，请重新预览后重试。');return}
      await openFile(record)
    }catch(cause){setPreview(null);setApproved(false);setError((cause as Error).message)}
    finally{setBusy('')}
  }
  return <section className="pdf-export-panel" id="pdf-export" aria-labelledby="pdf-export-title"><div className="pdf-export-heading"><div><p className="calc-step">成果导出 · 已接通</p><h2 id="pdf-export-title">单条结论 PDF 核验报告</h2><p>只读取已保存结果，不重新计算或调用模型。每次生成独立文件，原件和旧导出保持不变。</p></div><span className="calc-soft-tag">PDF · 中文字体嵌入</span></div>
    {!revision?<div className="empty-panel"><h3>先选择一个已保存修订版本。</h3><p>在上方选择实际原句，再保存修订或查看已有版本。当前项目已有的导出记录仍可在下方查看。</p></div>:<div className="pdf-export-selection"><p><b>当前选择：该原句的 v{revision.version}</b> · {revision.basis.report.name}</p><details><summary>查看本次导出的已保存修订句</summary><blockquote>{revision.text}</blockquote></details><label className="work-field">本次报告使用的复核记录<select aria-label="本次报告使用的复核记录" value={choice} disabled={!!busy} onChange={e=>{setChoice(e.target.value);setPreview(null);setApproved(false)}}><option value="">请明确选择，不自动使用最近一次结果</option><option value="none">不选择复核记录，按待复核导出</option>{revision.rechecks.map(event=><option key={event.id} value={event.id}>{displayDate(event.created_at)} · {revisionStatus[event.result.status]}{event.stale?' · 已过期':''} · {event.id.slice(0,8)}</option>)}</select></label>{dirty&&<p className="calc-warning">有未保存的草稿修改。请先保存或撤回草稿，再导出已保存版本。</p>}<button className="button button-secondary" disabled={!!busy||!choice||dirty} onClick={()=>void preflight()}>{busy==='preview'?'正在检查导出内容…':'检查导出范围与状态'}</button></div>}
    {preview&&revision&&preview.snapshot.revision.id===revision.id&&<div className="pdf-export-preflight" role="region" aria-label="导出前确认"><h3>生成前确认</h3><dl><div><dt>项目 / 报告</dt><dd>{preview.snapshot.project_name} / {preview.snapshot.report.name}</dd></div><div><dt>修订版本</dt><dd>该原句 v{preview.snapshot.revision.version}，不是整篇文件版本</dd></div><div><dt>报告状态</dt><dd>{revisionStatus[preview.snapshot.status]??preview.snapshot.status}</dd></div><div><dt>选定复核</dt><dd>{preview.snapshot.recheck?`${displayDate(preview.snapshot.recheck.created_at)} · ${preview.snapshot.recheck.id}`:'未选择，待复核；不填写其他版本结果'}</dd></div><div><dt>证据摘录</dt><dd>{preview.snapshot.evidence.rows.length} 条，上限{preview.snapshot.evidence.limit}；PDF另列完整计算记录数</dd></div></dl>{preview.snapshot.warnings.map((w,i)=><p className="calc-warning" key={i}>{w}</p>)}<label className="calc-confirm"><input type="checkbox" checked={approved} disabled={!!busy||dirty} onChange={e=>setApproved(e.target.checked)}/><span>确认导出上述已保存版本与所选复核；仅核验一个百分比，不代表整篇报告通过。</span></label><button className="button button-primary" disabled={!!busy||!approved||dirty} onClick={()=>void generate()}>{busy==='generate'?'正在生成PDF并保存…':'确认并生成 PDF'}</button><p className="calc-help">生成前后台再次检查资料、规则和版本；若状态变化，请刷新此预览并重新确认。</p></div>}
    {error&&<RequestError message={error} retry={()=>{setError('');if(errorAction==='file'&&opened)void openFile(opened);else if(errorAction==='page'&&opened)void renderPage(opened,pageNumber);else void preflight()}}/>}
    {opened&&<div className="pdf-export-preview"><div className="pdf-preview-top"><div><h3>已生成PDF · 原句 v{opened.version}</h3><p>{opened.report_name} · {displayDate(opened.created_at)} · {revisionStatus[opened.report_status]??opened.report_status}</p></div><button className="text-link" onClick={()=>{fileRequest.current++;setOpened(null);setBlobUrl('');setImageUrl('')}}>关闭预览</button></div>{opened.historical&&<p className="calc-warning">历史导出：{opened.historical_reasons.join('；')}。当前预览仍是生成时的原文件。</p>}{blobUrl?<><div className="revision-actions"><a className="button button-primary" href={blobUrl} download={`数有依据-单条核验-v${opened.version}-${opened.id.slice(0,8)}.pdf`}>下载此 PDF</a><a className="button button-secondary" href={`/api${prefix}/${opened.id}/file`} target="_blank" rel="noreferrer">在新窗口打开 PDF ↗</a></div><div className="pdf-page-pagination"><span>第 {pageNumber} / {pageCount||'—'} 页 · {pageBusy?'正在读取页面…':'从已保存PDF渲染'}</span><div><button disabled={pageBusy||pageNumber<=1} onClick={()=>void renderPage(opened,pageNumber-1)}>上一页 PDF</button><button disabled={pageBusy||pageNumber>=pageCount} onClick={()=>void renderPage(opened,pageNumber+1)}>下一页 PDF</button></div></div>{imageUrl?<><button className="text-link pdf-zoom-button" onClick={()=>setZoom(v=>!v)}>{zoom?'适合宽度':'放大阅读'}</button><div className={`pdf-page-image ${zoom?'is-zoomed':''}`} tabIndex={0} aria-label="PDF页面预览，放大后可在框内滚动"><img src={imageUrl} alt={`已保存PDF第${pageNumber}页，文字版可下载PDF查看`} /></div></>:<p role="status">正在渲染已保存PDF的页面…</p>}<p className="calc-help">预览页从同一已保存PDF渲染，下载原文件可搜索文字。翻页不重新计算或生成报告。</p><details><summary>文件完整性</summary><code>{opened.sha256}</code><p>{opened.size_bytes.toLocaleString()} 字节 · {opened.id}</p></details></>:!error&&<p role="status">正在读取已保存的PDF…</p>}</div>}
    <div className="pdf-export-history"><h3>当前项目的导出记录</h3><p className="calc-help">记录来自后台。历史文件不会随当前资料或规则变化而重新生成，失败记录不会显示为成功。</p>{listError&&<RequestError message={listError} retry={()=>setAttempt(x=>x+1)}/>}<button className="text-link" onClick={()=>setAttempt(x=>x+1)}>刷新导出记录</button>{list?.items.map(record=><article className="pdf-export-record" key={record.id}><div><b>原句 v{record.version} · {record.report_name}</b><p>{displayDate(record.created_at)} · {record.status==='failed'?'生成失败':revisionStatus[record.report_status]??record.report_status}</p><small>复核：{record.recheck_id??'未选，待复核'}</small>{record.historical&&<p className="calc-warning">历史导出 · {record.historical_reasons.join('；')}</p>}{record.error&&<p role="alert">{record.error}</p>}</div>{record.status==='completed'?<div className="revision-actions"><button className="button button-secondary small" onClick={()=>void openFile(record)}>预览此 PDF</button><a className="text-link" href={`/api${prefix}/${record.id}/file?download=true`}>下载 ↧</a></div>:<p className="calc-help">请在上方选择版本，重新检查导出范围后重试；不会替换此失败记录。</p>}</article>)}{list&&!list.total&&<p className="calc-empty-small">当前项目尚无导出记录。</p>}<div className="calc-pagination"><span>{list?`共 ${list.total} 条 · 每页10条`:'正在读取导出记录…'}</span><div><button disabled={!offset} onClick={()=>setOffset(x=>x-10)}>上一页导出</button><button disabled={!list||offset+10>=list.total} onClick={()=>setOffset(x=>x+10)}>下一页导出</button></div></div></div>
    <p className="pdf-scope-note">已接通：单条百分比PDF报告。未接通：整篇合并、批量导出、DOCX、XLSX。导出不证明原始资料真实性。</p>
  </section>
}
