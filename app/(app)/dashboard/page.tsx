'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  const [assistantInput, setAssistantInput] = useState('')
  const router = useRouter()

  useEffect(() => {
    async function loadDashboard() {
      const result = await getDashboardSummary()
      if (result.success && result.data) {
        setData(result.data)
      }
      setLoading(false)
    }

    loadDashboard()
  }, [])

  async function handleGenerateBriefing() {
    setGeneratingBriefing(true)
    const result = await generateDailyBriefing()
    if (result.success && result.data) {
      setBriefing(result.data)
    } else {
      setBriefing(result.error ?? 'Günlük özet oluşturulamadı')
    }
    setGeneratingBriefing(false)
  }

  function startAssistantChat() {
    const text = assistantInput.trim()
    if (!text) return
    try {
      sessionStorage.setItem('assistant_draft', text)
    } catch {}
    router.push('/assistant')
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
          href="/employees"
          value={data?.employees || 0}
          icon="👥"
        />
        <MetricCard
          title="Aktif Görevler"
          href="/tasks"
          value={data?.taskStats['IN_PROGRESS'] || 0}
          icon="✅"
        />
        <MetricCard
          title="Geciken Görevler"
          href="/tasks"
          value={data?.overdueTasks || 0}
          icon="⏰"
          alert={true}
        />
        <MetricCard
          title="Açık Riskler"
          href="/reports"
          value={data?.risks || 0}
          icon="⚠️"
          alert={true}
        />
        <MetricCard
          title="Aktif Toplantılar"
          href="/meetings"
          value={data?.meetings || 0}
          icon="🤝"
        />
        <MetricCard
          title="Yapılan Görevler"
          href="/tasks"
          value={data?.taskStats['DONE'] || 0}
          icon="✨"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Hızlı İşlemler</h3>
          <div className="space-y-2">
            <Link href="/tasks#yeni-gorev" className="block w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded text-left">
              ➕ Yeni Görev Oluştur
            </Link>
            <Link href="/meetings" className="block w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded text-left">
              🤝 Toplantı Başlat
            </Link>
            <Link href="/employees?yeni=1" className="block w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded text-left">
              👥 Çalışan Ekle
            </Link>
          </div>
        </div>

        {/* Assistant */}
        <div className="bg-white rounded-lg shadow p-6 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Asistanım</h3>
            <Link
              href="/assistant"
              className="px-4 py-1.5 bg-slate-900 text-white rounded text-sm hover:bg-slate-700"
            >
              🧠 Asistan
            </Link>
          </div>
          <form
            className="flex-1 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              startAssistantChat()
            }}
          >
            <label htmlFor="dashboard-assistant-input" className="sr-only">Asistana mesaj</label>
            <textarea
              id="dashboard-assistant-input"
              value={assistantInput}
              onChange={(e) => setAssistantInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  startAssistantChat()
                }
              }}
              maxLength={4000}
              placeholder="Asistanına yaz… (ör. Bugün neler var?)"
              className="flex-1 min-h-24 border border-slate-300 rounded px-3 py-2 text-sm resize-none"
            />
            <button
              disabled={!assistantInput.trim()}
              className="self-end px-4 py-2 bg-slate-900 text-white rounded text-sm disabled:opacity-50"
            >
              Gönder
            </button>
          </form>
        </div>

        {/* Task Overview */}
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

        {/* Daily Briefing */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex justify-between items-center mb-4 gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Günlük Şirket Özeti</h2>
              <p className="text-sm text-slate-600 mt-1">AI tarafından oluşturulan rapor</p>
            </div>
            <button
              onClick={handleGenerateBriefing}
              disabled={generatingBriefing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-gray-400 shrink-0"
            >
              {generatingBriefing ? 'Oluşturuluyor...' : 'Özeti Oluştur'}
            </button>
          </div>

          {briefing ? (
            <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap">
              {briefing}
            </div>
          ) : (
            <div className="text-slate-500 italic text-sm">
              Özeti görmek için &quot;Özeti Oluştur&quot; butonuna tıklayın.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  title,
  href,
  value,
  icon,
  alert,
}: {
  title: string
  href: string
  value: number
  icon: string
  alert?: boolean
}) {
  return (
    <Link
      href={href}
      className={`block bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow ${
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
    </Link>
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
