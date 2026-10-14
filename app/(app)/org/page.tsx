'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getOrgChart, setManager } from '@/app/actions/employees'
import { buildOrgTree, wouldCreateCycle, type OrgNode, type OrgPerson } from '@/lib/org'

export default function OrgPage() {
  const [people, setPeople] = useState<OrgPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await getOrgChart()
    if (res.success) setPeople(res.data as OrgPerson[])
    else setError(res.error)
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const tree = useMemo(() => buildOrgTree(people.map((p) => ({ ...p }))), [people])

  async function assign(id: string, managerId: string) {
    setBusy(id)
    setError(null)
    const res = await setManager(id, managerId || null)
    if (res.success) await load()
    else setError(res.error)
    setBusy(null)
  }

  function renderNode(n: OrgNode) {
    return (
      <li key={n.id} className="relative">
        <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-center gap-3">
          <span className="text-2xl" aria-hidden>{n.avatar || '👤'}</span>
          <div className="min-w-40">
            <Link href={`/employees/${n.id}`} className="font-medium text-slate-900 underline-offset-2 hover:underline">{n.name}</Link>
            <p className="text-sm text-slate-600">{n.title} · {n.department}</p>
            {n.status === 'PAUSED' && <p className="text-xs text-amber-700">Duraklatıldı</p>}
          </div>
          <label className="ml-auto text-sm text-slate-600 flex items-center gap-2">
            Yönetici
            <select
              value={n.managerId ?? ''}
              disabled={busy === n.id}
              onChange={(e) => assign(n.id, e.target.value)}
              className="border border-slate-300 rounded px-2 py-1 text-sm"
            >
              <option value="">Yok (üst düzey)</option>
              {people
                .filter((p) => p.id !== n.id && !wouldCreateCycle(people, n.id, p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </select>
          </label>
        </div>
        {n.reports.length > 0 && (
          <ul className="mt-3 ml-6 pl-6 border-l-2 border-slate-200 space-y-3">{n.reports.map(renderNode)}</ul>
        )}
      </li>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-slate-900">Organizasyon</h1>
        <p className="text-slate-600 mt-2">Kim kime bağlı: yöneticiyi buradan ata, çalışanlar iş birliği düzenini buna göre kurar</p>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {loading ? (
        <div className="text-slate-500">Yükleniyor...</div>
      ) : tree.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-slate-500">Henüz çalışan yok.</div>
      ) : (
        <ul className="space-y-3">{tree.map(renderNode)}</ul>
      )}
    </div>
  )
}
