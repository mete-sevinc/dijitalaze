export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ReactNode } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'
import { AppShell } from '@/components/app-shell'
import { auth, signOut } from '@/auth'
import { ReminderWatcher } from '@/components/reminder-watcher'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  const nav = (
    <>
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-2xl font-bold">AZE Dijital</h1>
        <p className="text-sm text-slate-400 mt-1">AZE&apos;nin Dijital Gezegeni</p>
      </div>

      <nav aria-label="Ana gezinme" className="flex-1 p-4 space-y-1 lg:space-y-2">
        <NavLink href="/dashboard" label="Kontrol Paneli" icon="📊" />
        <NavLink href="/assistant" label="Asistanım" icon="🧠" />
        <NavLink href="/employees" label="Çalışanlar" icon="👥" />
        <NavLink href="/org" label="Organizasyon" icon="🏢" />
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
    </>
  )

  const actions = (
    <>
      <ThemeToggle />
      <span className="hidden md:inline max-w-56 truncate text-sm text-slate-600">{session?.user?.email}</span>
      <form
        action={async () => {
          'use server'
          await signOut({ redirectTo: '/giris' })
        }}
      >
        <button className="text-sm px-3 md:px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded whitespace-nowrap">Çıkış yap</button>
      </form>
    </>
  )

  return (
    <AppShell nav={nav} actions={actions}>
      {children}
      <ReminderWatcher />
    </AppShell>
  )
}

function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 lg:py-2 rounded hover:bg-slate-800 transition-colors text-slate-300 hover:text-white"
    >
      <span className="text-lg">{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  )
}
