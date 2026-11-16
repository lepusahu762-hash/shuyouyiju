import { useEffect, useState } from 'react'
import { api } from '../api'
import { RequestError } from './WorkShell'
import type { ProjectTemplate } from '../pages/TemplatesPage'
import { TemplateContents } from '../pages/TemplatesPage'
import '../Templates.css'

export function ProjectTemplatePanel({ projectId, prepare }: { projectId: string; prepare: (template: ProjectTemplate, button: HTMLButtonElement) => void }) {
  const [template, setTemplate] = useState<ProjectTemplate | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    api<{ template: ProjectTemplate | null }>(`/projects/${projectId}/template`, { signal: controller.signal }).then(result => { setTemplate(result.template); setError('') }).catch(cause => { if (!controller.signal.aborted) setError((cause as Error).message) })
    return () => controller.abort()
  }, [projectId, attempt])
  if (error) return <RequestError message={`模板草稿读取失败：${error}`} retry={() => setAttempt(value => value + 1)} />
  if (!template) return null
  return <section className="project-template-panel" aria-label="项目模板草稿"><div><h2>从「{template.name}」开始</h2><p>已保留使用时的 v{template.version} 内容。它是待完善的草稿，不是已确认的统计规则或计算结果。</p></div><details><summary>查看规则草稿与报告提纲</summary><TemplateContents template={template} /></details>{template.rule_notes && <button className="button button-secondary" onClick={event => prepare(template, event.currentTarget)}>完善并保存规则说明</button>}<p>下一步：上传本次资料 → 完善规则文本 → 指定为规则资料 → 逐项确认统计规则。</p></section>
}
