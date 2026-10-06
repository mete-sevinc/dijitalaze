import webpush from 'web-push'
import { prisma } from '@/lib/db'

export interface PushPayload {
  title: string
  body: string
  url?: string
}

// Push uç noktası kullanıcıdan geldiği için sunucu yalnızca bilinen push servislerine istek atar.
const ALLOWED_HOST_SUFFIXES = [
  'fcm.googleapis.com',
  'push.services.mozilla.com',
  'push.apple.com',
  'notify.windows.com',
]

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint)
    return u.protocol === 'https:' && ALLOWED_HOST_SUFFIXES.some((s) => u.hostname === s || u.hostname.endsWith(`.${s}`))
  } catch {
    return false
  }
}

let configured = false
function configure(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  if (!configured) {
    const contact = (process.env.AUTH_ALLOWED_EMAIL ?? '').split(',')[0].trim() || 'admin@example.com'
    webpush.setVapidDetails(`mailto:${contact}`, pub, priv)
    configured = true
  }
  return true
}

// Sahibin tüm cihazlarına gönderir; süresi dolmuş abonelikleri siler. Başarılı gönderim sayısını döner.
export async function sendPushToOwner(owner: string, payload: PushPayload): Promise<number> {
  if (!configure()) return 0
  const subs = await prisma.assistantPushSubscription.findMany({ where: { ownerEmail: owner } })
  let sent = 0
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 3600 }
      )
      sent++
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await prisma.assistantPushSubscription.deleteMany({ where: { endpoint: s.endpoint } })
      } else {
        console.error('push failed', status)
      }
    }
  }
  return sent
}
