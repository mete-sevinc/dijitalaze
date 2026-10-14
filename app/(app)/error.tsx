'use client'
import { useEffect } from 'react'

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The digest links this to the server-side log entry in Vercel.
    console.error('[ui-error]', error.digest ?? '', error.message)
  }, [error])
  return (
    <div className="p-8 space-y-3">
      <h1 className="text-2xl font-bold text-slate-900">Bir şeyler ters gitti</h1>
      <p className="text-slate-600">Sayfa yüklenemedi. Tekrar deneyebilirsin; sorun sürerse hata kodunu ilet.</p>
      {error.digest && <p className="text-xs text-slate-500">Hata kodu: {error.digest}</p>}
      <button onClick={reset} className="px-4 py-2 bg-slate-900 text-white rounded text-sm">Tekrar dene</button>
    </div>
  )
}
