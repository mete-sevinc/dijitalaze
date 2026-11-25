'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

// Sidebar is an off-canvas drawer below the lg breakpoint and a static column above it.
export function AppShell({ nav, actions, children }: { nav: ReactNode; actions: ReactNode; children: ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [lastPath, setLastPath] = useState(pathname)
  const closeRef = useRef<HTMLButtonElement>(null)

  // Close the drawer on navigation. Adjusting state during render avoids an extra effect pass.
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="flex h-dvh">
      {open && (
        <button
          type="button"
          aria-label="Menüyü kapat"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      <aside
        id="app-sidebar"
        aria-label="Ana menü"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col overflow-y-auto overscroll-contain bg-slate-900 text-white transition-[transform,visibility] duration-200 lg:static lg:z-auto lg:translate-x-0 lg:visible lg:transition-none ${
          open ? 'visible translate-x-0' : 'invisible -translate-x-full'
        }`}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Menüyü kapat"
          className="absolute right-3 top-4 rounded px-2 py-1 text-xl text-slate-300 hover:bg-slate-800 hover:text-white lg:hidden"
        >
          ✕
        </button>
        {nav}
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-slate-50">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-8 md:py-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Menüyü aç"
            aria-expanded={open}
            aria-controls="app-sidebar"
            className="rounded bg-slate-100 px-3 py-2 text-lg hover:bg-slate-200 lg:hidden"
          >
            ☰
          </button>
          <span className="font-bold text-slate-900 lg:hidden">AZE Dijital</span>
          <div className="ml-auto flex min-w-0 items-center gap-2 md:gap-4">{actions}</div>
        </header>

        <div className="flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  )
}
