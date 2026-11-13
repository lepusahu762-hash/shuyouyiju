export type User = { id: string; email: string; is_verified: boolean }
export type Rules = { scope: string; period: string; definition: string; missing_policy: string; notes: string }
export const emptyRules: Rules = { scope: '', period: '', definition: '', missing_policy: '', notes: '' }
export type Project = { id: string; name: string; goal: 'analysis' | 'verify'; created_at: string; updated_at: string; asset_count: number; rules: Partial<Rules>; rules_version: number }
export type Column = { id: string; name: string; label: string; index: number; letter: string }
export type Issue = { code: string; message: string; count: number; locations: string[]; column_id?: string }
export type Sheet = { id: string; name: string; row_count: number; columns: Column[]; issues: Issue[] }
export type FieldMeaning = { meaning: string; unit: string }
export type Asset = {
  id: string; project_id: string; name: string; kind: 'table' | 'report' | 'image'; extension: string; size_bytes: number; sha256: string;
  status: 'uploaded' | 'parsing' | 'ready' | 'failed'; error: string | null; source_version: number;
  summary: { width?:number; height?:number; source_id?:string; sheets?: Sheet[]; paragraph_count?: number; notes?: string[]; encoding?: string; delimiter?: string };
  annotations: Record<string, FieldMeaning>; annotation_version: number; created_at: string; updated_at: string;
}
export type Preview = { width?:number;height?:number;source_id?:string;kind: 'table' | 'report' | 'image'; total: number; offset: number; limit: number; columns?: Column[]; rows?: { id: string; source_row: number; source_line: number; cells: (string | number | boolean | null)[] }[]; paragraphs?: { id: string; location: string; text: string; style: string }[] }

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

function errorMessage(payload: unknown, status: number): string {
  const detail = (payload as { detail?: unknown } | null)?.detail
  const messages: Record<string, string> = {
    LOGIN_BAD_CREDENTIALS: '邮箱或密码不正确，请重新检查。',
    REGISTER_USER_ALREADY_EXISTS: '这个邮箱已经注册，请直接登录。',
    LOGIN_USER_NOT_VERIFIED: '该账户尚未完成验证。',
  }
  if (typeof detail === 'string' && messages[detail]) return messages[detail]
  if (status === 401) return '登录已过期或尚未登录，请重新登录后继续。'
  if (status === 503 && typeof detail === 'string' && detail.startsWith('真实 AI')) return detail
  if (status >= 500 || status === 0) return '暂时无法连接后台服务。请确认后台已启动，再重试；本次操作未确认保存。'
  if (typeof detail === 'string' && detail !== 'Unauthorized') return detail
  if (detail && typeof detail === 'object' && 'reason' in detail) return String(detail.reason)
  return '请求未完成，请检查输入后重试。'
}

// Coalesce only simultaneous default GETs. Never cache settled data, errors,
// writes, or callers with AbortSignals (one component must not cancel another).
const pendingReads = new Map<string, Promise<unknown>>()
export function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  if (Object.keys(options).length) return request<T>(url, options)
  const existing = pendingReads.get(url)
  if (existing) return existing as Promise<T>
  const pending = request<T>(url, options).finally(() => { pendingReads.delete(url) })
  pendingReads.set(url, pending)
  return pending
}

async function request<T>(url: string, options: RequestInit): Promise<T> {
  let response: Response
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 30000)
  try {
    response = await fetch('/api' + url, { ...options, credentials: 'same-origin', signal: options.signal ?? controller.signal,
      headers: { 'X-Requested-With': 'shuyouyiju', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } })
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new ApiError(errorMessage(null, 0), 0)
  } finally { window.clearTimeout(timeout) }
  if (response.status === 204) return undefined as T
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(errorMessage(payload, response.status), response.status)
  if (payload === null) throw new ApiError('后台响应格式不正确，请确认 API 服务已启动。', 502)
  return payload as T
}

