import { useRef, useState, type ReactNode } from 'react'
import { api, type Asset, type Preview } from '../api'
import type { RuleSnapshot } from '../aiTypes'
import { currentDemoRule, demoRuleName, demoRules, demoRuleSha, demoRuleText, unifiedDemo, useDemoRuleHead, type RuleHead, type UnifiedDemo } from '../unifiedDemo'
import './DemoRules.css'

function RuleValues({ demo }: { demo: UnifiedDemo }) {
  return <dl className="demo-rules-values">
    {demoRules(demo).map(rule => <div key={rule.key}><dt>{rule.label}</dt><dd>{rule.value}</dd></div>)}
  </dl>
}

async function saveDemoRules(projectId: string, demo: UnifiedDemo) {
  const project = `/projects/${projectId}`
  const readAssets = () => api<Asset[]>(`${project}/assets`)
  const readHead = () => api<RuleHead>(`${project}/rule-snapshots`)
  const readRoles = () => api<string[]>(`${project}/rule-materials`)
  const [assets, head, roles] = await Promise.all([readAssets(), readHead(), readRoles()])
  const isSameDemo = (list: Asset[]) => {
    const fresh = unifiedDemo(list)
    return fresh && fresh.table.id === demo.table.id && fresh.report.id === demo.report.id && fresh.image.id === demo.image.id
      && JSON.stringify(fresh.spec) === JSON.stringify(demo.spec)
  }
  if (!isSameDemo(assets)) throw new Error('演示资料已变化，请刷新页面核对。')
  const existing = currentDemoRule(head, demo)
  if (existing) return existing
  if (head.items.length) throw new Error('项目已有规则版本，请在确认统计规则中核对当前版本。')

  const ruleAsset = assets.find(asset => asset.kind === 'report' && asset.sha256 === demoRuleSha && roles.includes(asset.id))
    ?? assets.find(asset => asset.kind === 'report' && asset.sha256 === demoRuleSha)
  if (roles.some(id => id !== ruleAsset?.id)) throw new Error('项目已指定其他规则资料，请在确认统计规则中核对。')

  let source = ruleAsset ?? await api<Asset>(`${project}/reports`, {
    method: 'POST', body: JSON.stringify({ name: demoRuleName, text: demoRuleText }),
  })
  for (let i = 0; i < 20 && ['uploaded', 'parsing'].includes(source.status); i++) {
    await new Promise(resolve => window.setTimeout(resolve, 200))
    source = await api<Asset>(`/assets/${source.id}`)
  }
  if (source.sha256 !== demoRuleSha || source.status !== 'ready') {
    throw new Error(source.error ?? '规则原文尚未解析完成。稍后可点同一个确认按钮重试。')
  }
  const { paragraphs } = await api<Preview>(`/assets/${source.id}/preview?limit=2`)
  const [paragraph] = paragraphs ?? []
  const fields = demoRules(demo)
  if (!paragraph || paragraph.text !== demoRuleText || fields.some(field => !paragraph.text.includes(field.quote))) {
    throw new Error('无法定位演示口径的原文出处，请查看规则资料。')
  }

  if (!roles.includes(source.id)) await api(`${project}/rule-materials/${source.id}`, {
    method: 'PUT', body: JSON.stringify({ enabled: true }),
  })
  const [latest, updatedAssets, updatedRoles] = await Promise.all([readHead(), readAssets(), readRoles()])
  const alreadySaved = currentDemoRule(latest, demo)
  if (alreadySaved && isSameDemo(updatedAssets)) return alreadySaved
  if (latest.items.length || !isSameDemo(updatedAssets) || updatedRoles.length !== 1 || updatedRoles[0] !== source.id) {
    throw new Error('项目资料或规则已更新，请刷新并重新核对。')
  }
  return api<RuleSnapshot>(`${project}/rule-snapshots`, { method: 'POST', body: JSON.stringify({
    previous_id: null, context_hash: latest.context_hash, constraints: demo.spec,
    sources: Object.fromEntries(fields.map(field => [field.key, { asset_id: source.id, paragraph_id: paragraph.id, quote: field.quote }])),
    confirmed_fields: fields.map(field => field.key), unresolved: [], change_reason: '用户核对并确认了统一演示资料的九项统计规则。',
  }) })
}

export function DemoRuleCard({ projectId, assets, revision, onSaved }: {
  projectId: string; assets: Asset[]; revision: number; onSaved: () => Promise<void>;
}) {
  const demo = unifiedDemo(assets)
  const head = useDemoRuleHead(projectId, !!demo, `${revision}:${assets.length}`)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<RuleSnapshot | null>(null)
  const [error, setError] = useState('')
  const pending = useRef(false)
  if (!demo || (!head && !saved)) return null

  const active = head ? currentDemoRule(head, demo) : saved
  const selectedDemo = demo
  async function confirm() {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const save = () => saveDemoRules(projectId, selectedDemo)
      setSaved(await (navigator.locks ? navigator.locks.request(`syj-demo-rule:${projectId}`, save) : save()))
      await onSaved()
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  if (active) return <section className="calc-card demo-rules" aria-label="统一演示口径">
    <h2>演示口径已确认 · v{active.version}</h2>
    <p>数据分析、文字核验和图片核验可以沿用这份规则。</p>
    <a className="button button-primary small" href={`/app/projects/${projectId}/analysis`}>进入数据分析</a>
  </section>
  if (head?.items.length) return null
  return <section className="calc-card demo-rules" aria-label="统一演示口径">
    <h2>已识别三份统一演示资料</h2>
    <p>以下九项已填好。点击确认后，项目会保存演示规则原文和已确认口径。</p>
    <RuleValues demo={demo} />
    <details><summary>查看将保存的规则原文</summary><blockquote>{demoRuleText}</blockquote></details>
    {error && <p className="work-error" role="alert">{error}</p>}
    <button type="button" className="button button-primary" disabled={busy} onClick={() => void confirm()}>
      {busy ? '正在保存演示口径…' : '确认并保存演示口径'}
    </button>
  </section>
}

export function DemoVerificationConfirm({ demo, snapshot, target, note, disabled, onConfirm, children }: {
  demo: UnifiedDemo; snapshot: RuleSnapshot; target: string; note: string; disabled?: boolean;
  onConfirm: () => Promise<void>; children: ReactNode;
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  async function confirm() {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try { await onConfirm() }
    catch (cause) { setError((cause as Error).message) }
    finally { pending.current = false; setBusy(false) }
  }
  const source = snapshot.sources.metric
  return <div className="demo-rules">
    <h2>确认本次核验</h2>
    <p><strong>{target}</strong> · 沿用已确认口径 v{snapshot.version}</p>
    <RuleValues demo={demo} />
    <p>{note}</p>
    <details><summary>规则依据 · {source.name}</summary><blockquote>{source.text}</blockquote></details>
    {error && <p className="work-error" role="alert">{error}</p>}
    <button type="button" className="button button-primary" disabled={busy || disabled} onClick={() => void confirm()}>
      {busy ? '正在检查并提交…' : '确认并计算'}
    </button>
    <details><summary>手动核对或调整方案</summary><fieldset disabled={busy}>{children}</fieldset></details>
  </div>
}
