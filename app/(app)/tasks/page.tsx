'use client'

import { useEffect, useState } from 'react'
import { getTasks } from '@/app/actions/tasks'

export default function TasksPage() {
  interface Task {
    id: string
    title: string
    status: string
    priority: string
    assignee?: { name: string }
  }

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadTasks() {
      const result = await getTasks('demo_company')
      if (result.success && result.data) setTasks(result.data)
      setLoading(false)
    }
    loadTasks()
  }, [])

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-slate-900">Görevler</h1>
        <p className="text-slate-600 mt-2">Tüm görevleri yönet ve izle</p>
      </div>

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
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                      {task.status}
                    </span>
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
