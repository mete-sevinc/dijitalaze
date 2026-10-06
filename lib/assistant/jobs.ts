import { prisma } from '@/lib/db'
import { sendPushToOwner } from './push'

const TR_OFFSET_MS = 3 * 60 * 60 * 1000 // Europe/Istanbul, DST yok

function endOfTodayTR(now: Date): Date {
  const local = new Date(now.getTime() + TR_OFFSET_MS)
  local.setUTCHours(23, 59, 59, 999)
  return new Date(local.getTime() - TR_OFFSET_MS)
}

const hm = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' })

// Vadesi gelen hatırlatmaları (tüm sahipler için) bir kez gönderir.
export async function sendDueReminders(): Promise<number> {
  const due = await prisma.assistantTask.findMany({
    where: { doneAt: null, remindedAt: null, remindAt: { lte: new Date() } },
    orderBy: { remindAt: 'asc' },
    take: 100,
  })
  let sent = 0
  for (const t of due) {
    const claimed = await prisma.assistantTask.updateMany({
      where: { id: t.id, remindedAt: null },
      data: { remindedAt: new Date() },
    })
    if (claimed.count === 0) continue
    sent += await sendPushToOwner(t.ownerEmail, { title: 'Hatırlatma', body: t.title, url: '/assistant' })
  }
  return sent
}

// Bildirim aboneliği olan her sahibe günlük özet gönderir.
export async function sendDailyBriefs(): Promise<number> {
  const now = new Date()
  const eod = endOfTodayTR(now)
  const owners = await prisma.assistantPushSubscription.findMany({ distinct: ['ownerEmail'], select: { ownerEmail: true } })
  let sent = 0
  for (const { ownerEmail } of owners) {
    const tasks = await prisma.assistantTask.findMany({
      where: {
        ownerEmail,
        doneAt: null,
        OR: [{ dueAt: { lte: eod } }, { remindAt: { lte: eod } }],
      },
      orderBy: [{ dueAt: 'asc' }, { remindAt: 'asc' }],
      take: 8,
    })
    const lines = tasks.map((t) => {
      const when = t.dueAt ?? t.remindAt
      const overdue = when && when < now ? ' (gecikmiş)' : ''
      return `• ${t.title}${when ? ` – ${hm.format(when)}` : ''}${overdue}`
    })
    const body = lines.length ? lines.join('\n') : 'Bugün için planlı iş yok.'
    sent += await sendPushToOwner(ownerEmail, { title: 'Günaydın – bugünün planı', body, url: '/assistant' })
  }
  return sent
}
