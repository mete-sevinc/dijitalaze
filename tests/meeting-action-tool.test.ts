import { beforeEach, describe, expect, it, vi } from 'vitest'

const tx = vi.hoisted(() => ({ task: { create: vi.fn() }, meetingActionItem: { create: vi.fn() } }))
const prisma = vi.hoisted(() => ({
  employee: { findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
  meeting: { findFirst: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ prisma }))

import { executeToolAction } from '@/lib/agents/tool-executor'
import type { AgentContext } from '@/lib/types'

const ctx = { employeeId: 'e1', employeeName: 'Ayşe', permissions: ['CAN_CREATE_TASKS'] } as AgentContext

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  prisma.employee.findUniqueOrThrow.mockResolvedValue({ companyId: 'c1' })
  prisma.employee.findUnique.mockResolvedValue({ companyId: 'c1' })
  prisma.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx))
})

describe('create_meeting_action tool', () => {
  it('rejects a meeting that is not in the employee company', async () => {
    prisma.meeting.findFirst.mockResolvedValue(null)
    const r = await executeToolAction('create_meeting_action', { meetingId: 'foreign', content: 'x' }, ctx)
    expect(r.error).toBe('Meeting not found')
    expect(prisma.meeting.findFirst.mock.calls[0][0].where).toEqual({ id: 'foreign', companyId: 'c1' })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects closed meetings and foreign assignees', async () => {
    prisma.meeting.findFirst.mockResolvedValue({ id: 'm1', title: 'T', status: 'COMPLETED' })
    expect((await executeToolAction('create_meeting_action', { meetingId: 'm1', content: 'x' }, ctx)).error).toBe('Meeting is closed')
    prisma.meeting.findFirst.mockResolvedValue({ id: 'm1', title: 'T', status: 'ACTIVE' })
    prisma.employee.findFirst.mockResolvedValue(null)
    expect((await executeToolAction('create_meeting_action', { meetingId: 'm1', content: 'x', assigneeId: 'foreign' }, ctx)).error).toBe('Assignee not found')
  })

  it('creates the action item and its task together', async () => {
    prisma.meeting.findFirst.mockResolvedValue({ id: 'm1', title: 'T', status: 'ACTIVE' })
    prisma.employee.findFirst.mockResolvedValue({ id: 'e2' })
    tx.task.create.mockResolvedValue({ id: 't1' })
    tx.meetingActionItem.create.mockResolvedValue({ id: 'a1', content: 'x', status: 'ASSIGNED' })
    const r = await executeToolAction('create_meeting_action', { meetingId: 'm1', content: 'x', assigneeId: 'e2' }, ctx)
    expect(r.error).toBeUndefined()
    expect(tx.task.create.mock.calls[0][0].data).toMatchObject({ companyId: 'c1', assigneeId: 'e2', creatorId: 'e1', source: 'meeting:m1' })
    expect(tx.meetingActionItem.create.mock.calls[0][0].data).toMatchObject({ taskId: 't1', status: 'ASSIGNED' })
  })

  it('requires both meetingId and content', async () => {
    expect((await executeToolAction('create_meeting_action', { content: 'x' }, ctx)).error).toBeTruthy()
    expect(prisma.meeting.findFirst).not.toHaveBeenCalled()
  })

  it('needs CAN_CREATE_TASKS to assign work from a meeting', async () => {
    prisma.meeting.findFirst.mockResolvedValue({ id: 'm1', title: 'T', status: 'ACTIVE' })
    const r = await executeToolAction('create_meeting_action', { meetingId: 'm1', content: 'x', assigneeId: 'e2' }, { ...ctx, permissions: [] } as AgentContext)
    expect(r.error).toContain('CAN_CREATE_TASKS')
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
