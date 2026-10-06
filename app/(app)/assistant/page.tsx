'use client'

import { useEffect, useRef, useState } from 'react'
import {
  completeAssistantTask,
  deleteAssistantNote,
  getAssistantState,
  sendAssistantMessage,
  updateAssistantNote,
} from '@/app/actions/assistant'
import { PushToggle } from '@/components/push-toggle'

type Msg = { id: string; role: string; content: string }
type Task = { id: string; title: string; dueAt: string | null; remindAt: string | null }
type Note = { id: string; content: string }

const dt = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export default function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [input, setInput] = useState('')
  const [noteQuery, setNoteQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function refresh() {
    const s = await getAssistantState()
    setMessages(s.messages)
    setTasks(s.tasks)
    setNotes(s.notes)
  }

  useEffect(() => {
    async function load() {
      try {
        const s = await getAssistantState()
        setMessages(s.messages)
        setTasks(s.tasks)
        setNotes(s.notes)
      } catch {
        setError('Veriler yüklenemedi')
      }
    }
    load()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setError(null)
    setSending(true)
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, role: 'user', content: text }])
    const res = await sendAssistantMessage(text)
    if (!res.success) setError(res.error)
    await refresh().catch(() => {})
    setSending(false)
  }

  async function saveNote(id: string) {
    const res = await updateAssistantNote(id, editText)
    if (res.success) setNotes((n) => n.map((x) => (x.id === id ? { ...x, content: editText.trim() } : x)))
    setEditingId(null)
  }

  async function removeNote(id: string) {
    const res = await deleteAssistantNote(id)
    if (res.success) setNotes((n) => n.filter((x) => x.id !== id))
    setConfirmDeleteId(null)
  }

  const shownNotes = notes.filter((n) => n.content.toLowerCase().includes(noteQuery.trim().toLowerCase()))

  async function done(id: string) {
    await completeAssistantTask(id)
    setTasks((t) => t.filter((x) => x.id !== id))
  }

  return (
    <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      <section className="lg:col-span-2 flex flex-col bg-white border border-slate-200 rounded min-h-[28rem]">
        <h1 className="px-6 py-4 border-b border-slate-200 text-2xl font-bold text-slate-900">Kişisel Asistan</h1>
        <div className="flex-1 overflow-auto p-6 space-y-3">
          {messages.length === 0 && !sending && (
            <p className="text-slate-500 text-sm">
              Örn: “Yarın 10:00’da Ahmet’i aramayı hatırlat”, “Not al: teklif %10 indirimli”, “Bugün neler var?”
            </p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex'}>
              <p className={`whitespace-pre-wrap rounded px-4 py-2 max-w-[80%] text-sm ${m.role === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'}`}>
                {m.content}
              </p>
            </div>
          ))}
          {sending && <p className="text-sm text-slate-500">Asistan yazıyor…</p>}
          <div ref={bottomRef} />
        </div>
        {error && <p className="px-6 text-sm text-red-600" role="alert">{error}</p>}
        <form
          className="p-4 border-t border-slate-200 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <label htmlFor="assistant-input" className="sr-only">Mesaj</label>
          <input
            id="assistant-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={4000}
            placeholder="Asistanına yaz…"
            className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm"
          />
          <button disabled={sending || !input.trim()} className="px-4 py-2 bg-slate-900 text-white rounded text-sm disabled:opacity-50">
            Gönder
          </button>
        </form>
      </section>

      <aside className="space-y-6">
        <section className="bg-white border border-slate-200 rounded p-4">
          <h2 className="font-semibold text-slate-900 mb-3">Açık işler</h2>
          {tasks.length === 0 ? (
            <p className="text-sm text-slate-500">Açık iş yok.</p>
          ) : (
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" aria-label={`${t.title} tamamlandı`} onChange={() => done(t.id)} className="mt-1" />
                  <div>
                    <p className="text-slate-900">{t.title}</p>
                    <p className="text-xs text-slate-500">
                      {t.dueAt && `Son: ${dt.format(new Date(t.dueAt))}`}
                      {t.dueAt && t.remindAt && ' · '}
                      {t.remindAt && `⏰ ${dt.format(new Date(t.remindAt))}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="bg-white border border-slate-200 rounded p-4">
          <h2 className="font-semibold text-slate-900 mb-3">Notlar</h2>
          <label htmlFor="note-search" className="sr-only">Notlarda ara</label>
          <input
            id="note-search"
            value={noteQuery}
            onChange={(e) => setNoteQuery(e.target.value)}
            placeholder="Notlarda ara…"
            className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm mb-3"
          />
          {shownNotes.length === 0 ? (
            <p className="text-sm text-slate-500">{notes.length === 0 ? 'Henüz not yok.' : 'Eşleşen not yok.'}</p>
          ) : (
            <ul className="space-y-3 max-h-96 overflow-auto">
              {shownNotes.map((n) => (
                <li key={n.id} className="text-sm text-slate-700">
                  {editingId === n.id ? (
                    <div className="space-y-2">
                      <label htmlFor={`edit-${n.id}`} className="sr-only">Notu düzenle</label>
                      <textarea
                        id={`edit-${n.id}`}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        maxLength={5000}
                        rows={3}
                        className="w-full border border-slate-300 rounded px-2 py-1"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => saveNote(n.id)} disabled={!editText.trim()} className="px-2 py-1 bg-slate-900 text-white rounded text-xs disabled:opacity-50">Kaydet</button>
                        <button onClick={() => setEditingId(null)} className="px-2 py-1 border border-slate-300 rounded text-xs">Vazgeç</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap">{n.content}</p>
                      <div className="flex gap-3 mt-1 text-xs">
                        <button onClick={() => { setEditingId(n.id); setEditText(n.content) }} className="underline text-slate-600">Düzenle</button>
                        {confirmDeleteId === n.id ? (
                          <>
                            <button onClick={() => removeNote(n.id)} className="underline text-red-600">Silmeyi onayla</button>
                            <button onClick={() => setConfirmDeleteId(null)} className="underline text-slate-600">Vazgeç</button>
                          </>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(n.id)} className="underline text-red-600">Sil</button>
                        )}
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        <PushToggle />
      </aside>
    </div>
  )
}
