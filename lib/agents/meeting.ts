import { prisma } from '@/lib/db'
import { runAgent } from '@/lib/ai/agent-loop'
import { assertWithinBudget, createUsageTracker } from '@/lib/ai/usage'
import { UserError } from '@/lib/action-log'
import { contextBuilder } from './context-builder'
import {
  buildTurnPrompt,
  buildWrapUpPrompt,
  MAX_TRANSCRIPT_MESSAGES,
  MEETING_SYSTEM_RULES,
  nextSpeaker,
  parseWrapUp,
  WRAPUP_SYSTEM,
  type TranscriptLine,
  type WrapUp,
} from '@/lib/meeting-turns'

const MAX_REPLY_CHARS = 1500
const NO_TOOLS = async () => {
  throw new Error('Toplantıda araç kullanılamaz')
}

async function loadMeeting(meetingId: string, companyId: string) {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, companyId },
    include: { participants: { orderBy: { createdAt: 'asc' }, include: { employee: { select: { id: true, name: true, status: true } } } } },
  })
  if (!meeting) throw new UserError('Toplantı bulunamadı')
  return meeting
}

async function transcriptOf(meetingId: string, names: Map<string, string>): Promise<TranscriptLine[]> {
  const rows = await prisma.meetingMessage.findMany({
    where: { meetingId },
    orderBy: { createdAt: 'desc' },
    take: MAX_TRANSCRIPT_MESSAGES,
    select: { employeeId: true, content: true },
  })
  return rows.reverse().map((m) => ({ speaker: (m.employeeId && names.get(m.employeeId)) || 'Toplantı sahibi', content: m.content }))
}

// One participant speaks. Turn order and the per-person cap are decided here, never by the client.
export async function speakInMeeting(meetingId: string, companyId: string) {
  const meeting = await loadMeeting(meetingId, companyId)
  if (meeting.status !== 'ACTIVE') throw new UserError('Yalnızca süren toplantıda konuşulabilir')

  const speakers = meeting.participants.filter((p) => p.employee.status === 'ACTIVE')
  const counts = await prisma.meetingMessage.groupBy({ by: ['employeeId'], where: { meetingId, employeeId: { not: null } }, _count: true })
  const turns = new Map(counts.flatMap((c) => (c.employeeId ? [[c.employeeId, c._count] as const] : [])))
  const id = nextSpeaker(speakers.map((s) => s.employee.id), turns)
  if (!id) return { done: true as const }

  const speaker = speakers.find((s) => s.employee.id === id)!.employee
  const names = new Map(meeting.participants.map((p) => [p.employee.id, p.employee.name]))
  const transcript = await transcriptOf(meetingId, names)

  const context = await contextBuilder.buildContext(id, companyId, [])
  const system = `${contextBuilder.buildSystemPrompt(context)}\n\n${MEETING_SYSTEM_RULES}`

  await assertWithinBudget(id)
  const usage = createUsageTracker(id)
  const reply = (
    await runAgent({
      system,
      history: [],
      userText: buildTurnPrompt({ title: meeting.title, agenda: meeting.agenda, transcript, speaker: speaker.name }),
      tools: [],
      run: NO_TOOLS,
      maxRounds: 1,
      onUsage: usage.add,
    }).finally(() => usage.flush())
  ).trim()
  if (!reply) throw new UserError(`${speaker.name} yanıt veremedi, tekrar dene`)

  const content = reply.slice(0, MAX_REPLY_CHARS)
  await prisma.meetingMessage.create({ data: { meetingId, employeeId: id, content } })
  return { done: false as const, speaker: speaker.name, content }
}

// Drafts a summary, decisions and action proposals for the owner to edit. Nothing is saved here.
export async function draftMeetingWrapUp(meetingId: string, companyId: string): Promise<WrapUp> {
  const meeting = await loadMeeting(meetingId, companyId)
  const people = meeting.participants.map((p) => ({ id: p.employee.id, name: p.employee.name }))
  const transcript = await transcriptOf(meetingId, new Map(people.map((p) => [p.id, p.name])))
  if (transcript.length === 0) throw new UserError('Özet için önce konuşma ya da not gerekli')

  const text = await runAgent({
    system: WRAPUP_SYSTEM,
    history: [],
    userText: buildWrapUpPrompt({ title: meeting.title, agenda: meeting.agenda, transcript }),
    tools: [],
    run: NO_TOOLS,
    maxRounds: 1,
  })
  const wrap = parseWrapUp(text, people)
  if (!wrap.summary && wrap.decisions.length === 0 && wrap.actions.length === 0) throw new UserError('Özet oluşturulamadı, tekrar dene')
  return wrap
}
