'use client'
import { useCallback, useEffect, useState } from 'react'
import { deleteReport, generateReports, getReports } from '@/app/actions/reports'
import { getEmployees } from '@/app/actions/employees'
import { parseList, REPORT_LABELS, type ReportType } from '@/lib/reports'

interface Report {
  id: string
  type: ReportType
  periodStart: Date
  periodEnd: Date
  summary: string | null
  completedTasks: string | null
  activeTasks: string | null
  blockedTasks: string | null
  risks: string | null
  recommendations: string | null
  nextPriorities: string | null
  createdAt: Date
  employee: { name: string; title: string }
}
interface Employee {
  id: string
  name: string
}

const SECTIONS: { key: keyof Report; label: string }[] = [
  { key: 'completedTasks', label: 'Tamamlanan' },
  { key: 'activeTasks', label: 'Aktif' },
  { key: 'blockedTasks', label: 'Takılan' },
  { key: 'risks', label: 'Riskler' },
  { key: 'recommendations', label: 'Öneriler' },
  { key: 'nextPriorities', label: 'Öncelikler' },
]

const fmt = (d: Date) => new Date(d).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [filter, setFilter] = useState<ReportType | ''>('')
  const [type, setType] = useState<ReportType>('WEEKLY')
  const [empId, setEmpId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [r, e] = await Promise.all([getReports(filter || undefined), getEmployees()])
    if (r.success) setReports(r.data as Report[])
    else setError(r.error)
    if (e.success && e.data) setEmployees(e.data as Employee[])
    setLoading(false)
  }, [filter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  async function generate() {
    setBusy(true)
    setError(null)
    setMessage(null)
    const res = await generateReports(type, empId || undefined)
    if (res.success) {
      setMessage(`${res.count} rapor oluşturuldu.`)
      await load()
    } else setError(res.error)
    setBusy(false)
  }

  async function remove(id: string) {
    if (!window.confirm('Bu rapor silinsin mi?')) return
    setError(null)
    const res = await deleteReport(id)
    if (res.success) await load()
    else setError(res.error)
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-slate-900">Raporlar</h1>
        <p className="text-slate-600 mt-2">Çalışanların görev durumuna göre günlük, haftalık ve aylık raporlar</p>
      </div>

      <section className="bg-white rounded-lg shadow p-6 space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">Rapor oluştur</h2>
        <form
          className="grid gap-3 md:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault()
            generate()
          }}
        >
          <label className="sr-only" htmlFor="rep-type">Rapor türü</label>
          <select id="rep-type" value={type} onChange={(e) => setType(e.target.value as ReportType)} className="border border-slate-300 rounded px-3 py-2 text-sm">
            {(Object.keys(REPORT_LABELS) as ReportType[]).map((t) => (
              <option key={t} value={t}>{REPORT_LABELS[t]}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="rep-emp">Çalışan</label>
          <select id="rep-emp" value={empId} onChange={(e) => setEmpId(e.target.value)} className="border border-slate-300 rounded px-3 py-2 text-sm md:col-span-2">
            <option value="">Tüm aktif çalışanlar</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <button disabled={busy} className="px-4 py-2 bg-slate-900 text-white rounded text-sm disabled:opacity-50">
            {busy ? 'Oluşturuluyor…' : 'Oluştur'}
          </button>
        </form>
        {message && <p role="status" className="text-sm text-green-700">{message}</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </section>

      <div className="flex gap-2" role="group" aria-label="Tür filtresi">
        {([['', 'Tümü'], ['DAILY', 'Günlük'], ['WEEKLY', 'Haftalık'], ['MONTHLY', 'Aylık']] as const).map(([v, label]) => (
          <button
            key={v}
            aria-pressed={filter === v}
            onClick={() => setFilter(v as ReportType | '')}
            className={`px-3 py-1.5 rounded text-sm border ${filter === v ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-slate-500">Yükleniyor...</div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-slate-500">Henüz rapor yok. Yukarıdan oluşturabilirsin.</div>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="bg-white rounded-lg shadow p-5">
              <details>
                <summary className="cursor-pointer space-y-1">
                  <span className="font-medium text-slate-900">{r.employee.name}</span>
                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">{REPORT_LABELS[r.type]}</span>
                  <span className="ml-2 text-xs text-slate-500">{fmt(r.createdAt)}</span>
                  <p className="text-sm text-slate-700">{r.summary}</p>
                </summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {SECTIONS.map(({ key, label }) => {
                    const items = parseList(r[key] as string | null)
                    return (
                      <div key={key}>
                        <h3 className="text-sm font-semibold text-slate-800">{label}</h3>
                        {items.length === 0 ? (
                          <p className="text-sm text-slate-400">—</p>
                        ) : (
                          <ul className="list-disc ml-5 text-sm text-slate-700">
                            {items.map((it, i) => <li key={i}>{it}</li>)}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
                <button onClick={() => remove(r.id)} className="mt-4 px-3 py-1.5 border border-red-300 text-red-700 rounded text-xs">Sil</button>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
