'use client'
import { useCallback, useEffect, useState } from 'react'
import { getTasks } from '@/app/actions/tasks'
import { getEmployees } from '@/app/actions/employees'
import { assignTask, getPendingApprovals, resolveApproval, retryTask, reviewTask } from '@/app/actions/work'

interface Task {
  id: string
  title: string
  description?: string | null
  status: string
  priority: string
  result?: string | null
  assignee?: { name: string } | null
}
interface Employee {
  id: string
  name: string
  title: string
}
interface Approval {
  id: string
  employeeName: string
  action: string
  payload: string | null
  reason: string | null
}

const ACTION_LABELS: Record<string, string> = {
  create_task: 'Görev oluştur',
  create_meeting_action: 'Toplantı aksiyonu oluştur',
}

const STATUS_LABELS: Record<string, string> = {
  TODO: 'Sırada',
  IN_PROGRESS: 'Çalışıyor',
  BLOCKED: 'Takıldı',
  REVIEW: 'İncelemede',
  DONE: 'Bitti',
  CANCELLED: 'İptal',
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const [empId, setEmpId] = useState('')
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const [t, e, a] = await Promise.all([getTasks('demo_company'), getEmployees('demo_company'), getPendingApprovals()])
    if (t.success && t.data) setTasks(t.data as Task[])
    if (e.success && e.data) setEmployees(e.data as Employee[])
    setApprovals(a)
    setLoading(false)
  }, [])

  useEffect(() => {
    async function init() {
      try {
        await load()
      } catch {
        setError('Veriler yüklenemedi')
        setLoading(false)
      }
    }
    init()
  }, [load])

  // İş çalışırken sonucu görmek için sayfayı periyodik yenile.
  const working = tasks.some((t) => t.status === 'TODO' || t.status === 'IN_PROGRESS')
  useEffect(() => {
    if (!working) return
    const timer = setInterval(() => load().catch(() => {}), 6000)
    return () => clearInterval(timer)
  }, [working, load])

  async function run(key: string, fn: () => Promise<{ success: boolean; error?: string }>) {
    setBusy(key)
    setError(null)
    const res = await fn()
    if (!res.success) setError(res.error ?? 'İşlem başarısız')
    await load().catch(() => {})
    setBusy(null)
  }

  async function submitAssign() {
    if (!empId || !title.trim()) return
    await run('assign', async () => {
      const res = await assignTask(empId, title.trim(), desc.trim() || undefined)
      if (res.success) {
        setTitle('')
        setDesc('')
      }
      return res
    })
  }

  const inReview = tasks.filter((t) => t.status === 'REVIEW')
  const blocked = tasks.filter((t) => t.status === 'BLOCKED' && t.result)

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-slate-900">Görevler</h1>
        <p className="text-slate-600 mt-2">Personele iş ver, sonuçları incele. Onayların ve düzeltmelerin personelin hafızasına işlenir.</p>
      </div>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      <section id="yeni-gorev" className="bg-white rounded-lg shadow p-6 space-y-3 scroll-mt-4">
        <h2 className="text-xl font-semibold text-slate-900">Personele iş ver</h2>
        {employees.length === 0 ? (
          <p className="text-sm text-slate-500">Önce Çalışanlar sayfasından bir personel tanımla.</p>
        ) : (
          <form
            className="grid gap-3 md:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault()
              submitAssign()
            }}
          >
            <label className="sr-only" htmlFor="assign-emp">Personel</label>
            <select id="assign-emp" value={empId} onChange={(e) => setEmpId(e.target.value)} className="border border-slate-300 rounded px-3 py-2 text-sm">
              <option value="">Personel seç…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name} – {e.title}</option>
              ))}
            </select>
            <label className="sr-only" htmlFor="assign-title">İş başlığı</label>
            <input id="assign-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} placeholder="İş başlığı" className="border border-slate-300 rounded px-3 py-2 text-sm md:col-span-2" />
            <button disabled={!empId || !title.trim() || busy === 'assign'} className="px-4 py-2 bg-slate-900 text-white rounded text-sm disabled:opacity-50">
              {busy === 'assign' ? 'Veriliyor…' : 'İşi ver'}
            </button>
            <label className="sr-only" htmlFor="assign-desc">Ayrıntı</label>
            <textarea id="assign-desc" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={4000} rows={2} placeholder="Ayrıntılar, beklenen çıktı (isteğe bağlı)" className="border border-slate-300 rounded px-3 py-2 text-sm md:col-span-4" />
          </form>
        )}
      </section>

      {approvals.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-lg p-6 space-y-3">
          <h2 className="text-xl font-semibold text-amber-900">Onayını bekleyen eylemler ({approvals.length})</h2>
          <ul className="space-y-3">
            {approvals.map((a) => (
              <li key={a.id} className="bg-white rounded border border-amber-200 p-4 space-y-2">
                <p className="text-sm font-medium text-slate-900">{a.employeeName}: {ACTION_LABELS[a.action] ?? a.action}</p>
                {a.payload && <pre className="text-xs bg-slate-50 rounded p-2 whitespace-pre-wrap break-words">{a.payload}</pre>}
                <div className="flex flex-wrap gap-2 items-center">
                  <button disabled={busy === a.id} onClick={() => run(a.id, () => resolveApproval(a.id, true))} className="px-3 py-1.5 bg-green-600 text-white rounded text-sm disabled:opacity-50">Onayla</button>
                  <label className="sr-only" htmlFor={`rej-${a.id}`}>Red nedeni</label>
                  <input id={`rej-${a.id}`} value={notes[a.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))} placeholder="Red nedeni (personel bundan öğrenir)" className="border border-slate-300 rounded px-2 py-1.5 text-sm flex-1 min-w-48" />
                  <button disabled={busy === a.id} onClick={() => run(a.id, () => resolveApproval(a.id, false, notes[a.id]))} className="px-3 py-1.5 border border-red-300 text-red-700 rounded text-sm disabled:opacity-50">Reddet</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {inReview.length > 0 && (
        <section className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-3">
          <h2 className="text-xl font-semibold text-blue-900">İncelemeni bekleyen işler ({inReview.length})</h2>
          <ul className="space-y-4">
            {inReview.map((t) => (
              <li key={t.id} className="bg-white rounded border border-blue-200 p-4 space-y-3">
                <p className="text-sm font-medium text-slate-900">{t.assignee?.name ?? '—'}: {t.title}</p>
                <div className="text-sm text-slate-800 whitespace-pre-wrap bg-slate-50 rounded p-3 max-h-80 overflow-auto">{t.result}</div>
                <div className="flex flex-wrap gap-2 items-center">
                  <button disabled={busy === t.id} onClick={() => run(t.id, () => reviewTask(t.id, 'approve', notes[t.id]))} className="px-3 py-1.5 bg-green-600 text-white rounded text-sm disabled:opacity-50">Onayla</button>
                  <label className="sr-only" htmlFor={`rev-${t.id}`}>Not</label>
                  <input id={`rev-${t.id}`} value={notes[t.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [t.id]: e.target.value }))} placeholder="Not / düzeltme isteği" className="border border-slate-300 rounded px-2 py-1.5 text-sm flex-1 min-w-48" />
                  <button disabled={busy === t.id || !(notes[t.id] ?? '').trim()} onClick={() => run(t.id, () => reviewTask(t.id, 'revise', notes[t.id]))} className="px-3 py-1.5 border border-slate-300 rounded text-sm disabled:opacity-50">Düzelt</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {blocked.length > 0 && (
        <section className="bg-red-50 border border-red-200 rounded-lg p-6 space-y-3">
          <h2 className="text-xl font-semibold text-red-900">Takılan işler ({blocked.length})</h2>
          <ul className="space-y-3">
            {blocked.map((t) => (
              <li key={t.id} className="bg-white rounded border border-red-200 p-4 space-y-2">
                <p className="text-sm font-medium text-slate-900">{t.assignee?.name ?? '—'}: {t.title}</p>
                <p className="text-xs text-red-700 whitespace-pre-wrap break-words">{t.result}</p>
                <button disabled={busy === t.id} onClick={() => run(t.id, () => retryTask(t.id))} className="px-3 py-1.5 border border-slate-300 rounded text-sm disabled:opacity-50">Tekrar dene</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {loading ? (
        <div className="text-slate-500">Yükleniyor...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold">Başlık</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Atanan</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Durum</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Öncelik</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-b hover:bg-slate-50">
                  <td className="px-6 py-4">{task.title}</td>
                  <td className="px-6 py-4">{task.assignee?.name || '—'}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">{STATUS_LABELS[task.status] ?? task.status}</span>
                  </td>
                  <td className="px-6 py-4">{task.priority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
