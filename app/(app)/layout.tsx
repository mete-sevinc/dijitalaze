export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ReactNode } from 'react'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-2xl font-bold">AZE Dijital</h1>
          <p className="text-sm text-slate-400 mt-1">AZE'nin Dijital Gezegeni</p>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavLink href="/dashboard" label="Kontrol Paneli" icon="📊" />
          <NavLink href="/employees" label="Çalışanlar" icon="👥" />
          <NavLink href="/tasks" label="Görevler" icon="✅" />
          <NavLink href="/meetings" label="Toplantılar" icon="🤝" />
          <NavLink href="/reports" label="Raporlar" icon="📄" />
          <NavLink href="/settings" label="Ayarlar" icon="⚙️" />
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="text-xs text-slate-400">
            <p className="mb-1">Şirket: AZE Otomasyon</p>
            <p>Durum: Çevrimiçi ✓</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center">
          <div />
          <div className="flex items-center gap-4">
            <button className="text-sm px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded">
              Profil
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  )
}

function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-2 rounded hover:bg-slate-800 transition-colors text-slate-300 hover:text-white"
    >
      <span className="text-lg">{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  )
}
