'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createEmployee, getEmployees } from '@/app/actions/employees'

interface Employee {
  id: string
  name: string
  title: string
  department: string
  avatar?: string | null
  status: string
  assignedTasks: Array<{ id: string; title: string }>
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'ACTIVE' | 'PAUSED'>('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', title: '', department: '', responsibilities: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleCreate() {
    setSaving(true)
    setFormError(null)
    const result = await createEmployee('demo_company', {
      name: form.name.trim(),
      title: form.title.trim(),
      department: form.department.trim(),
      responsibilities: form.responsibilities.trim() || undefined,
    })
    if (result.success) {
      setForm({ name: '', title: '', department: '', responsibilities: '' })
      setShowForm(false)
      const list = await getEmployees('demo_company')
      if (list.success && list.data) setEmployees(list.data)
    } else {
      setFormError(result.error ?? 'Çalışan oluşturulamadı')
    }
    setSaving(false)
  }

  useEffect(() => {
    async function loadEmployees() {
      const result = await getEmployees('demo_company')
      if (result.success && result.data) {
        setEmployees(result.data)
      }
      setLoading(false)
    }

    loadEmployees()
  }, [])

  const filtered = employees.filter((e) => filter === 'all' || e.status === filter)

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Çalışanlar</h1>
          <p className="text-slate-600 mt-2">AZE Otomasyon dijital çalışanlarını yönet</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          ➕ Yeni Çalışan
        </button>
      </div>

      {showForm && (
        <form
          className="bg-white rounded-lg shadow p-6 grid gap-3 md:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault()
            handleCreate()
          }}
        >
          <label className="sr-only" htmlFor="emp-name">Ad</label>
          <input id="emp-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ad (örn. Ayşe)" className="border border-slate-300 rounded px-3 py-2 text-sm" />
          <label className="sr-only" htmlFor="emp-title">Unvan</label>
          <input id="emp-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Unvan (örn. Satış Uzmanı)" className="border border-slate-300 rounded px-3 py-2 text-sm" />
          <label className="sr-only" htmlFor="emp-dept">Bölüm</label>
          <input id="emp-dept" required value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Bölüm (örn. Satış)" className="border border-slate-300 rounded px-3 py-2 text-sm" />
          <label className="sr-only" htmlFor="emp-resp">Sorumluluklar</label>
          <textarea id="emp-resp" rows={3} value={form.responsibilities} onChange={(e) => setForm({ ...form, responsibilities: e.target.value })} placeholder="Sorumlulukları (isteğe bağlı; detayı sonra çalışan sayfasından zenginleştirebilirsin)" className="border border-slate-300 rounded px-3 py-2 text-sm md:col-span-3" />
          {formError && <p className="text-sm text-red-600 md:col-span-3" role="alert">{formError}</p>}
          <div className="md:col-span-3 flex gap-2">
            <button disabled={saving} className="px-4 py-2 bg-slate-900 text-white rounded text-sm disabled:opacity-50">{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-300 rounded text-sm">Vazgeç</button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'ACTIVE', 'PAUSED'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300'
            }`}
          >
            {status === 'all' ? 'Tümü' : status === 'ACTIVE' ? 'Aktif' : 'Duraklatılmış'}
          </button>
        ))}
      </div>

      {/* Employees Grid */}
      {loading ? (
        <div className="text-center text-slate-500 py-12">Yükleniyor...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((employee) => (
            <Link
              key={employee.id}
              href={`/employees/${employee.id}`}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 border-l-4 border-blue-500"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{employee.avatar || '👤'}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{employee.name}</h3>
                      <p className="text-sm text-slate-600">{employee.title}</p>
                    </div>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    employee.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  🟢 {employee.status === 'ACTIVE' ? 'Aktif' : 'Duraklatılmış'}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Bölüm:</span>
                  <span className="font-medium">{employee.department}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Aktif Görevler:</span>
                  <span className="font-medium">{employee.assignedTasks?.length || 0}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-200 flex gap-2">
                <button className="flex-1 px-3 py-2 text-center bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200">
                  💬 Sohbet
                </button>
                <button className="flex-1 px-3 py-2 text-center bg-slate-100 text-slate-700 rounded text-sm hover:bg-slate-200">
                  📄 Profil
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
