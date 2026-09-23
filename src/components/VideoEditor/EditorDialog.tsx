import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

export default function EditorDialog({ title, onClose, children, busy = false }: {
  title: string; onClose: () => void; children: ReactNode; busy?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ref.current?.focus()
    return () => previous?.focus()
  }, [])
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        if (!busy) onClose()
      }
      if (event.key !== 'Tab') return
      const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') ?? []).filter(el => el.getClientRects().length > 0)
      const first = items[0], last = items[items.length - 1]
      const active = document.activeElement
      if (!first) { event.preventDefault(); ref.current?.focus(); return }
      if (!ref.current?.contains(active) || active === ref.current) {
        event.preventDefault(); (event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && active === first) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', handleKey, true)
    return () => document.removeEventListener('keydown', handleKey, true)
  }, [busy, onClose])
  return <div className="export-modal-backdrop" onMouseDown={e => {
    if (e.target === e.currentTarget && !busy) onClose()
  }}>
    <div ref={ref} tabIndex={-1} className="export-modal" role="dialog" aria-modal="true" aria-label={title}>{children}</div>
  </div>
}
