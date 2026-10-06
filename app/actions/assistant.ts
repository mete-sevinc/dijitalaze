'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { chatWithAssistant } from '@/lib/assistant/service'
import { isAllowedPushEndpoint } from '@/lib/assistant/push'

async function owner(): Promise<string> {
  const session = await auth()
  const email = session?.user?.email?.toLowerCase()
  if (!email) throw new Error('Unauthorized')
  return email
}

export async function sendAssistantMessage(content: string) {
  const email = await owner()
  const text = content.trim().slice(0, 4000)
  if (!text) return { success: false as const, error: 'Boş mesaj' }
  try {
    return { success: true as const, reply: await chatWithAssistant(email, text) }
  } catch (error) {
    console.error('assistant chat failed', error)
    return { success: false as const, error: 'Asistan yanıt veremedi' }
  }
}

export async function getAssistantState() {
  const email = await owner()
  const [messages, tasks, notes] = await Promise.all([
    prisma.assistantMessage.findMany({
      where: { ownerEmail: email },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.assistantTask.findMany({
      where: { ownerEmail: email, doneAt: null },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 50,
    }),
    prisma.assistantNote.findMany({
      where: { ownerEmail: email },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ])
  return {
    messages: messages.reverse().map((m) => ({ id: m.id, role: m.role, content: m.content })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      dueAt: t.dueAt?.toISOString() ?? null,
      remindAt: t.remindAt?.toISOString() ?? null,
    })),
    notes: notes.map((n) => ({ id: n.id, content: n.content })),
  }
}

export async function completeAssistantTask(id: string) {
  const email = await owner()
  await prisma.assistantTask.updateMany({
    where: { id, ownerEmail: email, doneAt: null },
    data: { doneAt: new Date() },
  })
}

// Vadesi gelen hatırlatmaları döner ve bir daha dönmemesi için işaretler.
export async function claimDueReminders() {
  const email = await owner()
  const due = await prisma.assistantTask.findMany({
    where: { ownerEmail: email, doneAt: null, remindedAt: null, remindAt: { lte: new Date() } },
    orderBy: { remindAt: 'asc' },
    take: 20,
  })
  if (due.length === 0) return []
  const claimed = await prisma.assistantTask.updateMany({
    where: { id: { in: due.map((t) => t.id) }, remindedAt: null },
    data: { remindedAt: new Date() },
  })
  return claimed.count > 0 ? due.map((t) => ({ id: t.id, title: t.title })) : []
}

const noteContent = z.string().trim().min(1).max(5000)

export async function updateAssistantNote(id: string, content: string) {
  const email = await owner()
  const parsed = noteContent.safeParse(content)
  if (!parsed.success) return { success: false as const, error: 'Geçersiz not' }
  const r = await prisma.assistantNote.updateMany({
    where: { id, ownerEmail: email },
    data: { content: parsed.data },
  })
  return { success: r.count > 0 }
}

export async function deleteAssistantNote(id: string) {
  const email = await owner()
  const r = await prisma.assistantNote.deleteMany({ where: { id, ownerEmail: email } })
  return { success: r.count > 0 }
}

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(256) }),
})

export async function savePushSubscription(input: unknown) {
  const email = await owner()
  const parsed = subscriptionSchema.safeParse(input)
  if (!parsed.success || !isAllowedPushEndpoint(parsed.data.endpoint)) {
    return { success: false as const, error: 'Geçersiz abonelik' }
  }
  const { endpoint, keys } = parsed.data
  await prisma.assistantPushSubscription.upsert({
    where: { endpoint },
    create: { ownerEmail: email, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { ownerEmail: email, p256dh: keys.p256dh, auth: keys.auth },
  })
  return { success: true as const }
}

export async function removePushSubscription(endpoint: string) {
  const email = await owner()
  await prisma.assistantPushSubscription.deleteMany({ where: { endpoint, ownerEmail: email } })
}
