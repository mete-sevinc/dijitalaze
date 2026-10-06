'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { chatWithAssistant } from '@/lib/assistant/service'

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
      take: 10,
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
