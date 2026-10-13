import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  company: { findUnique: vi.fn(), findFirst: vi.fn() },
  meeting: { findFirst: vi.fn(), delete: vi.fn() },
  meetingMessage: { groupBy: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  employeeReport: { delete: vi.fn() },
}))
const runAgent = vi.hoisted(() => vi.fn())
const assertWithinBudget = vi.hoisted(() => vi.fn())
const usage = vi.hoisted(() => ({ add: vi.fn(), flush: vi.fn().mockResolvedValue(undefined) }))
const contextBuilder = vi.hoisted(() => ({
  buildContext: vi.fn().mockResolvedValue({}),
  buildSystemPrompt: vi.fn().mockReturnValue('SYS'),
}))

vi.mock('@/lib/db', () => ({ prisma }))
vi.mock('@/lib/require-auth', () => ({ requireAuth: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/ai/agent-loop', () => ({ runAgent }))
vi.mock('@/lib/ai/usage', () => ({ assertWithinBudget, createUsageTracker: () => usage }))
vi.mock('@/lib/agents/context-builder', () => ({ contextBuilder }))

import { speakInMeeting, draftMeetingWrapUp } from '@/lib/agents/meeting'
import { deleteMeeting, draftWrapUp, speakNext } from '@/app/actions/meetings'
import { deleteReport } from '@/app/actions/reports'
import { UserError } from '@/lib/action-log'

const COMPANY = 'demo_company'
const emp = (id: string, name: string, status = 'ACTIVE') => ({ employee: { id, name, status } })
const meeting = (over: object = {}) => ({
  id: 'm1', title: 'Haftalık', agenda: 'Teklifler', status: 'ACTIVE',
  participants: [emp('a', 'Ayşe'), emp('b', 'Mehmet')], ...over,
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  prisma.company.findUnique.mockResolvedValue({ id: COMPANY })
  prisma.meetingMessage.groupBy.mockResolvedValue([])
  prisma.meetingMessage.findMany.mockResolvedValue([])
  contextBuilder.buildContext.mockResolvedValue({})
  contextBuilder.buildSystemPrompt.mockReturnValue('SYS')
  usage.flush.mockResolvedValue(undefined)
  runAgent.mockResolvedValue('Bence teklifi cuma gönderelim.')
})

describe('speakInMeeting', () => {
  it('looks the meeting up inside the company and only speaks in active meetings', async () => {
    prisma.meeting.findFirst.mockResolvedValue(meeting({ status: 'SCHEDULED' }))
    await expect(speakInMeeting('m1', COMPANY)).rejects.toThrow('Yalnızca süren toplantıda konuşulabilir')
    expect(prisma.meeting.findFirst.mock.calls[0][0].where).toEqual({ id: 'm1', companyId: COMPANY })
    expect(runAgent).not.toHaveBeenCalled()
  })

  it('lets the participant with the fewest turns speak and stores the reply under their id', async () => {
    prisma.meeting.findFirst.mockResolvedValue(meeting())
    prisma.meetingMessage.groupBy.mockResolvedValue([{ employeeId: 'a', _count: 1 }])
    const res = await speakInMeeting('m1', COMPANY)
    expect(res).toEqual({ done: false, speaker: 'Mehmet', content: 'Bence teklifi cuma gönderelim.' })
    expect(prisma.meetingMessage.create).toHaveBeenCalledWith({ data: { meetingId: 'm1', employeeId: 'b', content: 'Bence teklifi cuma gönderelim.' } })
    expect(assertWithinBudget).toHaveBeenCalledWith('b')
    expect(contextBuilder.buildContext).toHaveBeenCalledWith('b', COMPANY, [])
  })

  it('runs the model without tools so a meeting cannot cause side effects', async () => {
    prisma.meeting.findFirst.mockResolvedValue(meeting())
    await speakInMeeting('m1', COMPANY)
    const opts = runAgent.mock.calls[0][0]
    expect(opts.tools).toEqual([])
    await expect(opts.run('create_task', {})).rejects.toThrow()
    expect(opts.system).toContain('SYS')
    expect(opts.system).toContain('toplantısındasın')
  })

  it('reports done when everyone used their turns, without calling the model', async () => {
    prisma.meeting.findFirst.mockResolvedValue(meeting())
    prisma.meetingMessage.groupBy.mockResolvedValue([{ employeeId: 'a', _count: 3 }, { employeeId: 'b', _count: 3 }])
    expect(await speakInMeeting('m1', COMPANY)).toEqual({ done: true })
    expect(runAgent).not.toHaveBeenCalled()
  })

  it('skips participants who are not active', async () => {
    prisma.meeting.findFirst.mockResolvedValue(meeting({ participants: [emp('a', 'Ayşe', 'ARCHIVED'), emp('b', 'Mehmet')] }))
    expect((await speakInMeeting('m1', COMPANY) as { speaker: string }).speaker).toBe('Mehmet')
  })

  it('does not save an empty reply and still records usage', async () => {
    prisma.meeting.findFirst.mockResolvedValue(meeting())
    runAgent.mockResolvedValue('   ')
    await expect(speakInMeeting('m1', COMPANY)).rejects.toBeInstanceOf(UserError)
    expect(prisma.meetingMessage.create).not.toHaveBeenCalled()
    expect(usage.flush).toHaveBeenCalled()
  })

  it('stops before the model when the monthly budget is exhausted', async () => {
    prisma.meeting.findFirst.mockResolvedValue(meeting())
    assertWithinBudget.mockRejectedValue(new UserError('Bu çalışanın aylık kullanım limiti doldu'))
    await expect(speakInMeeting('m1', COMPANY)).rejects.toThrow('limiti doldu')
    expect(runAgent).not.toHaveBeenCalled()
  })

  it('clips very long replies', async () => {
    prisma.meeting.findFirst.mockResolvedValue(meeting())
    runAgent.mockResolvedValue('x'.repeat(5000))
    await speakInMeeting('m1', COMPANY)
    expect(prisma.meetingMessage.create.mock.calls[0][0].data.content).toHaveLength(1500)
  })
})

describe('draftMeetingWrapUp', () => {
  it('needs something to summarize', async () => {
    prisma.meeting.findFirst.mockResolvedValue(meeting())
    await expect(draftMeetingWrapUp('m1', COMPANY)).rejects.toThrow('önce konuşma ya da not gerekli')
  })

  it('returns a parsed draft and saves nothing', async () => {
    prisma.meeting.findFirst.mockResolvedValue(meeting())
    prisma.meetingMessage.findMany.mockResolvedValue([{ employeeId: 'a', content: 'Teklif cuma' }])
    runAgent.mockResolvedValue('ÖZET:\nTeklif konuşuldu.\nKARARLAR:\n- Cuma gönder\nAKSİYONLAR:\n- Ayşe: Teklifi gönder')
    const w = await draftMeetingWrapUp('m1', COMPANY)
    expect(w).toEqual({ summary: 'Teklif konuşuldu.', decisions: ['Cuma gönder'], actions: [{ content: 'Teklifi gönder', assigneeId: 'a' }] })
    expect(prisma.meetingMessage.create).not.toHaveBeenCalled()
  })

  it('rejects an unusable model answer', async () => {
    prisma.meeting.findFirst.mockResolvedValue(meeting())
    prisma.meetingMessage.findMany.mockResolvedValue([{ employeeId: null, content: 'not' }])
    runAgent.mockResolvedValue('anlamsız')
    await expect(draftMeetingWrapUp('m1', COMPANY)).rejects.toThrow('Özet oluşturulamadı')
  })
})

describe('actions', () => {
  it('show deliberate messages but hide internals', async () => {
    prisma.meeting.findFirst.mockResolvedValue(null)
    expect(await speakNext('m1')).toEqual({ success: false, error: 'Toplantı bulunamadı' })
    prisma.meeting.findFirst.mockRejectedValue(Object.assign(new Error('db secret'), { code: 'P1001' }))
    expect(await draftWrapUp('m1')).toEqual({ success: false, error: 'Özet oluşturulamadı' })
  })

  it('delete only within the company', async () => {
    prisma.meeting.delete.mockResolvedValue({})
    prisma.employeeReport.delete.mockResolvedValue({})
    expect(await deleteMeeting('m1')).toEqual({ success: true })
    expect(await deleteReport('r1')).toEqual({ success: true })
    expect(prisma.meeting.delete.mock.calls[0][0].where).toEqual({ id: 'm1', companyId: COMPANY })
    expect(prisma.employeeReport.delete.mock.calls[0][0].where).toEqual({ id: 'r1', companyId: COMPANY })
  })

  it('report a failed delete without leaking details', async () => {
    prisma.meeting.delete.mockRejectedValue(Object.assign(new Error('Record to delete does not exist'), { code: 'P2025' }))
    expect(await deleteMeeting('m1')).toEqual({ success: false, error: 'Toplantı silinemedi' })
  })
})
