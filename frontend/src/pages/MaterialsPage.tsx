import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api, displaySize, displayDate, uploadFile } from '../api'
import type { Asset, Preview, Project } from '../api'
import { WorkShell, RequestError } from '../components/WorkShell'
import { FieldsEditor, RulesEditor } from '../components/MaterialEditors'
import { RuleLibrary } from '../components/RuleLibrary'
import { Icon } from '../components/ui'

type Upload = { id: string; file: File; status: 'uploading' | 'failed'; progress: number; error: string }
const statusText = { uploaded: '已接收，等待解析', parsing: '正在解析', ready: '解析完成', failed: '解析失败' }

function Materials({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [selectedId, setSelectedId] = useState(new URLSearchParams(window.location.search).get('asset') ?? '')
  const [sheetId, setSheetId] = useState(new URLSearchParams(window.location.search).get('sheet') ?? 's1')
  const [previewResult, setPreviewResult] = useState<{ key: string; data: Preview | null; error: string } | null>(null)
  const linkedRow = Math.max(2, Number(new URLSearchParams(window.location.search).get('row')) || 2)
  const linkedParagraph = useRef(new URLSearchParams(window.location.search).get('paragraph'))
  const [offset, setOffset] = useState(() => Math.max(0, Number(new URLSearchParams(window.location.search).get('offset')) || Math.floor((linkedRow-2)/50)*50))
  const [loading, setLoading] = useState(true)
  const [limits, setLimits] = useState<{ upload_bytes: number; files: number } | null>(null)
  const [error, setError] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [previewAttempt, setPreviewAttempt] = useState(0)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [fieldDirty, setFieldDirty] = useState(false)
  const [mobilePanel, setMobilePanel] = useState(() => new URLSearchParams(window.location.search).has('asset') ? 'preview' : 'files')
  const [reportName, setReportName] = useState('')
  const [reportText, setReportText] = useState('')
  const [reportError, setReportError] = useState('')
  const [savingReport, setSavingReport] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [encoding, setEncoding] = useState('auto')
  const [delimiter, setDelimiter] = useState('auto')
  const input = useRef<HTMLInputElement>(null)
  const pasteDialog = useRef<HTMLDialogElement>(null)
  const pasteTrigger = useRef<HTMLButtonElement | null>(null)
  const uploadingIds = useRef(new Set<string>())
  const selected = assets.find(asset => asset.id === selectedId)
  const sheet = selected?.summary.sheets?.find(item => item.id === sheetId) ?? selected?.summary.sheets?.[0]
  const assetId = selected?.id
  const assetStatus = selected?.status
  const activeSheetId = sheet?.id ?? 's1'
  const previewKey = `${assetId}:${assetStatus}:${activeSheetId}:${offset}:${previewAttempt}`
  const preview = previewResult?.key === previewKey ? previewResult.data : null
  const previewLoading = assetStatus === 'ready' && previewResult?.key !== previewKey
  const requestPreviewError = previewResult?.key === previewKey ? previewResult.error : ''
  useEffect(() => {
    if (!preview || !new URLSearchParams(window.location.search).has('row')) return
    const frame = requestAnimationFrame(() => {
      const row = document.querySelector('.linked-source-row')
      const scroll = row?.closest('.data-grid-scroll')
      if (row && scroll) scroll.scrollBy({ top: row.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 70, behavior: 'instant' })
    })
    return () => cancelAnimationFrame(frame)
  }, [preview, linkedRow])
  useEffect(() => {
    if (!preview || !linkedParagraph.current) return
    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(linkedParagraph.current!)
      element?.classList.add('linked-source-paragraph')
      element?.scrollIntoView({ behavior: 'instant', block: 'center' })
    })
    return () => cancelAnimationFrame(frame)
  }, [preview])

  const refreshAssets = useCallback(async () => {
    const values = await api<Asset[]>(`/projects/${projectId}/assets`)
    setAssets(values)
    setSelectedId(current => values.some(asset => asset.id === current) ? current : values[0]?.id ?? '')
  }, [projectId])
  const load = useCallback(() => {
    return Promise.all([api<Project>(`/projects/${projectId}`), api<Asset[]>(`/projects/${projectId}/assets`), api<{ limits: { upload_bytes: number; files: number } }>('/health')]).then(([value, files, health]) => {
      setLimits(health.limits)
      setProject(value); setAssets(files); setSelectedId(current => files.some(asset => asset.id === current) ? current : files[0]?.id ?? ''); setError('')
      document.title = `${value.name} · 资料与口径 · 数有依据`
    }).catch(cause => setError((cause as Error).message)).finally(() => setLoading(false))
  }, [projectId])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!assets.some(asset => ['uploaded', 'parsing'].includes(asset.status))) return
    const timer = window.setTimeout(() => { void refreshAssets().catch(cause => setError((cause as Error).message)) }, 1000)
    return () => window.clearTimeout(timer)
  }, [assets, refreshAssets])
  useEffect(() => {
    if (!selectedId) return
    const params = new URLSearchParams({ asset: selectedId, sheet: sheet?.id ?? 's1' })
    if (new URLSearchParams(window.location.search).has('row')) params.set('row', String(linkedRow))
    if (linkedParagraph.current) { params.set('paragraph', linkedParagraph.current); params.set('offset', String(offset)) }
    window.history.replaceState(null, '', window.location.pathname + '?' + params.toString())
  }, [selectedId, sheet?.id, linkedRow, offset])
  useEffect(() => {
    if (!assetId || assetStatus !== 'ready') return
    const controller = new AbortController()
    api<Preview>(`/assets/${assetId}/preview?sheet=${activeSheetId}&offset=${offset}`, { signal: controller.signal }).then(data => setPreviewResult({ key: previewKey, data, error: '' })).catch(cause => {
      if (!controller.signal.aborted) setPreviewResult({ key: previewKey, data: null, error: (cause as Error).message })
    })
    return () => controller.abort()
  }, [assetId, assetStatus, activeSheetId, offset, previewKey])
  useEffect(() => {
    if (!uploads.some(item => item.status === 'uploading')) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [uploads])

  function selectAsset(id: string) {
    if (id !== selectedId && fieldDirty && !window.confirm('字段说明尚未保存。切换资料会放弃这些字段修改，是否继续？')) return
    if (id !== selectedId) { linkedParagraph.current = null; setFieldDirty(false); setSheetId('s1'); setOffset(0); setEncoding('auto'); setDelimiter('auto') }
    if (id !== selectedId) { const params = new URLSearchParams(window.location.search); params.delete('row'); window.history.replaceState(null, '', window.location.pathname + '?' + params.toString()) }
    setSelectedId(id); setMobilePanel('preview'); setPreviewError('')
  }
  async function sendUpload(item: Upload) {
    if (uploadingIds.current.has(item.id)) return
    uploadingIds.current.add(item.id)
    setUploads(current => current.map(entry => entry.id === item.id ? { ...entry, status: 'uploading', error: '', progress: 0 } : entry))
    try {
      const asset = await uploadFile(projectId, item.file, progress => setUploads(current => current.map(entry => entry.id === item.id ? { ...entry, progress } : entry)))
      setAssets(current => [...current.filter(entry => entry.id !== asset.id), asset])
      setUploads(current => current.filter(entry => entry.id !== item.id))
      setSelectedId(current => current || asset.id)
      await refreshAssets().catch(cause => setError((cause as Error).message))
    } catch (cause) { setUploads(current => current.map(entry => entry.id === item.id ? { ...entry, status: 'failed', error: (cause as Error).message } : entry)) }
    finally { uploadingIds.current.delete(item.id) }
  }
  function addFiles(files: FileList | null) {
    if (!files?.length) return
    const newUploads: Upload[] = Array.from(files).map(file => ({ id: crypto.randomUUID(), file, status: 'uploading', progress: 0, error: '' }))
    setUploads(current => [...current, ...newUploads])
    void (async () => { for (const item of newUploads) await sendUpload(item) })()
    if (input.current) input.current.value = ''
  }
  async function retryParse() {
    if (!selected || retrying) return
    setRetrying(true); setPreviewError('')
    try {
      await api(`/assets/${selected.id}/retry`, { method: 'POST', body: JSON.stringify({ encoding, delimiter }) })
      await refreshAssets()
    } catch (cause) { setPreviewError((cause as Error).message) }
    finally { setRetrying(false) }
  }
  async function saveReport(event: FormEvent) {
    event.preventDefault()
    if (savingReport) return
    if (!reportName.trim() || !reportText.trim()) { setReportError('请输入报告名称和正文。'); return }
    setSavingReport(true); setReportError('')
    try {
      const asset = await api<Asset>(`/projects/${projectId}/reports`, { method: 'POST', body: JSON.stringify({ name: reportName.trim(), text: reportText }) })
      setAssets(current => [...current, asset]); setSelectedId(current => current || asset.id)
      pasteDialog.current?.close(); setReportName(''); setReportText('')
      await refreshAssets().catch(cause => setError((cause as Error).message))
    } catch (cause) { setReportError((cause as Error).message) }
    finally { setSavingReport(false) }
  }
  if (loading && !project) return <div className="work-loading" role="status">正在读取项目与资料…</div>
  if (!project) return <><RequestError message={error || '项目不存在或无权访问。'} retry={() => void load()} /><a className="text-link" href="/app"><Icon name="back" />返回工作空间</a></>
  return <><div className="materials-heading"><div><a href="/app" className="material-back"><Icon name="back" />全部项目</a><h1>{project.name}</h1><p>{project.goal === 'analysis' ? '分析数据' : '核验已有报告'}<span>·</span>{assets.length} 份资料<span>·</span>创建于 {displayDate(project.created_at)}</p></div><div className="material-top-actions"><button className="button button-secondary small" onClick={event => { pasteTrigger.current = event.currentTarget; setReportError(''); pasteDialog.current?.showModal() }}><Icon name="edit" />粘贴报告</button><button className="button button-primary small" onClick={() => input.current?.click()}><Icon name="plus" />上传资料</button></div></div>
    {error && <RequestError message={error} retry={() => { setError(''); void refreshAssets().catch(cause => setError((cause as Error).message)) }} />}
    <div className="mobile-material-tabs" role="group" aria-label="资料页视图">{[['files', '资料列表'], ['preview', '内容预览'], ['rules', '字段与规则']].map(([id, name]) => <button key={id} aria-pressed={mobilePanel === id} onClick={() => setMobilePanel(id)}>{name}</button>)}</div>
    <input ref={input} className="sr-only" tabIndex={-1} type="file" multiple accept=".csv,.xlsx,.docx" aria-label="选择资料文件" onChange={event => addFiles(event.target.files)} />
    <div className={`material-columns panel-${mobilePanel}`}><aside className="file-panel"><div className="panel-top"><h2>项目资料</h2><span>{assets.length}</span></div><button className="upload-drop" onClick={() => input.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles(event.dataTransfer.files) }}><Icon name="plus" /><strong>点击或拖入文件</strong><span>CSV · XLSX · DOCX</span></button><p className="upload-limits">每份 ≤ {limits ? Math.floor(limits.upload_bytes / 1024 / 1024) : '…'} MiB，每项目 {limits?.files ?? '…'} 份。<br />PDF、图片和 XLS 暂不支持。</p>
      {uploads.map(item => <div className="pending-upload" key={item.id}><strong>{item.file.name}</strong><span>{item.status === 'failed' ? '上传失败' : item.progress === 100 ? '已发送，等待后台接收确认…' : `正在上传 ${item.progress}%`}</span>{item.status === 'uploading' ? <progress value={item.progress} max={100} aria-label={`${item.file.name}上传进度`} /> : <><p>{item.error}</p><button onClick={() => void sendUpload(item)}>重试上传</button><button onClick={() => setUploads(current => current.filter(entry => entry.id !== item.id))}>移除提示</button></>}</div>)}
      {assets.length === 0 && <p className="file-empty">还没有资料。上传一份表格，或粘贴报告正文。</p>}
      {(['table', 'report'] as const).map(kind => <div key={kind} className="file-group">{assets.some(asset => asset.kind === kind) && <h3>{kind === 'table' ? '数据表' : '报告'} <span>{assets.filter(asset => asset.kind === kind).length}</span></h3>}{assets.filter(asset => asset.kind === kind).map(asset => <button key={asset.id} className={`file-item ${selectedId === asset.id ? 'selected' : ''}`} aria-pressed={selectedId === asset.id} onClick={() => selectAsset(asset.id)}><span className={`file-type ${asset.kind}`}><Icon name={kind === 'table' ? 'table' : 'file'} /></span><span className="file-item-copy"><strong title={asset.name}>{asset.name}</strong><small>{displaySize(asset.size_bytes)} · v{asset.source_version}</small><span className={`parse-status ${asset.status}`}>{statusText[asset.status]}</span></span></button>)}</div>)}<p className="original-note"><Icon name="check" />原文件独立保存，不因预览或补充说明而改写。同名上传会新增一份资料。</p>
    </aside><section className="preview-panel" aria-label="资料预览"><div className="panel-top"><h2>{selected?.name ?? '内容预览'}</h2>{selected && <a href={`/api/assets/${selected.id}/original`} className="download-original">下载原文件<Icon name="down" /></a>}</div>{!selected ? <div className="preview-empty"><span className="empty-icon"><Icon name="table" /></span><h2>把资料放到一起。</h2><p>左侧选择表格或报告，<br />在这里预览内容，并在右侧补充字段与统计口径。</p><button className="button button-secondary small" onClick={() => input.current?.click()}>选择第一份资料</button></div> : <>
      <div className="preview-meta"><span className={`parse-status ${selected.status}`}>{statusText[selected.status]}</span><span>{selected.kind === 'table' ? `${selected.summary.sheets?.length ?? 0} 个工作表` : selected.summary.paragraph_count !== undefined ? `${selected.summary.paragraph_count} 个非空段落` : '报告'}</span><span>原始版本 v{selected.source_version}</span></div>
      {(previewError || requestPreviewError) && <RequestError message={previewError || requestPreviewError} retry={() => setPreviewAttempt(value => value + 1)} />}
      {selected.status === 'failed' ? <div className="parse-failure"><Icon name="info" /><h3>这份资料暂时无法解析</h3><p>{selected.error}</p><p>原文件已保留，其他资料可继续使用。</p>{selected.extension === '.csv' && <div className="csv-options"><label className="work-field">CSV 编码<select value={encoding} onChange={event => setEncoding(event.target.value)}><option value="auto">自动识别</option><option value="utf-8-sig">UTF-8 / BOM</option><option value="gb18030">GB18030 / GBK</option><option value="utf-16">UTF-16</option></select></label><label className="work-field">分隔符<select value={delimiter} onChange={event => setDelimiter(event.target.value)}><option value="auto">自动识别</option><option value=",">逗号</option><option value=";">分号</option><option value={'\t'}>制表符</option><option value="|">竖线</option></select></label></div>}<button className="button button-secondary small" disabled={retrying} onClick={retryParse}>{retrying ? '正在提交…' : '重试解析'}</button></div> : selected.status !== 'ready' ? <div className="work-loading" role="status">{statusText[selected.status]}，完成后自动显示内容。</div> : <>
        {selected.kind === 'table' && <div className="sheet-controls"><label>工作表<select aria-label="工作表" value={sheet?.id ?? ''} onChange={event => { setSheetId(event.target.value); setOffset(0) }}>{selected.summary.sheets?.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><span>{sheet?.row_count ?? 0} 行 · {sheet?.columns.length ?? 0} 列<span className="header-excluded">（不含表头）</span></span></div>}
        {previewLoading ? <div className="work-loading" role="status">正在读取预览…</div> : preview?.kind === 'table' ? <div className="data-grid-scroll" tabIndex={0} aria-label="表格预览，可横向滚动"><table className="data-grid"><caption className="sr-only">{selected.name}，{sheet?.name}；空值保留，原始行号可追溯</caption><thead><tr><th className="row-number">源行</th>{preview.columns?.map(column => <th key={column.id} title={column.id}><span>{column.letter}</span>{column.label}</th>)}</tr></thead><tbody>{preview.rows?.map(row => <tr key={row.id} className={new URLSearchParams(window.location.search).has('row') && row.source_row === linkedRow ? 'linked-source-row' : ''} data-source-id={row.id}><th scope="row" title={row.id}>{row.source_row}</th>{row.cells.map((cell, i) => <td key={i} title={`${row.id}:c${i+1}`}>{cell === null || cell === '' ? <span className="null-cell">空值</span> : String(cell)}</td>)}</tr>)}</tbody></table>{preview.total === 0 && <p className="search-empty">当前工作表没有数据行。</p>}</div> : preview?.kind === 'report' ? <div className="report-preview">{preview.paragraphs?.map((paragraph, i) => <article key={paragraph.id} id={paragraph.id} data-source-id={paragraph.id}><span className="paragraph-number">P{String(offset+i+1).padStart(2, '0')}</span><div><p className={paragraph.style.toLowerCase().includes('heading') || paragraph.style === 'Title' ? 'paragraph-heading' : ''}>{paragraph.text}</p><details className="paragraph-source"><summary>来源位置 · {paragraph.location}</summary><code>{paragraph.id}</code></details></div></article>)}</div> : null}
        {preview && <div className="preview-pagination"><span>共 {preview.total} {preview.kind === 'table' ? '行' : '段'} · {preview.total ? offset+1 : 0}–{Math.min(offset+preview.limit, preview.total)}</span><div><button disabled={offset === 0 || previewLoading} onClick={() => setOffset(value => Math.max(0, value-50))}>上一页</button><button disabled={offset+preview.limit >= preview.total || previewLoading} onClick={() => setOffset(value => value+50)}>下一页</button></div></div>}
        <div className="preview-notes">{selected.summary.notes?.map(note => <p key={note}><Icon name="info" />{note}</p>)}</div>
        {sheet && <details className="data-issues" open={sheet.issues.length > 0}><summary><Icon name="info" />数据体检<span>{sheet.issues.length ? `${sheet.issues.length} 项提示` : '未发现空值或表头问题'}</span></summary>{sheet.issues.map((issue, i) => <div key={i}><strong>{issue.message}</strong>{issue.locations.length > 0 && <p>位置：{issue.locations.join('、')}{issue.count > issue.locations.length ? '…（仅列出前 20 处）' : ''}</p>}</div>)}<p>仅检查能够明确识别的问题；未执行清洗或判断统计结论。</p></details>}
      </>}<details className="asset-source"><summary>文件来源标识与完整性</summary><dl><dt>资料 ID</dt><dd>{selected.id}</dd><dt>SHA-256</dt><dd>{selected.sha256}</dd><dt>上传时间</dt><dd>{displayDate(selected.created_at)}</dd></dl></details>
    </>}</section><aside className="inspector-panel" aria-label="字段与统计规则">{selected?.kind === 'table' && selected.status === 'ready' && <FieldsEditor key={selected.id} asset={selected} sheet={sheet} onDirty={setFieldDirty} onSaved={(fields, version) => setAssets(current => current.map(asset => asset.id === selected.id ? { ...asset, annotations: fields, annotation_version: version } : asset))} />}<RulesEditor key={project.id} project={project} /><RuleLibrary projectId={projectId} assets={assets} /></aside></div>
    <dialog ref={pasteDialog} className="work-dialog paste-dialog" aria-labelledby="paste-title" onCancel={event => { if (savingReport) event.preventDefault() }} onClose={() => pasteTrigger.current?.focus()}><form onSubmit={saveReport}><div className="work-dialog-heading"><h2 id="paste-title">粘贴报告文本</h2><button type="button" className="icon-button" aria-label="关闭粘贴报告" disabled={savingReport} onClick={() => pasteDialog.current?.close()}><Icon name="close" /></button></div><label className="work-field">报告名称<input autoFocus value={reportName} maxLength={120} disabled={savingReport} placeholder="例如：校园调查报告草稿" onChange={event => setReportName(event.target.value)} /></label><label className="work-field">报告正文<textarea rows={10} maxLength={1000000} value={reportText} disabled={savingReport} placeholder="粘贴报告正文，按非空行建立可定位段落。" onChange={event => setReportText(event.target.value)} /></label><p className="dialog-help">保存原始文本，每个非空行建立稳定来源标识。最多 100 万字符、20000 行。</p>{reportError && <p className="field-error" role="alert">{reportError}</p>}<div className="work-dialog-actions"><button type="button" className="button button-secondary" disabled={savingReport} onClick={() => pasteDialog.current?.close()}>取消</button><button className="button button-primary" disabled={savingReport}>{savingReport ? '正在保存…' : '保存报告'}<Icon name="check" /></button></div></form></dialog>
  </>
}

export function MaterialsPage({ projectId }: { projectId: string }) { return <WorkShell project>{() => <Materials projectId={projectId} />}</WorkShell> }
