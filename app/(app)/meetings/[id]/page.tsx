'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { addActionItem, addMeetingNote, completeActionItem, completeMeeting, deleteMeeting, draftWrapUp, getMeeting, setMeetingStatus, speakNext } from '@/app/actions/meetings'
import { parseList } from '@/lib/reports'
import { ACTION_STATUS_LABELS, MEETING_STATUS_LABELS } from '@/lib/meeting-labels'

interface MeetingData {
  id: string
  title: string
  agenda: string | null
  status: string
  summary: string | null
  decisions: string | null
  startedAt: Date | null
  endedAt: Date | null
  participants: { employee: { id: string; name: string; title: string } }[]
  messages: { id: string; employeeId: string | null; content: string; createdAt: Date }[]
  actionItems: { id: string; content: string; assigneeId: string | null; status: string }[]
}

interface Suggestion {
  content: string
  assigneeId?: string
}

const fmt = (d: Date) => new Date(d).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [meeting, setMeeting] = useState<MeetingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [action, setAction] = useState('')
  const [assignee, setAssignee] = useState('')
  const [summary, setSummary] = useState('')
  const [decisions, setDecisions] = useState('')
  const [speaking, setSpeaking] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])

  const load = useCallback(async () => {
    const res = await getMeeting(id)
    if (res.success) setMeeting(res.data as MeetingData)
    else setError(res.error)
    setLoading(false)
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  async function run(fn: () => Promise<{ success: boolean; error?: string }>, after?: () => void) {
    setBusy(true)
    setError(null)
    const res = await fn()
    if (res.success) {
      after?.()
      await load()
    } else setError(res.error ?? 'İşlem başarısız')
    setBusy(false)
  }

  async function runRound() {
    if (!meeting) return
    setBusy(true)
    setError(null)
    for (let i = 0; i < meeting.participants.length; i++) {
      setSpeaking('Sıradaki konuşmacı hazırlanıyor…')
      const res = await speakNext(meeting.id)
      if (!res.success) {
        setError(res.error)
        break
      }
      if (res.done) {
        setError('Herkes konuşma hakkını kullandı. Toplantıyı tamamlayabilirsin.')
        break
      }
      setSpeaking(`${res.speaker} konuştu`)
      await load()
    }
    setSpeaking(null)
    setBusy(false)
  }

  async function prepareWrapUp() {
    if (!meeting) return
    setBusy(true)
    setError(null)
    const res = await draftWrapUp(meeting.id)
    if (res.success) {
      setSummary(res.data.summary)
      setDecisions(res.data.decisions.join('\n'))
      setSuggestions(res.data.actions)
    } else setError(res.error)
    setBusy(false)
  }

  async function removeMeeting() {
    if (!meeting || !window.confirm('Toplantı notları ve aksiyonlarıyla birlikte silinsin mi? Aksiyondan açılan görevler kalır.')) return
    setBusy(true)
    const res = await deleteMeeting(meeting.id)
    if (res.success) router.push('/meetings')
    else {
      setError(res.error)
      setBusy(false)
    }
  }

  if (loading) return <div className="p-8 text-slate-500">Yükleniyor...</div>
  if (!meeting) {
    return (
      <div className="p-8 space-y-3">
        <p role="alert" className="text-red-700">{error ?? 'Toplantı bulunamadı'}</p>
        <Link href="/meetings" className="text-sm underline">← Toplantılar</Link>
      </div>
    )
  }

  const open = meeting.status === 'SCHEDULED' || meeting.status === 'ACTIVE'
  const names = new Map(meeting.participants.map((p) => [p.employee.id, p.employee.name]))
  const decisionList = parseList(meeting.decisions)

  return (
    <div className="p-8 space-y-6">
      <div>
        <Link href="/meetings" className="text-sm text-slate-600 underline">← Toplantılar</Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-3xl font-bold text-slate-900">{meeting.title}</h1>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">{MEETING_STATUS_LABELS[meeting.status] ?? meeting.status}</span>
        </div>
        {meeting.agenda && <p className="text-slate-700 mt-2 whitespace-pre-wrap">{meeting.agenda}</p>}
        <p className="text-sm text-slate-500 mt-2">
          Katılımcılar: {meeting.participants.map((p) => `${p.employee.name} (${p.employee.title})`).join(', ')}
          {meeting.startedAt && ` · Başladı: ${fmt(meeting.startedAt)}`}
          {meeting.endedAt && ` · Bitti: ${fmt(meeting.endedAt)}`}
        </p>
        {error && <p role="alert" className="text-sm text-red-700 mt-2">{error}</p>}
      </div>

      <div className="flex gap-2">
        <button disabled={busy} onClick={removeMeeting} className="px-4 py-2 border border-red-300 text-red-700 rounded text-sm disabled:opacity-50">Toplantıyı sil</button>
      </div>

      {open && (
        <div className="flex gap-2">
          {meeting.status === 'SCHEDULED' && (
            <button disabled={busy} onClick={() => run(() => setMeetingStatus(meeting.id, 'ACTIVE'))} className="px-4 py-2 bg-green-600 text-white rounded text-sm disabled:opacity-50">Toplantıyı başlat</button>
          )}
          <button
            disabled={busy}
            onClick={() => window.confirm('Toplantı iptal edilsin mi?') && run(() => setMeetingStatus(meeting.id, 'CANCELLED'))}
            className="px-4 py-2 border border-red-300 text-red-700 rounded text-sm disabled:opacity-50"
          >
            İptal et
          </button>
        </div>
      )}

      {meeting.status === 'COMPLETED' && (
        <section className="bg-white rounded-lg shadow p-6 space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">Özet</h2>
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{meeting.summary}</p>
          {decisionList.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-slate-800 pt-2">Kararlar</h3>
              <ul className="list-disc ml-5 text-sm text-slate-700">{decisionList.map((d, i) => <li key={i}>{d}</li>)}</ul>
            </>
          )}
        </section>
      )}

      <section className="bg-white rounded-lg shadow p-6 space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">Notlar</h2>
        {meeting.messages.length === 0 ? (
          <p className="text-sm text-slate-500">Henüz not yok.</p>
        ) : (
          <ul className="space-y-2">
            {meeting.messages.map((m) => (
              <li key={m.id} className="text-sm text-slate-800 bg-slate-50 rounded p-3">
                <span className="block text-xs text-slate-500">
                  {m.employeeId ? (names.get(m.employeeId) ?? 'Katılımcı') : 'Sen'} · {fmt(m.createdAt)}
                </span>
                <span className="whitespace-pre-wrap">{m.content}</span>
              </li>
            ))}
          </ul>
        )}
        {meeting.status === 'ACTIVE' && (
          <div className="flex flex-wrap items-center gap-3">
            <button disabled={busy} onClick={runRound} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm disabled:opacity-50">
              Bir tur konuştur
            </button>
            <span role="status" className="text-sm text-slate-600">{speaking ?? 'Katılımcılar sırayla gündem hakkında konuşur (kişi başı en fazla 3 söz).'}</span>
          </div>
        )}
        {open && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              run(() => addMeetingNote(meeting.id, note), () => setNote(''))
            }}
          >
            <label className="sr-only" htmlFor="note">Not</label>
            <input id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} placeholder="Not ekle" className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm" />
            <button disabled={busy || !note.trim()} className="px-4 py-2 bg-slate-900 text-white rounded text-sm disabled:opacity-50">Ekle</button>
          </form>
        )}
      </section>

      <section className="bg-white rounded-lg shadow p-6 space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">Aksiyonlar</h2>
        {meeting.actionItems.length === 0 ? (
          <p className="text-sm text-slate-500">Henüz aksiyon yok.</p>
        ) : (
          <ul className="space-y-2">
            {meeting.actionItems.map((a) => (
              <li key={a.id} className="flex items-center gap-3 text-sm text-slate-800 bg-slate-50 rounded p-3">
                <span className="flex-1">
                  {a.content}
                  {a.assigneeId && <span className="text-slate-500"> — {names.get(a.assigneeId) ?? 'Atanan'}</span>}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700">{ACTION_STATUS_LABELS[a.status] ?? a.status}</span>
                {a.status !== 'COMPLETED' && (
                  <button disabled={busy} onClick={() => run(() => completeActionItem(meeting.id, a.id))} className="px-3 py-1 border border-slate-300 rounded text-xs disabled:opacity-50">Bitti</button>
                )}
              </li>
            ))}
          </ul>
        )}
        {open && (
          <form
            className="grid gap-2 md:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault()
              run(() => addActionItem(meeting.id, { content: action, assigneeId: assignee || undefined }), () => {
                setAction('')
                setAssignee('')
              })
            }}
          >
            <label className="sr-only" htmlFor="action">Aksiyon</label>
            <input id="action" value={action} onChange={(e) => setAction(e.target.value)} maxLength={500} placeholder="Aksiyon" className="border border-slate-300 rounded px-3 py-2 text-sm md:col-span-2" />
            <label className="sr-only" htmlFor="assignee">Atanan</label>
            <select id="assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)} className="border border-slate-300 rounded px-3 py-2 text-sm">
              <option value="">Atama yok</option>
              {meeting.participants.map((p) => (
                <option key={p.employee.id} value={p.employee.id}>{p.employee.name}</option>
              ))}
            </select>
            <button disabled={busy || !action.trim()} className="px-4 py-2 bg-slate-900 text-white rounded text-sm disabled:opacity-50">Aksiyon ekle</button>
            <p className="text-xs text-slate-500 md:col-span-4">Biri atanırsa aynı zamanda ona görev olarak da açılır.</p>
          </form>
        )}
      </section>

      {meeting.status === 'ACTIVE' && (
        <section className="bg-white rounded-lg shadow p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">Toplantıyı tamamla</h2>
          <button type="button" disabled={busy} onClick={prepareWrapUp} className="px-4 py-2 border border-slate-300 rounded text-sm disabled:opacity-50">
            Özeti yapay zekâ hazırlasın
          </button>
          <p className="text-xs text-slate-500">Taslak aşağıya dolar; düzenleyip kendin tamamlarsın, otomatik kaydedilmez.</p>
          {suggestions.length > 0 && (
            <ul className="space-y-2">
              {suggestions.map((a, i) => (
                <li key={i} className="flex items-center gap-3 text-sm bg-slate-50 rounded p-3">
                  <span className="flex-1">
                    {a.content}
                    {a.assigneeId && <span className="text-slate-500"> — {names.get(a.assigneeId) ?? ''}</span>}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => addActionItem(meeting.id, a), () => setSuggestions((s) => s.filter((_, j) => j !== i)))}
                    className="px-3 py-1 border border-slate-300 rounded text-xs disabled:opacity-50"
                  >
                    Aksiyon olarak ekle
                  </button>
                  <button type="button" onClick={() => setSuggestions((s) => s.filter((_, j) => j !== i))} className="px-3 py-1 text-xs text-slate-500">Yok say</button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault()
              run(() => completeMeeting(meeting.id, { summary, decisions: decisions.split('\n').map((d) => d.trim()).filter(Boolean) }))
            }}
          >
            <label className="sr-only" htmlFor="summary">Özet</label>
            <textarea id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={4000} rows={3} placeholder="Toplantı özeti" className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
            <label className="sr-only" htmlFor="decisions">Kararlar</label>
            <textarea id="decisions" value={decisions} onChange={(e) => setDecisions(e.target.value)} rows={3} placeholder="Kararlar (her satır bir karar)" className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
            <button disabled={busy || !summary.trim()} className="px-4 py-2 bg-slate-900 text-white rounded text-sm disabled:opacity-50">Tamamla</button>
          </form>
        </section>
      )}
    </div>
  )
}
