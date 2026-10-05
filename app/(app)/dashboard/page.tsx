'use client'

import { useEffect, useState } from 'react'
import { getDashboardSummary, generateDailyBriefing } from '@/app/actions/dashboard'

interface DashboardData {
  company: Record<string, unknown> | null
  employees: number
  taskStats: Record<string, number>
  overdueTasks: number
  meetings: number
  risks: number
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [briefing, setBriefing] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingBriefing, setGeneratingBriefing] = useState(false)

  useEffect(() => {
    async function loadDashboard() {
      const result = await getDashboardSummary('demo_company')
      if (result.success && result.data) {
        setData(result.data)
      }
      setLoading(false)
    }

    loadDashboard()
  }, [])

  async function handleGenerateBriefing() {
    setGeneratingBriefing(true)
    const result = await generateDailyBriefing('demo_company')
    if (result.success && result.data) {
      setBriefing(result.data)
    }
    setGeneratingBriefing(false)
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-slate-500">Yükleniyor...</div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900">Kontrol Paneli</h1>
        <p className="text-slate-600 mt-2">Şirket durumu ve metrikleri</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricCard
          title="Toplam Çalışan"
          value={data?.employees || 0}
          icon="👥"
        />
        <MetricCard
          title="Aktif Görevler"
          value={data?.taskStats['IN_PROGRESS'] || 0}
          icon="✅"
        />
        <MetricCard
          title="Geciken Görevler"
          value={data?.overdueTasks || 0}
          icon="⏰"
          alert={true}
        />
        <MetricCard
          title="Açık Riskler"
          value={data?.risks || 0}
          icon="⚠️"
          alert={true}
        />
        <MetricCard
          title="Aktif Toplantılar"
          value={data?.meetings || 0}
          icon="🤝"
        />
        <MetricCard
          title="Yapılan Görevler"
          value={data?.taskStats['DONE'] || 0}
          icon="✨"
        />
      </div>

      {/* Daily Briefing */}
      <div className="bg-white rounded-lg shadow p-8 border-l-4 border-blue-500">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Günlük Şirket Özetinde</h2>
            <p className="text-slate-600 mt-1">AI tarafından oluşturulan rapor</p>
          </div>
          <button
            onClick={handleGenerateBriefing}
            disabled={generatingBriefing}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {generatingBriefing ? 'Oluşturuluyor...' : 'Özeti Oluştur'}
          </button>
        </div>

        {briefing ? (
          <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap">
            {briefing}
          </div>
        ) : (
          <div className="text-slate-500 italic">
            Özeti görmek için &quot;Özeti Oluştur&quot; butonuna tıklayın.
          </div>
        )}
      </div>

      {/* Task Overview */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Görev Dağılımı</h3>
          <div className="space-y-3">
            {Object.entries(data?.taskStats || {}).map(([status, count]) => (
              <div key={status} className="flex justify-between items-center">
                <span className="text-slate-600">{getStatusLabel(status)}</span>
                <span className="font-semibold text-slate-900">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Hızlı İşlemler</h3>
          <div className="space-y-2">
            <button className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded text-left">
              ➕ Yeni Görev Oluştur
            </button>
            <button className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded text-left">
              🤝 Toplantı Başlat
            </button>
            <button className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded text-left">
              👥 Çalışan Ekle
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  icon,
  alert,
}: {
  title: string
  value: number
  icon: string
  alert?: boolean
}) {
  return (
    <div
      className={`bg-white rounded-lg shadow p-6 ${
        alert ? 'border-l-4 border-red-500' : 'border-l-4 border-blue-500'
      }`}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className={`text-3xl font-bold mt-2 ${alert ? 'text-red-600' : 'text-slate-900'}`}>
            {value}
          </p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  )
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    TODO: 'Yapılacak',
    IN_PROGRESS: 'Devam Eden',
    BLOCKED: 'Engellenen',
    REVIEW: 'İnceleme',
    DONE: 'Tamamlanan',
    CANCELLED: 'İptal Edilen',
  }
  return labels[status] || status
}
