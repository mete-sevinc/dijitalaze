'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createMeeting, getMeetings } from '@/app/actions/meetings'
import { getEmployees } from '@/app/actions/employees'
import { MEETING_STATUS_LABELS } from '@/lib/meeting-labels'

interface Meeting {
  id: string
  title: string
  status: string
  createdAt: Date
  participants: { employee: { name: string } }[]
  _count: { actionItems: number; messages: number }
}
interface Employee {
  id: string
  name: string
  title: string
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [agenda, setAgenda] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  const load = useCallback(async () => {
    const [m, e] = await Promise.all([getMeetings(), getEmployees()])
    if (m.success) setMeetings(m.data as Meeting[])
    else setError(m.error)
    if (e.success && e.data) setEmployees(e.data as Employee[])
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  async function create() {
    setBusy(true)
    setError(null)
    const res = await createMeeting({ title, agenda: agenda || undefined, participantIds: selected })
    if (res.success) {
      setTitle('')
      setAgenda('')
      setSelected([])
      await load()
    } else setError(res.error)
    setBusy(false)
  }

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-slate-900">Toplantılar</h1>
        <p className="text-slate-600 mt-2">Toplantı planla, not al, karar ve aksiyonları takip et</p>
      </div>

      <section className="bg-white rounded-lg shadow p-6 space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">Yeni toplantı</h2>
        {employees.length === 0 ? (
          <p className="text-sm text-slate-500">Önce Çalışanlar sayfasından bir personel tanımla.</p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              create()
            }}
          >
            <label className="sr-only" htmlFor="m-title">Başlık</label>
            <input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Toplantı başlığı" className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
            <label className="sr-only" htmlFor="m-agenda">Gündem</label>
            <textarea id="m-agenda" value={agenda} onChange={(e) => setAgenda(e.target.value)} maxLength={4000} rows={2} placeholder="Gündem (isteğe bağlı)" className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
            <fieldset>
              <legend className="text-sm font-medium text-slate-700 mb-1">Katılımcılar</legend>
              <div className="flex flex-wrap gap-2">
                {employees.map((e) => (
                  <label key={e.id} className={`px-3 py-1.5 rounded border text-sm cursor-pointer ${selected.includes(e.id) ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-700'}`}>
                    <input type="checkbox" className="sr-only" checked={selected.includes(e.id)} onChange={() => toggle(e.id)} />
                    {e.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <button disabled={busy || !title.trim() || selected.length === 0} className="px-4 py-2 bg-slate-900 text-white rounded text-sm disabled:opacity-50">
              {busy ? 'Oluşturuluyor…' : 'Toplantı oluştur'}
            </button>
          </form>
        )}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </section>

      {loading ? (
        <div className="text-slate-500">Yükleniyor...</div>
      ) : meetings.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-slate-500">Henüz toplantı yok.</div>
      ) : (
        <ul className="space-y-3">
          {meetings.map((m) => (
            <li key={m.id}>
              <Link href={`/meetings/${m.id}`} className="block bg-white rounded-lg shadow p-5 hover:shadow-md">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">{m.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">{MEETING_STATUS_LABELS[m.status] ?? m.status}</span>
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  {m.participants.map((p) => p.employee.name).join(', ')} · {m._count.actionItems} aksiyon · {m._count.messages} not
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
