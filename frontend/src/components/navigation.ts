import type { KeyboardEvent } from 'react'

// Arrow/Home/End support for the existing button-based evidence and help tabs.
export function tabKeys(event: KeyboardEvent<HTMLElement>) {
  const target = event.target as HTMLElement
  if (target.getAttribute('role') !== 'tab') return
  const list = target.closest('[role="tablist"]')
  if (!list) return
  const tabs = [...list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)')]
  const index = tabs.indexOf(target as HTMLButtonElement)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 :
    ['ArrowRight', 'ArrowDown'].includes(event.key) ? (index + 1) % tabs.length :
      ['ArrowLeft', 'ArrowUp'].includes(event.key) ? (index - 1 + tabs.length) % tabs.length : -1
  if (next < 0 || !tabs[next]) return
  event.preventDefault(); tabs[next].focus(); tabs[next].click()
}

export function scrollToId(id: string) {
  const target = document.getElementById(id)
  target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
  target?.focus({ preventScroll: true })
}
