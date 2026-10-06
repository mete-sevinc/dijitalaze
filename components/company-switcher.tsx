'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { switchCompany } from '@/app/actions/company'

export function CompanySwitcher({ companies, activeId }: { companies: { id: string; name: string }[]; activeId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function onChange(id: string) {
    setBusy(true)
    const res = await switchCompany(id)
    setBusy(false)
    if (res.success) router.refresh()
  }

  return (
    <select
      aria-label="Firma seç"
      value={activeId}
      disabled={busy}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm px-3 py-2 bg-slate-100 rounded border border-slate-200 text-slate-900"
    >
      {companies.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  )
}
