'use client'

import { useEffect, useState } from 'react'
import { removePushSubscription, savePushSubscription } from '@/app/actions/assistant'

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function keyToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

type State = 'loading' | 'unsupported' | 'off' | 'on' | 'denied'

export function PushToggle() {
  const [state, setState] = useState<State>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      if (!PUBLIC_KEY || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        setState('unsupported')
        return
      }
      if (Notification.permission === 'denied') {
        setState('denied')
        return
      }
      const reg = await navigator.serviceWorker.register('/sw.js')
      const sub = await reg.pushManager.getSubscription()
      setState(sub ? 'on' : 'off')
    }
    init().catch(() => setState('unsupported'))
  }, [])

  async function enable() {
    setBusy(true)
    setError(null)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setState(perm === 'denied' ? 'denied' : 'off')
        return
      }
      const reg = await navigator.serviceWorker.register('/sw.js')
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(PUBLIC_KEY!) }))
      const res = await savePushSubscription(sub.toJSON())
      if (!res.success) throw new Error('kayıt başarısız')
      setState('on')
    } catch {
      setError('Bildirim açılamadı')
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await removePushSubscription(sub.endpoint)
        await sub.unsubscribe()
      }
      setState('off')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading') return null
  return (
    <section className="bg-white border border-slate-200 rounded p-4">
      <h2 className="font-semibold text-slate-900 mb-2">Bildirimler</h2>
      {state === 'unsupported' && (
        <p className="text-sm text-slate-500">Bu tarayıcıda/yapılandırmada anlık bildirim kullanılamıyor.</p>
      )}
      {state === 'denied' && (
        <p className="text-sm text-slate-500">Bildirim izni tarayıcıda engellenmiş. Site ayarlarından izin verin.</p>
      )}
      {state === 'off' && (
        <>
          <p className="text-sm text-slate-600 mb-2">Sekme kapalıyken de hatırlatma ve sabah özeti alın.</p>
          <button onClick={enable} disabled={busy} className="px-3 py-1.5 bg-slate-900 text-white rounded text-sm disabled:opacity-50">
            Bildirimleri aç
          </button>
        </>
      )}
      {state === 'on' && (
        <>
          <p className="text-sm text-green-700 mb-2">Bu cihazda bildirimler açık.</p>
          <button onClick={disable} disabled={busy} className="px-3 py-1.5 border border-slate-300 rounded text-sm disabled:opacity-50">
            Kapat
          </button>
        </>
      )}
      {error && <p className="text-sm text-red-600 mt-2" role="alert">{error}</p>}
    </section>
  )
}
