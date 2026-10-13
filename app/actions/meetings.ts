'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'
import { assertEmployeeInCompany, getCompanyId } from '@/lib/company'
import { logActionError, UserError, userMessage } from '@/lib/action-log'
import { draftMeetingWrapUp, speakInMeeting } from '@/lib/agents/meeting'

const idSchema = z.string().min(1).max(64)
const createSchema = z.object({
  title: z.string().trim().min(1, 'Toplantı başlığı gerekli').max(200),
  agenda: z.string().trim().max(4000).optional(),
  participantIds: z.array(idSchema).min(1, 'En az bir katılımcı gerekli').max(30),
})

// Allowed status moves. COMPLETED goes through completeMeeting so a summary can be recorded.
const TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['CANCELLED'],
}

async function ownMeeting(id: string, companyId: string) {
  const meeting = await prisma.meeting.findFirst({ where: { id, companyId }, select: { id: true, status: true, title: true } })
  if (!meeting) throw new UserError('Toplantı bulunamadı')
  return meeting
}

function fail(action: string, e: unknown, fallback: string) {
  if (e instanceof z.ZodError) return { success: false as const, error: e.issues[0].message }
  logActionError(action, e)
  return { success: false as const, error: userMessage(e, fallback) }
}

export async function getMeetings() {
  await requireAuth()
  try {
    const companyId = await getCompanyId()
    const meetings = await prisma.meeting.findMany({
      where: { companyId },
      include: {
        participants: { include: { employee: { select: { name: true } } } },
        _count: { select: { actionItems: true, messages: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return { success: true as const, data: meetings }
  } catch (e) {
    return fail('getMeetings', e, 'Toplantılar alınamadı')
  }
}

export async function getMeeting(id: string) {
  await requireAuth()
  try {
    const companyId = await getCompanyId()
    const meeting = await prisma.meeting.findFirst({
      where: { id: idSchema.parse(id), companyId },
      include: {
        participants: { include: { employee: { select: { id: true, name: true, title: true } } } },
        messages: { orderBy: { createdAt: 'asc' } },
        actionItems: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!meeting) return { success: false as const, error: 'Toplantı bulunamadı' }
    return { success: true as const, data: meeting }
  } catch (e) {
    return fail('getMeeting', e, 'Toplantı alınamadı')
  }
}

export async function createMeeting(input: z.infer<typeof createSchema>) {
  await requireAuth()
  try {
    const data = createSchema.parse(input)
    const companyId = await getCompanyId()
    const ids = [...new Set(data.participantIds)]
    const found = await prisma.employee.count({ where: { id: { in: ids }, companyId } })
    if (found !== ids.length) throw new UserError('Katılımcı bulunamadı')
    const meeting = await prisma.meeting.create({
      data: {
        companyId,
        title: data.title,
        agenda: data.agenda || null,
        participants: { create: ids.map((employeeId) => ({ employeeId, role: 'ai' })) },
      },
    })
    return { success: true as const, id: meeting.id }
  } catch (e) {
    return fail('createMeeting', e, 'Toplantı oluşturulamadı')
  }
}

export async function setMeetingStatus(id: string, status: 'ACTIVE' | 'CANCELLED') {
  await requireAuth()
  try {
    const next = z.enum(['ACTIVE', 'CANCELLED']).parse(status)
    const companyId = await getCompanyId()
    const meeting = await ownMeeting(idSchema.parse(id), companyId)
    if (!TRANSITIONS[meeting.status]?.includes(next)) throw new UserError('Bu durum değişikliği yapılamaz')
    await prisma.meeting.update({
      where: { id: meeting.id, companyId },
      data: next === 'ACTIVE' ? { status: next, startedAt: new Date() } : { status: next, endedAt: new Date() },
    })
    return { success: true as const }
  } catch (e) {
    return fail('setMeetingStatus', e, 'Durum değiştirilemedi')
  }
}

const completeSchema = z.object({
  summary: z.string().trim().min(1, 'Özet gerekli').max(4000),
  decisions: z.array(z.string().trim().min(1).max(500)).max(30).optional(),
})

export async function completeMeeting(id: string, input: z.infer<typeof completeSchema>) {
  await requireAuth()
  try {
    const data = completeSchema.parse(input)
    const companyId = await getCompanyId()
    const meeting = await ownMeeting(idSchema.parse(id), companyId)
    if (meeting.status !== 'ACTIVE') throw new UserError('Yalnızca süren toplantı tamamlanabilir')
    await prisma.meeting.update({
      where: { id: meeting.id, companyId },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
        summary: data.summary,
        decisions: JSON.stringify(data.decisions ?? []),
      },
    })
    return { success: true as const }
  } catch (e) {
    return fail('completeMeeting', e, 'Toplantı tamamlanamadı')
  }
}

export async function addMeetingNote(id: string, content: string) {
  await requireAuth()
  try {
    const text = z.string().trim().min(1, 'Not boş olamaz').max(4000).parse(content)
    const companyId = await getCompanyId()
    const meeting = await ownMeeting(idSchema.parse(id), companyId)
    if (meeting.status === 'COMPLETED' || meeting.status === 'CANCELLED') throw new UserError('Kapanmış toplantıya not eklenemez')
    await prisma.meetingMessage.create({ data: { meetingId: meeting.id, content: text } })
    return { success: true as const }
  } catch (e) {
    return fail('addMeetingNote', e, 'Not eklenemedi')
  }
}

const actionSchema = z.object({
  content: z.string().trim().min(1, 'Aksiyon metni gerekli').max(500),
  assigneeId: idSchema.optional(),
})

// An action item with an assignee also becomes a task for that employee.
export async function addActionItem(meetingId: string, input: z.infer<typeof actionSchema>) {
  await requireAuth()
  try {
    const data = actionSchema.parse(input)
    const companyId = await getCompanyId()
    const meeting = await ownMeeting(idSchema.parse(meetingId), companyId)
    if (data.assigneeId) await assertEmployeeInCompany(data.assigneeId, companyId)
    await prisma.$transaction(async (tx) => {
      const task = data.assigneeId
        ? await tx.task.create({
            data: {
              companyId,
              title: data.content,
              description: `Toplantı aksiyonu: ${meeting.title}`,
              assigneeId: data.assigneeId,
              status: 'TODO',
              priority: 'HIGH',
              source: `meeting:${meeting.id}`,
            },
            select: { id: true },
          })
        : null
      await tx.meetingActionItem.create({
        data: {
          meetingId: meeting.id,
          content: data.content,
          assigneeId: data.assigneeId,
          taskId: task?.id,
          status: data.assigneeId ? 'ASSIGNED' : 'OPEN',
        },
      })
    })
    return { success: true as const }
  } catch (e) {
    return fail('addActionItem', e, 'Aksiyon eklenemedi')
  }
}

export async function completeActionItem(meetingId: string, itemId: string) {
  await requireAuth()
  try {
    const companyId = await getCompanyId()
    const meeting = await ownMeeting(idSchema.parse(meetingId), companyId)
    const updated = await prisma.meetingActionItem.updateMany({
      where: { id: idSchema.parse(itemId), meetingId: meeting.id, status: { not: 'COMPLETED' } },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })
    if (updated.count === 0) throw new UserError('Aksiyon bulunamadı')
    return { success: true as const }
  } catch (e) {
    return fail('completeActionItem', e, 'Aksiyon güncellenemedi')
  }
}

// One AI participant speaks per call, so each request stays well inside the function time limit.
export async function speakNext(meetingId: string) {
  await requireAuth()
  try {
    const companyId = await getCompanyId()
    return { success: true as const, ...(await speakInMeeting(idSchema.parse(meetingId), companyId)) }
  } catch (e) {
    return fail('speakNext', e, 'Konuşma alınamadı')
  }
}

export async function draftWrapUp(meetingId: string) {
  await requireAuth()
  try {
    const companyId = await getCompanyId()
    return { success: true as const, data: await draftMeetingWrapUp(idSchema.parse(meetingId), companyId) }
  } catch (e) {
    return fail('draftWrapUp', e, 'Özet oluşturulamadı')
  }
}

// Removes the meeting with its notes, participants and action items. Tasks already created from
// action items stay, since they may be in progress.
export async function deleteMeeting(id: string) {
  await requireAuth()
  try {
    const companyId = await getCompanyId()
    await prisma.meeting.delete({ where: { id: idSchema.parse(id), companyId } })
    return { success: true as const }
  } catch (e) {
    return fail('deleteMeeting', e, 'Toplantı silinemedi')
  }
}
