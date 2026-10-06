'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getEmployeeById, updateEmployee } from '@/app/actions/employees'
import { getInstructions, createInstruction, updateInstruction, deleteInstruction } from '@/app/actions/instructions'

interface Employee {
  id: string
  name: string
  title: string
  department: string
  avatar?: string | null
  description?: string | null
  systemRole?: string | null
  responsibilities?: string | null
  objectives?: string | null
  kpis?: string | null
  dailyRoutine?: string | null
  weeklyRoutine?: string | null
  communicationStyle?: string | null
  decisionRules?: string | null
  escalationRules?: string | null
  permissions?: string | null
  tools?: string | null
  status: string
  assignedTasks: Array<{ id: string; title: string; status: string; priority: string }>
}

interface Instruction {
  id: string
  content: string
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
  active: boolean
  createdAt: string | Date
}

const TABS = ['Genel', 'Görevler', 'Talimatlar', 'Yetkiler & Araçlar'] as const
type Tab = typeof TABS[number]

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  NORMAL: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
}

const TASK_STATUS_COLORS: Record<string, string> = {
  TODO: 'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  BLOCKED: 'bg-red-100 text-red-700',
  REVIEW: 'bg-yellow-100 text-yellow-700',
  DONE: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-400',
}

export default function EmployeeDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [instructions, setInstructions] = useState<Instruction[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('Genel')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Edit state for general tab
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState<Partial<Employee>>({})

  // Instruction form
  const [newInstruction, setNewInstruction] = useState('')
  const [newPriority, setNewPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'>('NORMAL')
  const [addingInstruction, setAddingInstruction] = useState(false)

  useEffect(() => {
    async function load() {
      const [empResult, instrResult] = await Promise.all([
        getEmployeeById(id),
        getInstructions(id),
      ])
      if (empResult.success && empResult.data) {
        const emp = empResult.data as Employee
        setEmployee(emp)
        setForm(emp)
      }
      if (instrResult.success && instrResult.data) {
        setInstructions(instrResult.data as Instruction[])
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function handleSave() {
    if (!employee) return
    setSaving(true)
    const result = await updateEmployee(employee.id, {
      name: form.name,
      title: form.title,
      department: form.department,
      avatar: form.avatar || undefined,
      description: form.description || undefined,
      systemRole: form.systemRole || undefined,
      responsibilities: form.responsibilities || undefined,
      objectives: form.objectives || undefined,
      kpis: form.kpis || undefined,
      dailyRoutine: form.dailyRoutine || undefined,
      weeklyRoutine: form.weeklyRoutine || undefined,
      communicationStyle: form.communicationStyle || undefined,
      decisionRules: form.decisionRules || undefined,
      escalationRules: form.escalationRules || undefined,
    })
    if (result.success) {
      setEmployee({ ...employee, ...form } as Employee)
      setEditMode(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  async function handleAddInstruction() {
    if (!newInstruction.trim()) return
    setAddingInstruction(true)
    const result = await createInstruction(id, newInstruction.trim(), newPriority)
    if (result.success && result.data) {
      setInstructions((prev) => [result.data as Instruction, ...prev])
      setNewInstruction('')
      setNewPriority('NORMAL')
    }
    setAddingInstruction(false)
  }

  async function handleToggleInstruction(instr: Instruction) {
    const result = await updateInstruction(instr.id, { active: !instr.active })
    if (result.success) {
      setInstructions((prev) =>
        prev.map((i) => (i.id === instr.id ? { ...i, active: !i.active } : i))
      )
    }
  }

  async function handleDeleteInstruction(instrId: string) {
    const result = await deleteInstruction(instrId)
    if (result.success) {
      setInstructions((prev) => prev.filter((i) => i.id !== instrId))
    }
  }

  if (loading) return <div className="p-8 text-slate-500">Yükleniyor...</div>
  if (!employee) return <div className="p-8 text-red-500">Çalışan bulunamadı</div>

  const permissions: string[] = employee.permissions ? JSON.parse(employee.permissions) : []
  const tools: string[] = employee.tools ? JSON.parse(employee.tools) : []

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-700 text-2xl">←</button>
          <span className="text-5xl">{employee.avatar || '👤'}</span>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{employee.name}</h1>
            <p className="text-slate-600">{employee.title} · {employee.department}</p>
            <span className={`mt-1 inline-block px-3 py-0.5 rounded-full text-xs font-semibold ${employee.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {employee.status === 'ACTIVE' ? '🟢 Aktif' : '⏸ Duraklatılmış'}
            </span>
          </div>
        </div>
        <Link
          href={`/employees/${employee.id}/chat`}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          💬 Sohbet Başlat
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Genel Tab */}
      {tab === 'Genel' && (
        <div className="space-y-6">
          <div className="flex justify-end gap-3">
            {editMode ? (
              <>
                <button onClick={() => { setEditMode(false); setForm(employee) }} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">İptal</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Kaydediliyor...' : '💾 Kaydet'}
                </button>
              </>
            ) : (
              <button onClick={() => setEditMode(true)} className="px-4 py-2 border border-blue-300 text-blue-600 rounded-lg text-sm hover:bg-blue-50">
                ✏️ Düzenle
              </button>
            )}
            {saved && <span className="text-green-600 text-sm self-center">✓ Kaydedildi</span>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[
              { label: 'Ad', key: 'name' as const },
              { label: 'Unvan', key: 'title' as const },
              { label: 'Bölüm', key: 'department' as const },
              { label: 'Avatar (emoji)', key: 'avatar' as const },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                {editMode ? (
                  <input
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={(form[key] as string) || ''}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                ) : (
                  <p className="text-slate-900 bg-slate-50 rounded-lg px-3 py-2 text-sm">{(employee[key] as string) || '—'}</p>
                )}
              </div>
            ))}
          </div>

          {[
            { label: 'Açıklama', key: 'description' as const },
            { label: 'Sistem Rolü', key: 'systemRole' as const },
            { label: 'Sorumluluklar', key: 'responsibilities' as const },
            { label: 'Hedefler', key: 'objectives' as const },
            { label: 'KPI\'lar', key: 'kpis' as const },
            { label: 'Günlük Rutin', key: 'dailyRoutine' as const },
            { label: 'Haftalık Rutin', key: 'weeklyRoutine' as const },
            { label: 'İletişim Stili', key: 'communicationStyle' as const },
            { label: 'Karar Kuralları', key: 'decisionRules' as const },
            { label: 'Eskalasyon Kuralları', key: 'escalationRules' as const },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              {editMode ? (
                <textarea
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  value={(form[key] as string) || ''}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              ) : (
                <p className="text-slate-900 bg-slate-50 rounded-lg px-3 py-2 text-sm whitespace-pre-wrap min-h-[2.5rem]">
                  {(employee[key] as string) || <span className="text-slate-400">Belirtilmemiş</span>}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Görevler Tab */}
      {tab === 'Görevler' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">{employee.assignedTasks.length} görev</p>
          {employee.assignedTasks.length === 0 ? (
            <div className="text-center py-12 text-slate-400">Atanmış görev yok</div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-100 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Başlık</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Durum</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Öncelik</th>
                  </tr>
                </thead>
                <tbody>
                  {employee.assignedTasks.map((task) => (
                    <tr key={task.id} className="border-b hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm text-slate-900">{task.title}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${TASK_STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-600'}`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${TASK_STATUS_COLORS[task.priority] || 'bg-gray-100 text-gray-600'}`}>
                          {task.priority}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Talimatlar Tab */}
      {tab === 'Talimatlar' && (
        <div className="space-y-4">
          {/* Add instruction */}
          <div className="bg-white rounded-lg shadow p-4 space-y-3">
            <h3 className="font-medium text-slate-800">Yeni Talimat Ekle</h3>
            <textarea
              rows={3}
              placeholder="Talimat içeriği... (örn: Müşterilere her zaman resmi hitap et)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              value={newInstruction}
              onChange={(e) => setNewInstruction(e.target.value)}
            />
            <div className="flex items-center gap-3">
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as typeof newPriority)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="LOW">Düşük</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">Yüksek</option>
                <option value="CRITICAL">Kritik</option>
              </select>
              <button
                onClick={handleAddInstruction}
                disabled={addingInstruction || !newInstruction.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {addingInstruction ? 'Ekleniyor...' : '➕ Ekle'}
              </button>
            </div>
          </div>

          {/* Instruction list */}
          {instructions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">Henüz talimat yok</div>
          ) : (
            <div className="space-y-3">
              {instructions.map((instr) => (
                <div
                  key={instr.id}
                  className={`bg-white rounded-lg shadow p-4 border-l-4 ${instr.active ? 'border-blue-500' : 'border-gray-300 opacity-60'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm text-slate-800 flex-1 whitespace-pre-wrap">{instr.content}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[instr.priority]}`}>
                        {instr.priority}
                      </span>
                      <button
                        onClick={() => handleToggleInstruction(instr)}
                        className={`px-2 py-1 rounded text-xs ${instr.active ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                      >
                        {instr.active ? '⏸ Durdur' : '▶ Aktif Et'}
                      </button>
                      <button
                        onClick={() => handleDeleteInstruction(instr.id)}
                        className="px-2 py-1 rounded text-xs bg-red-100 text-red-700 hover:bg-red-200"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Yetkiler & Araçlar Tab */}
      {tab === 'Yetkiler & Araçlar' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h3 className="font-semibold text-slate-800 text-lg">🔑 Yetkiler</h3>
            {permissions.length === 0 ? (
              <p className="text-slate-400 text-sm">Yetki tanımlanmamış</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {permissions.map((p, i) => (
                  <span key={i} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">{p}</span>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400">Yetkileri güncellemek için Genel sekmesinden düzenleyin (JSON dizi formatında).</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h3 className="font-semibold text-slate-800 text-lg">🛠 Araçlar / Erişimler</h3>
            {tools.length === 0 ? (
              <p className="text-slate-400 text-sm">Araç tanımlanmamış</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tools.map((t, i) => (
                  <span key={i} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">{t}</span>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6 space-y-3 lg:col-span-2">
            <h3 className="font-semibold text-slate-800 text-lg">📊 Özet</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-2xl font-bold text-blue-600">{employee.assignedTasks.length}</p>
                <p className="text-xs text-slate-500 mt-1">Toplam Görev</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-2xl font-bold text-orange-600">{employee.assignedTasks.filter(t => t.status === 'IN_PROGRESS').length}</p>
                <p className="text-xs text-slate-500 mt-1">Devam Eden</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-2xl font-bold text-green-600">{instructions.filter(i => i.active).length}</p>
                <p className="text-xs text-slate-500 mt-1">Aktif Talimat</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
