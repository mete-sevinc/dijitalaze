import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  company: { findUnique: vi.fn(), findFirst: vi.fn() },
  employee: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn(), create: vi.fn() },
  task: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  employeeInstruction: { update: vi.fn(), delete: vi.fn() },
  approval: { findFirst: vi.fn() },
  conversation: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}))
const requireAuth = vi.hoisted(() => vi.fn())
const runConversation = vi.hoisted(() => vi.fn())
const work = vi.hoisted(() => ({
  assignTaskToEmployee: vi.fn(),
  resolveEmployeeApproval: vi.fn(),
  retryEmployeeTask: vi.fn(),
  reviewEmployeeTask: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma }))
vi.mock('@/lib/require-auth', () => ({ requireAuth }))
vi.mock('@/lib/agents/runtime', () => ({ agentRuntime: { runConversation, generateDailyBriefing: vi.fn() } }))
vi.mock('@/lib/agents/work', () => work)

import { createTask, updateTask } from '@/app/actions/tasks'
import { createEmployee, deleteEmployee } from '@/app/actions/employees'
import { deleteInstruction, updateInstruction } from '@/app/actions/instructions'
import { getConversation, sendMessage } from '@/app/actions/chat'
import { retryTask, reviewTask, resolveApproval } from '@/app/actions/work'
import { deleteAllData } from '@/app/actions/settings'

const COMPANY = 'demo_company'

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  requireAuth.mockResolvedValue(undefined)
  prisma.company.findUnique.mockResolvedValue({ id: COMPANY })
})

describe('authentication', () => {
  it('rejects every action when there is no session (before touching the database)', async () => {
    requireAuth.mockRejectedValue(new Error('Unauthorized'))
    await expect(createTask({ title: 'x' })).rejects.toThrow('Unauthorized')
    await expect(deleteEmployee('e1')).rejects.toThrow('Unauthorized')
    await expect(sendMessage('e1', 'hi')).rejects.toThrow('Unauthorized')
    await expect(deleteAllData('SİL')).rejects.toThrow('Unauthorized')
    expect(prisma.task.create).not.toHaveBeenCalled()
    expect(prisma.employee.delete).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})

describe('company scoping', () => {
  it('writes tasks under the server-resolved company, not a client value', async () => {
    prisma.task.create.mockResolvedValue({ id: 't1' })
    const res = await createTask({ title: 'Teklif' })
    expect(res.success).toBe(true)
    expect(prisma.task.create.mock.calls[0][0].data.companyId).toBe(COMPANY)
  })

  it('refuses to assign a task to an employee outside the company', async () => {
    prisma.employee.findFirst.mockResolvedValue(null)
    const res = await createTask({ title: 'Teklif', assigneeId: 'foreign' })
    expect(res).toEqual({ success: false, error: 'Görev oluşturulamadı' })
    expect(prisma.task.create).not.toHaveBeenCalled()
  })

  it('updates only tasks of the company', async () => {
    prisma.task.update.mockResolvedValue({ id: 't1' })
    await updateTask('t1', { title: 'Yeni' })
    expect(prisma.task.update.mock.calls[0][0].where).toEqual({ id: 't1', companyId: COMPANY })
  })

  it('scopes employee delete, instruction update/delete and conversations to the company', async () => {
    prisma.employee.delete.mockResolvedValue({})
    prisma.employeeInstruction.update.mockResolvedValue({})
    prisma.employeeInstruction.delete.mockResolvedValue({})
    prisma.conversation.findFirst.mockResolvedValue(null)
    await deleteEmployee('e1')
    await updateInstruction('i1', { active: false })
    await deleteInstruction('i1')
    await getConversation('c1')
    expect(prisma.employee.delete.mock.calls[0][0].where).toEqual({ id: 'e1', companyId: COMPANY })
    expect(prisma.employeeInstruction.update.mock.calls[0][0].where).toEqual({ id: 'i1', employee: { companyId: COMPANY } })
    expect(prisma.employeeInstruction.delete.mock.calls[0][0].where).toEqual({ id: 'i1', employee: { companyId: COMPANY } })
    expect(prisma.conversation.findFirst.mock.calls[0][0].where).toEqual({ id: 'c1', companyId: COMPANY })
  })

  it('does not let a new employee report to a manager from outside the company', async () => {
    prisma.employee.findFirst.mockResolvedValue(null)
    const res = await createEmployee({ name: 'A', title: 'B', department: 'C', managerId: 'foreign' })
    expect(res.success).toBe(false)
    expect(prisma.employee.create).not.toHaveBeenCalled()
  })

  it('does not start a chat with an employee outside the company', async () => {
    prisma.employee.findFirst.mockResolvedValue(null)
    const res = await sendMessage('foreign', 'merhaba')
    expect(res.success).toBe(false)
    expect(runConversation).not.toHaveBeenCalled()
  })

  it('passes the server-side company to the agent runtime', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'e1' })
    runConversation.mockResolvedValue({ conversationId: 'c1', response: 'ok' })
    await sendMessage('e1', 'merhaba', 'c1')
    expect(runConversation).toHaveBeenCalledWith('e1', COMPANY, 'merhaba', 'c1')
  })

  it('blocks review/retry/approval actions on records of another company', async () => {
    prisma.task.findFirst.mockResolvedValue(null)
    prisma.approval.findFirst.mockResolvedValue(null)
    expect((await reviewTask('t1', 'approve')).success).toBe(false)
    expect((await retryTask('t1')).success).toBe(false)
    expect((await resolveApproval('a1', true)).success).toBe(false)
    expect(work.reviewEmployeeTask).not.toHaveBeenCalled()
    expect(work.retryEmployeeTask).not.toHaveBeenCalled()
    expect(work.resolveEmployeeApproval).not.toHaveBeenCalled()
  })
})

describe('error handling', () => {
  it('logs the real error but returns a generic message', async () => {
    prisma.task.update.mockRejectedValue(Object.assign(new Error('Invalid `prisma.task.update()` invocation: secret table detail'), { code: 'P2025' }))
    const res = await updateTask('t1', { title: 'x' })
    expect(res).toEqual({ success: false, error: 'Görev güncellenemedi' })
    expect(console.error).toHaveBeenCalled()
    expect(JSON.stringify(res)).not.toContain('secret table detail')
  })

  it('shows deliberate domain messages but hides internals from review/retry', async () => {
    prisma.task.findFirst.mockResolvedValue({ id: 't1' })
    const { UserError } = await import('@/lib/action-log')
    work.reviewEmployeeTask.mockRejectedValueOnce(new UserError('Görev inceleme durumunda değil'))
    work.retryEmployeeTask.mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.0.1:5432'))
    expect(await reviewTask('t1', 'approve')).toEqual({ success: false, error: 'Görev inceleme durumunda değil' })
    expect(await retryTask('t1')).toEqual({ success: false, error: 'İşlem başarısız' })
  })
})

describe('deleteAllData', () => {
  it('requires the exact confirmation text and wipes nothing otherwise', async () => {
    const res = await deleteAllData('sil')
    expect(res).toEqual({ success: false, error: 'Onay metni hatalı' })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
