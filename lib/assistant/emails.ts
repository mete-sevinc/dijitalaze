import { prisma } from '@/lib/db'
import { sendMailAs } from './mail'
import { sendPushToOwner } from './push'

const MAX_ATTEMPTS = 3
const STALE_SENDING_MS = 10 * 60 * 1000

// Giden mail sahibin onayından geçen bir taslaktan doğar; gönderim yalnızca bu fonksiyonlar üzerinden olur.
async function deliver(id: string, from: 'DRAFT' | 'SCHEDULED'): Promise<{ ok: boolean; error?: string }> {
  const claimed = await prisma.assistantEmail.updateMany({
    where: { id, status: from },
    data: { status: 'SENDING', sendingAt: new Date(), attempts: { increment: 1 } },
  })
  if (claimed.count === 0) return { ok: false, error: 'Mail bu durumda gönderilemez (zaten gönderildi/iptal edildi)' }
  const m = await prisma.assistantEmail.findUniqueOrThrow({ where: { id } })
  try {
    await sendMailAs(m.ownerEmail, m)
    await prisma.assistantEmail.update({ where: { id }, data: { status: 'SENT', sentAt: new Date(), error: null } })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Bilinmeyen hata'
    const retry = from === 'SCHEDULED' && m.attempts < MAX_ATTEMPTS
    await prisma.assistantEmail.update({
      where: { id },
      data: { status: retry ? 'SCHEDULED' : 'FAILED', error: msg.slice(0, 300) },
    })
    return { ok: false, error: msg }
  }
}

export const sendDraftNow = (id: string) => deliver(id, 'DRAFT')

// Vadesi gelen zamanlı mailleri gönderir ve sonucu push ile bildirir.
export async function sendDueEmails(): Promise<number> {
  await prisma.assistantEmail.updateMany({
    where: { status: 'SENDING', sendingAt: { lt: new Date(Date.now() - STALE_SENDING_MS) } },
    data: { status: 'FAILED', error: 'Gönderim yarıda kesildi; Gönderilenler klasörünü kontrol edin' },
  })
  const due = await prisma.assistantEmail.findMany({
    where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
    orderBy: { scheduledAt: 'asc' },
    take: 20,
  })
  let sent = 0
  for (const m of due) {
    const r = await deliver(m.id, 'SCHEDULED')
    if (r.ok) {
      sent++
      await sendPushToOwner(m.ownerEmail, { title: 'Mail gönderildi', body: `${m.subject} → ${m.toEmails}`, url: '/assistant' })
    } else if (!r.error?.startsWith('Mail bu durumda')) {
      const final = (await prisma.assistantEmail.findUnique({ where: { id: m.id } }))?.status === 'FAILED'
      if (final) await sendPushToOwner(m.ownerEmail, { title: 'Mail gönderilemedi', body: `${m.subject}: ${r.error}`, url: '/assistant' })
    }
  }
  return sent
}
