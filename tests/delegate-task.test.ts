import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  employee: { findUniqueOrThrow: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
  task: { findFirst: vi.fn(), update: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ prisma }))

import { executeToolAction } from '@/lib/agents/tool-executor'
import { GATED_TOOLS } from '@/lib/agents/tools'
import type { AgentContext } from '@/lib/types'

const ctx = { employeeId: 'e1', employeeName: 'Ayşe', permissions: [] } as unknown as AgentContext
const task = (over: object = {}) => ({ id: 't1', companyId: 'c1', assigneeId: 'e1', status: 'IN_PROGRESS', description: 'Teklif', ...over })

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  prisma.employee.findUniqueOrThrow.mockResolvedValue({ companyId: 'c1' })
  prisma.employee.findUnique.mockResolvedValue({ companyId: 'c1' })
  prisma.employee.findMany.mockResolvedValue([{ id: 'e2', name: 'Mehmet Kaya' }, { id: 'e3', name: 'Murat Şahin' }])
  prisma.$transaction.mockResolvedValue([])
})

describe('delegate_task', () => {
  it('is behind the approval gate so handoffs cannot loop unattended', () => {
    expect(GATED_TOOLS.has('delegate_task')).toBe(true)
  })

  it('hands an own task to a colleague found by first name and reopens it', async () => {
    prisma.task.findFirst.mockResolvedValue(task())
    const r = await executeToolAction('delegate_task', { taskId: 't1', toEmployee: 'Mehmet', note: 'Şartname bitti' }, ctx)
    expect(r.error).toBeUndefined()
    expect(r.result).toEqual({ taskId: 't1', assignee: 'Mehmet Kaya', status: 'TODO' })
    expect(prisma.task.findFirst.mock.calls[0][0].where).toEqual({ id: 't1', companyId: 'c1' })
    const upd = prisma.task.update.mock.calls[0][0]
    expect(upd.data).toMatchObject({ assigneeId: 'e2', status: 'TODO', result: null })
    expect(upd.data.description).toContain('[Devir] Ayşe → Mehmet Kaya: Şartname bitti')
  })

  it('refuses tasks that belong to someone else without permission', async () => {
    prisma.task.findFirst.mockResolvedValue(task({ assigneeId: 'other' }))
    expect((await executeToolAction('delegate_task', { taskId: 't1', toEmployee: 'Mehmet' }, ctx)).error).toContain('own tasks')
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('refuses closed tasks, unknown tasks and unknown colleagues', async () => {
    prisma.task.findFirst.mockResolvedValue(task({ status: 'DONE' }))
    expect((await executeToolAction('delegate_task', { taskId: 't1', toEmployee: 'Mehmet' }, ctx)).error).toBe('Task is closed')
    prisma.task.findFirst.mockResolvedValue(null)
    expect((await executeToolAction('delegate_task', { taskId: 'x', toEmployee: 'Mehmet' }, ctx)).error).toBe('Task not found')
    prisma.task.findFirst.mockResolvedValue(task())
    expect((await executeToolAction('delegate_task', { taskId: 't1', toEmployee: 'Nobody' }, ctx)).error).toBe('Colleague not found')
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('asks for an id when the first name is ambiguous', async () => {
    prisma.task.findFirst.mockResolvedValue(task())
    prisma.employee.findMany.mockResolvedValue([{ id: 'e2', name: 'Mehmet Kaya' }, { id: 'e4', name: 'Mehmet Demir' }])
    const r = await executeToolAction('delegate_task', { taskId: 't1', toEmployee: 'Mehmet' }, ctx)
    expect(r.error).toContain('Ambiguous')
    expect(r.error).toContain('e4')
  })

  it('never offers the current assignee as a target', async () => {
    prisma.task.findFirst.mockResolvedValue(task())
    await executeToolAction('delegate_task', { taskId: 't1', toEmployee: 'Mehmet' }, ctx)
    expect(prisma.employee.findMany.mock.calls[0][0].where).toMatchObject({ companyId: 'c1', status: 'ACTIVE', id: { not: 'e1' } })
  })
})
