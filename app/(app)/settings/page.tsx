'use client'
import { useEffect, useState } from 'react'
import {
  getSettings,
  updateCompanyInfo,
  addUser,
  removeUser,
  deleteAllData,
} from '@/app/actions/settings'

interface UserRow {
  id: string
  email: string
  name: string | null
}

const inputCls = 'w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white text-slate-900'
const btnCls = 'px-4 py-2 rounded text-sm font-medium bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50'

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [users, setUsers] = useState<UserRow[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const res = await getSettings()
    if (res.success) {
      setName(res.data.company?.name ?? '')
      setDescription(res.data.company?.description ?? '')
      setUsers(res.data.users)
    } else {
      setMsg({ kind: 'err', text: res.error })
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function run(fn: () => Promise<{ success: boolean; error?: string }>, okText: string) {
    setBusy(true)
    const res = await fn()
    setMsg(res.success ? { kind: 'ok', text: okText } : { kind: 'err', text: res.error ?? 'Hata' })
    setBusy(false)
    return res.success
  }

  async function saveCompany(e: React.FormEvent) {
    e.preventDefault()
    await run(() => updateCompanyInfo({ name, description }), 'Firma bilgileri kaydedildi')
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    if (await run(() => addUser({ email: newEmail, name: newName }), 'Kullanıcı eklendi')) {
      setNewEmail('')
      setNewName('')
      load()
    }
  }

  async function handleRemoveUser(u: UserRow) {
    if (!window.confirm(`${u.email} silinsin mi?`)) return
    if (await run(() => removeUser(u.id), 'Kullanıcı silindi')) load()
  }

  async function handleDeleteAll() {
    if (!window.confirm('Tüm çalışanlar, konuşmalar, görevler, toplantılar ve raporlar kalıcı olarak silinecek. Emin misiniz?')) return
    if (await run(() => deleteAllData(confirmText), 'Tüm veriler silindi')) setConfirmText('')
  }

  if (loading) return <div className="p-8 text-slate-500">Yükleniyor...</div>

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-4xl font-bold text-slate-900">Ayarlar</h1>
        <p className="text-slate-600 mt-2">Sistem ve şirket ayarlarını yönet</p>
      </div>

      {msg && (
        <div
          role="status"
          className={`rounded px-4 py-2 text-sm ${msg.kind === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
        >
          {msg.text}
        </div>
      )}

      <form onSubmit={saveCompany} className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Firma Bilgileri</h2>
        <label className="block text-sm text-slate-700">
          Firma adı
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
        </label>
        <label className="block text-sm text-slate-700">
          Açıklama
          <textarea className={inputCls} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
        </label>
        <button className={btnCls} disabled={busy}>Kaydet</button>
      </form>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Kullanıcılar</h2>
        <ul className="divide-y divide-slate-200">
          {users.length === 0 && <li className="py-2 text-sm text-slate-500">Kayıtlı kullanıcı yok</li>}
          {users.map((u) => (
            <li key={u.id} className="py-2 flex items-center justify-between text-sm">
              <span className="text-slate-900">
                {u.name ? `${u.name} · ` : ''}
                {u.email}
              </span>
              <button onClick={() => handleRemoveUser(u)} disabled={busy} className="text-red-600 hover:underline disabled:opacity-50">
                Çıkar
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddUser} className="flex flex-wrap gap-2">
          <input className={`${inputCls} flex-1 min-w-48`} type="email" placeholder="E-posta" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required aria-label="E-posta" />
          <input className={`${inputCls} flex-1 min-w-40`} placeholder="Ad (opsiyonel)" value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="Ad" />
          <button className={btnCls} disabled={busy}>Ekle</button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4 border border-red-300">
        <h2 className="text-xl font-semibold text-red-700">Tehlikeli Bölge</h2>
        <p className="text-sm text-slate-600">
          Tüm çalışanları, konuşmaları, görevleri, toplantıları, raporları ve hafızayı kalıcı olarak siler. Geri alınamaz. Devam etmek için <b>SİL</b> yazın.
        </p>
        <div className="flex gap-2">
          <input className={inputCls} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="SİL" aria-label="Onay metni" />
          <button onClick={handleDeleteAll} disabled={busy || confirmText !== 'SİL'} className="px-4 py-2 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 whitespace-nowrap">
            Tümünü Sil
          </button>
        </div>
      </div>
    </div>
  )
}
