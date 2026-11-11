export function scrollToId(id: string) {
  const target = document.getElementById(id)
  target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
  target?.focus({ preventScroll: true })
}
