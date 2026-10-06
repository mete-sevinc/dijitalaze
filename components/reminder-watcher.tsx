'use client'

import { useEffect, useState } from 'react'
import { claimDueReminders } from '@/app/actions/assistant'

interface Reminder {
  id: string
  title: string
}

const POLL_MS = 30_000

export function ReminderWatcher() {
  const [items, setItems] = useState<Reminder[]>([])

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    let stopped = false
    async function poll() {
      try {
        const due = await claimDueReminders()
        if (stopped || due.length === 0) return
        setItems((prev) => [...prev, ...due])
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          for (const r of due) new Notification('Hatırlatma', { body: r.title })
        }
      } catch {
        // oturum düşmüş/ağ hatası: sonraki turda tekrar denenir
      }
    }
    poll()
    const timer = setInterval(poll, POLL_MS)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [])

  if (items.length === 0) return null
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2" role="status" aria-live="polite">
      {items.map((r) => (
        <div key={r.id} className="bg-amber-100 border border-amber-300 text-amber-900 rounded shadow px-4 py-3 flex items-start gap-3 max-w-sm">
          <span>⏰</span>
          <p className="flex-1 text-sm font-medium">{r.title}</p>
          <button
            onClick={() => setItems((prev) => prev.filter((x) => x.id !== r.id))}
            className="text-sm underline"
            aria-label="Hatırlatmayı kapat"
          >
            Kapat
          </button>
        </div>
      ))}
    </div>
  )
}
