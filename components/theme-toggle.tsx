'use client'
import { useSyncExternalStore } from 'react'

function subscribe(cb: () => void) {
  const o = new MutationObserver(cb)
  o.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => o.disconnect()
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains('dark'),
    () => false
  )

  function toggle() {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Açık temaya geç' : 'Koyu temaya geç'}
      className="text-sm px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded"
    >
      {dark ? '☀️ Açık' : '🌙 Koyu'}
    </button>
  )
}
