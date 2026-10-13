import { beforeEach, describe, expect, it, vi } from 'vitest'

const tx = vi.hoisted(() => ({ task: { create: vi.fn() }, meetingActionItem: { create: vi.fn() } }))
const prisma = vi.hoisted(() => ({
  company: { findUnique: vi.fn(), findFirst: vi.fn() },
  employee: { count: vi.fn(), findFirst: vi.fn() },
  meeting: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  meetingMessage: { create: vi.fn() },
  meetingActionItem: { updateMany: vi.fn() },
  $transaction: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ prisma }))
vi.mock('@/lib/require-auth', () => ({ requireAuth: vi.fn().mockResolvedValue(undefined) }))

import { addActionItem, addMeetingNote, completeActionItem, completeMeeting, createMeeting, setMeetingStatus } from '@/app/actions/meetings'

const COMPANY = 'demo_company'
beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  prisma.company.findUnique.mockResolvedValue({ id: COMPANY })
  prisma.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx))
})

describe('createMeeting', () => {
  it('rejects participants that are not employees of the company', async () => {
    prisma.employee.count.mockResolvedValue(1)
    const res = await createMeeting({ title: 'Haftalık', participantIds: ['a', 'foreign'] })
    expect(res).toEqual({ success: false, error: 'Katılımcı bulunamadı' })
    expect(prisma.meeting.create).not.toHaveBeenCalled()
    expect(prisma.employee.count.mock.calls[0][0].where).toEqual({ id: { in: ['a', 'foreign'] }, companyId: COMPANY })
  })
  it('requires a title and at least one participant', async () => {
    expect((await createMeeting({ title: '  ', participantIds: ['a'] })).success).toBe(false)
    expect((await createMeeting({ title: 'x', participantIds: [] })).success).toBe(false)
  })
  it('deduplicates participants and stores the server-side company', async () => {
    prisma.employee.count.mockResolvedValue(1)
    prisma.meeting.create.mockResolvedValue({ id: 'm1' })
    const res = await createMeeting({ title: 'x', participantIds: ['a', 'a'] })
    expect(res).toEqual({ success: true, id: 'm1' })
    const data = prisma.meeting.create.mock.calls[0][0].data
    expect(data.companyId).toBe(COMPANY)
    expect(data.participants.create).toHaveLength(1)
  })
})

describe('meeting access and lifecycle', () => {
  it('does not touch meetings of another company', async () => {
    prisma.meeting.findFirst.mockResolvedValue(null)
    expect((await setMeetingStatus('m1', 'ACTIVE')).success).toBe(false)
    expect((await addMeetingNote('m1', 'not')).success).toBe(false)
    expect((await addActionItem('m1', { content: 'x' })).success).toBe(false)
    expect((await completeActionItem('m1', 'i1')).success).toBe(false)
    expect(prisma.meeting.findFirst.mock.calls[0][0].where).toEqual({ id: 'm1', companyId: COMPANY })
    expect(prisma.meeting.update).not.toHaveBeenCalled()
  })

  it('only allows valid status moves', async () => {
    prisma.meeting.findFirst.mockResolvedValue({ id: 'm1', status: 'COMPLETED', title: 't' })
    expect(await setMeetingStatus('m1', 'ACTIVE')).toEqual({ success: false, error: 'Bu durum değişikliği yapılamaz' })
    prisma.meeting.findFirst.mockResolvedValue({ id: 'm1', status: 'SCHEDULED', title: 't' })
    expect((await setMeetingStatus('m1', 'ACTIVE')).success).toBe(true)
    expect(prisma.meeting.update.mock.calls[0][0].data.status).toBe('ACTIVE')
  })

  it('completes only an active meeting and needs a summary', async () => {
    prisma.meeting.findFirst.mockResolvedValue({ id: 'm1', status: 'SCHEDULED', title: 't' })
    expect(await completeMeeting('m1', { summary: 'özet' })).toEqual({ success: false, error: 'Yalnızca süren toplantı tamamlanabilir' })
    prisma.meeting.findFirst.mockResolvedValue({ id: 'm1', status: 'ACTIVE', title: 't' })
    expect((await completeMeeting('m1', { summary: ' ' })).success).toBe(false)
    expect((await completeMeeting('m1', { summary: 'özet', decisions: ['a'] })).success).toBe(true)
    expect(prisma.meeting.update.mock.calls[0][0].data.decisions).toBe('["a"]')
  })

  it('rejects notes on closed meetings', async () => {
    prisma.meeting.findFirst.mockResolvedValue({ id: 'm1', status: 'CANCELLED', title: 't' })
    expect((await addMeetingNote('m1', 'x')).success).toBe(false)
    expect(prisma.meetingMessage.create).not.toHaveBeenCalled()
  })
})

describe('addActionItem', () => {
  beforeEach(() => prisma.meeting.findFirst.mockResolvedValue({ id: 'm1', status: 'ACTIVE', title: 'Haftalık' }))

  it('creates a linked task when an employee is assigned', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'e1' })
    tx.task.create.mockResolvedValue({ id: 't1' })
    expect((await addActionItem('m1', { content: 'Teklif gönder', assigneeId: 'e1' })).success).toBe(true)
    expect(tx.task.create.mock.calls[0][0].data).toMatchObject({ companyId: COMPANY, assigneeId: 'e1', source: 'meeting:m1' })
    expect(tx.meetingActionItem.create.mock.calls[0][0].data).toMatchObject({ taskId: 't1', status: 'ASSIGNED' })
  })

  it('creates only the action item without an assignee', async () => {
    expect((await addActionItem('m1', { content: 'Not al' })).success).toBe(true)
    expect(tx.task.create).not.toHaveBeenCalled()
    expect(tx.meetingActionItem.create.mock.calls[0][0].data.status).toBe('OPEN')
  })

  it('refuses an assignee from outside the company', async () => {
    prisma.employee.findFirst.mockResolvedValue(null)
    expect((await addActionItem('m1', { content: 'x', assigneeId: 'foreign' })).success).toBe(false)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