export function uploadFile(projectId: string, file: File, progress: (percentage: number) => void): Promise<Asset> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/projects/${projectId}/assets`)
    xhr.setRequestHeader('X-Requested-With', 'shuyouyiju')
    xhr.withCredentials = true
    xhr.timeout = 120000
    xhr.upload.onprogress = event => { if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 100)) }
    xhr.onload = () => {
      let payload: unknown = null
      try { payload = JSON.parse(xhr.responseText) } catch { /* proxy may return plain text */ }
      if (xhr.status >= 200 && xhr.status < 300 && payload) resolve(payload as Asset)
      else reject(new ApiError(errorMessage(payload, xhr.status), xhr.status))
    }
    xhr.onerror = () => reject(new ApiError(errorMessage(null, 0), 0))
    xhr.ontimeout = () => reject(new ApiError('上传超时，请刷新资料列表确认是否已接收，再单独重试。', 0))
    const body = new FormData(); body.append('file', file); xhr.send(body)
  })
}

export function safeReturn(value: string | null): string {
  if (value === '/app' || value === '/app/templates' || value === '/app/me') return value
  if (!value?.startsWith('/')) return '/app'

  const hashAt = value.indexOf('#')
  const hash = hashAt >= 0 ? value.slice(hashAt + 1) : ''
  const withoutHash = hashAt >= 0 ? value.slice(0, hashAt) : value
  const queryAt = withoutHash.indexOf('?')
  const pathname = queryAt >= 0 ? withoutHash.slice(0, queryAt) : withoutHash
  const query = queryAt >= 0 ? new URLSearchParams(withoutHash.slice(queryAt + 1)) : new URLSearchParams()
  const route = pathname.match(/^\/app\/projects\/([0-9a-f-]{36})\/(materials|analysis|calculations|verify|ai-verification|review)$/)
  if (!route) return '/app'

  const [, , page] = route
  const safeQuery = new URLSearchParams()
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const sourceId = /^[0-9a-f-]{36}:v\d+:[A-Za-z0-9:._-]{1,160}$/i
  if (page === 'materials') {
    const asset = query.get('asset')
    const paragraph = query.get('paragraph')
    const row = query.get('row')
    const sheet = query.get('sheet')
    const offset = query.get('offset')
    if (asset && uuid.test(asset)) safeQuery.set('asset', asset)
    if (paragraph && sourceId.test(paragraph)) safeQuery.set('paragraph', paragraph)
    if (row && (/^\d{1,6}$/.test(row) || sourceId.test(row))) safeQuery.set('row', row)
    if (sheet && /^[A-Za-z0-9_-]{1,64}$/.test(sheet)) safeQuery.set('sheet', sheet)
    if (offset && /^\d{1,6}$/.test(offset)) safeQuery.set('offset', offset)
  } else if (page === 'analysis' || page === 'calculations') {
    for(const key of ['session','turn']){const id=query.get(key);if(id&&uuid.test(id))safeQuery.set(key,id)}
    const run = query.get('run')
    if (run && uuid.test(run)) safeQuery.set('run', run)
  } else if (page === 'review') {
    for (const key of ['check', 'revision']) { const id = query.get(key); if (id && uuid.test(id)) safeQuery.set(key, id) }
    const target = query.get('target'); if (target && /^\d{1,3}$/.test(target)) safeQuery.set('target', target)
  } else if (page === 'verify' || page === 'ai-verification') {
    if(query.get('mode')==='image')safeQuery.set('mode','image')
    const imageTask=query.get('imageTask');if(imageTask&&uuid.test(imageTask))safeQuery.set('imageTask',imageTask)
    const task = query.get('task')
    if (task && uuid.test(task)) safeQuery.set('task', task)
  }

  const safeHash = page==='materials'&&hash==='confirm-rules'?'#confirm-rules':hash === 'calculation-history' && (page === 'analysis' || page === 'calculations') ? `#${hash}` : ''
  const safeSearch = safeQuery.size ? `?${safeQuery.toString()}` : ''
  return pathname + safeSearch + safeHash
}
export function authHref() { return '/auth?next=' + encodeURIComponent(safeReturn(window.location.pathname + window.location.search + window.location.hash)) }
export function displayDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
export function displaySize(bytes: number) { return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / 1024 / 1024).toFixed(1)} MiB` }
