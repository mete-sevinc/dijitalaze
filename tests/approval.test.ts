import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  approval: { findUniqueOrThrow: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
  employeeMemory: { create: vi.fn() },
  auditLog: { create: vi.fn() },
  task: { findUniqueOrThrow: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
}))
const executeToolAction = vi.hoisted(() => vi.fn())
const buildContext = vi.hoisted(() => vi.fn())
const after = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma }))
vi.mock('next/server', () => ({ after }))
vi.mock('@/lib/ai/agent-loop', () => ({ runAgent: vi.fn() }))
vi.mock('@/lib/ai/usage', () => ({ assertWithinBudget: vi.fn(), createUsageTracker: () => ({ add: vi.fn(), flush: vi.fn() }) }))
vi.mock('@/lib/agents/tool-executor', () => ({ executeToolAction }))
vi.mock('@/lib/agents/context-builder', () => ({ contextBuilder: { buildContext, buildSystemPrompt: vi.fn() } }))

import { buildEmployeeRunner, resolveEmployeeApproval } from '@/lib/agents/work'
import type { AgentContext } from '@/lib/types'

const approval = (action: string, payload: object) => ({
  id: 'a1', companyId: 'c1', employeeId: 'e1', action, payload: JSON.stringify(payload),
})

beforeEach(() => {
  vi.resetAllMocks()
  prisma.approval.updateMany.mockResolvedValue({ count: 1 })
  buildContext.mockResolvedValue({ employeeId: 'e1', permissions: ['CAN_READ'] })
  executeToolAction.mockResolvedValue({ toolName: 'x', result: { ok: true } })
})

describe('approving a gated action', () => {
  it('runs the stored tool call with the approval granting the needed permissions, then audits', async () => {
    prisma.approval.findUniqueOrThrow.mockResolvedValue(approval('create_task', { title: 'Teklif' }))
    await resolveEmployeeApproval('a1', true)
    const [action, payload, ctx] = executeToolAction.mock.calls[0]
    expect(action).toBe('create_task')
    expect(payload).toEqual({ title: 'Teklif' })
    expect(ctx.permissions).toEqual(expect.arrayContaining(['CAN_READ', 'CAN_CREATE_TASKS', 'CAN_UPDATE_TASKS']))
    expect(prisma.approval.updateMany.mock.calls[0][0].data.status).toBe('APPROVED')
    expect(prisma.auditLog.create.mock.calls[0][0].data.action).toBe('APPROVAL_APPROVED')
  })

  it('starts the new assignee after a delegation is approved', async () => {
    prisma.approval.findUniqueOrThrow.mockResolvedValue(approval('delegate_task', { taskId: 't1', toEmployee: 'Mehmet' }))
    executeToolAction.mockResolvedValue({ toolName: 'delegate_task', result: { taskId: 't1', assignee: 'Mehmet' } })
    await resolveEmployeeApproval('a1', true)
    expect(after).toHaveBeenCalledTimes(1)
  })

  it('does not start anything for other approved actions', async () => {
    prisma.approval.findUniqueOrThrow.mockResolvedValue(approval('create_task', { title: 'x' }))
    await resolveEmployeeApproval('a1', true)
    expect(after).not.toHaveBeenCalled()
  })

  it('surfaces a failing tool instead of reporting success', async () => {
    prisma.approval.findUniqueOrThrow.mockResolvedValue(approval('create_task', { title: 'x' }))
    executeToolAction.mockResolvedValue({ toolName: 'create_task', result: null, error: 'Permission denied' })
    await expect(resolveEmployeeApproval('a1', true)).rejects.toThrow('Permission denied')
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  it('cannot be resolved twice', async () => {
    prisma.approval.findUniqueOrThrow.mockResolvedValue(approval('create_task', {}))
    prisma.approval.updateMany.mockResolvedValue({ count: 0 })
    await expect(resolveEmployeeApproval('a1', true)).rejects.toThrow('zaten sonuçlanmış')
    expect(executeToolAction).not.toHaveBeenCalled()
  })
})

describe('rejecting', () => {
  it('executes nothing and teaches the employee the reason', async () => {
    prisma.approval.findUniqueOrThrow.mockResolvedValue(approval('create_task', { title: 'x' }))
    await resolveEmployeeApproval('a1', false, 'Gereksiz')
    expect(executeToolAction).not.toHaveBeenCalled()
    expect(prisma.employeeMemory.create.mock.calls[0][0].data.content).toContain('Gereksiz')
    expect(prisma.auditLog.create.mock.calls[0][0].data.action).toBe('APPROVAL_REJECTED')
  })
})

describe('gate in the employee runner', () => {
  it('turns gated tools into pending approvals instead of executing them', async () => {
    prisma.approval.create.mockResolvedValue({ id: 'a9' })
    const ctx = { employeeId: 'e1', employeeName: 'Ayşe' } as AgentContext
    const { run, hasSideEffects } = buildEmployeeRunner(ctx, 'c1')
    const out = await run('delegate_task', { taskId: 't1', toEmployee: 'Mehmet' })
    expect(out).toMatchObject({ status: 'pending_approval', approvalId: 'a9' })
    expect(executeToolAction).not.toHaveBeenCalled()
    expect(hasSideEffects()).toBe(true)
  })
})
