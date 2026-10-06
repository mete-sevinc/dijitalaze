'use client'
import { useCompanyId } from '@/components/company-context'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getEmployees } from '@/app/actions/employees'

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
  const companyId = useCompanyId()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'ACTIVE' | 'PAUSED'>('all')

  useEffect(() => {
    async function loadEmployees() {
      const result = await getEmployees(companyId)
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
        <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          ➕ Yeni Çalışan
        </button>
      </div>

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
