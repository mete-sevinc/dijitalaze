import { redirect } from 'next/navigation'
import { auth, signIn } from '@/auth'

export const dynamic = 'force-dynamic'

const SAFE_PATH = /^\/(?!\/)[\w\-./?=&%]*$/

export default async function Giris({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams
  const target = callbackUrl && SAFE_PATH.test(callbackUrl) ? callbackUrl : '/assistant'
  if (await auth()) redirect(target)

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded bg-white p-8 shadow">
        <h1 className="text-2xl font-bold text-slate-900">AZE Dijital</h1>
        <p className="mt-1 text-sm text-slate-600">AZE&apos;nin Dijital Gezegeni</p>
        <h2 className="mt-8 text-lg font-semibold text-slate-900">Oturum açın</h2>
        <p className="mt-1 text-sm text-slate-600">Kurumsal Microsoft hesabınızla giriş yapın.</p>
        <form
          className="mt-6"
          action={async () => {
            'use server'
            await signIn('microsoft-entra-id', { redirectTo: target })
          }}
        >
          <button className="w-full rounded bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800">
            Microsoft ile giriş yap
          </button>
        </form>
        <p className="mt-6 text-xs text-slate-500">Yalnızca yetkili kullanıcılar giriş yapabilir.</p>
      </div>
    </main>
  )
}
