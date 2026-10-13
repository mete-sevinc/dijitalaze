'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'
import { assertEmployeeInCompany, getCompanyId } from '@/lib/company'
import { logActionError, UserError, userMessage } from '@/lib/action-log'
import { assignTaskToEmployee, resolveEmployeeApproval, retryEmployeeTask, reviewEmployeeTask } from '@/lib/agents/work'

const idSchema = z.string().min(1).max(64)
const textSchema = z.string().trim().min(1).max(4000)

async function assertTaskInCompany(taskId: string) {
  const task = await prisma.task.findFirst({ where: { id: taskId, companyId: await getCompanyId() }, select: { id: true } })
  if (!task) throw new UserError('Görev bulunamadı')
}

export async function assignTask(employeeId: string, title: string, description?: string) {
  await requireAuth()
  const parsed = z
    .object({ employeeId: idSchema, title: z.string().trim().min(1).max(300), description: z.string().max(4000).optional() })
    .safeParse({ employeeId, title, description })
  if (!parsed.success) return { success: false as const, error: 'Geçersiz bilgi' }
  try {
    await assertEmployeeInCompany(parsed.data.employeeId, await getCompanyId())
    const taskId = await assignTaskToEmployee(parsed.data)
    return { success: true as const, taskId }
  } catch (e) {
    logActionError('assignTask', e)
    return { success: false as const, error: 'İş verilemedi' }
  }
}

export async function reviewTask(taskId: string, decision: 'approve' | 'revise', note?: string) {
  await requireAuth()
  const parsed = z
    .object({ taskId: idSchema, decision: z.enum(['approve', 'revise']), note: z.string().max(2000).optional() })
    .safeParse({ taskId, decision, note })
  if (!parsed.success) return { success: false as const, error: 'Geçersiz bilgi' }
  try {
    await assertTaskInCompany(parsed.data.taskId)
    await reviewEmployeeTask(parsed.data.taskId, parsed.data.decision, parsed.data.note)
    return { success: true as const }
  } catch (e) {
    logActionError('reviewTask', e)
    return { success: false as const, error: userMessage(e, 'İşlem başarısız') }
  }
}

export async function getPendingApprovals() {
  await requireAuth()
  const rows = await prisma.approval.findMany({
    where: { status: 'PENDING', companyId: await getCompanyId() },
    include: { employee: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return rows.map((a) => ({
    id: a.id,
    employeeName: a.employee.name,
    action: a.action,
    payload: a.payload,
    reason: a.reason,
    createdAt: a.createdAt.toISOString(),
  }))
}

export async function resolveApproval(approvalId: string, approve: boolean, note?: string) {
  await requireAuth()
  const parsed = z.object({ id: idSchema, note: textSchema.optional() }).safeParse({ id: approvalId, note: note || undefined })
  if (!parsed.success) return { success: false as const, error: 'Geçersiz bilgi' }
  try {
    const found = await prisma.approval.findFirst({ where: { id: parsed.data.id, companyId: await getCompanyId() }, select: { id: true } })
    if (!found) throw new UserError('Onay kaydı bulunamadı')
    await resolveEmployeeApproval(parsed.data.id, approve, parsed.data.note)
    return { success: true as const }
  } catch (e) {
    logActionError('resolveApproval', e)
    return { success: false as const, error: userMessage(e, 'İşlem başarısız') }
  }
}

export async function retryTask(taskId: string) {
  await requireAuth()
  const parsed = idSchema.safeParse(taskId)
  if (!parsed.success) return { success: false as const, error: 'Geçersiz bilgi' }
  try {
    await assertTaskInCompany(parsed.data)
    await retryEmployeeTask(parsed.data)
    return { success: true as const }
  } catch (e) {
    logActionError('retryTask', e)
    return { success: false as const, error: userMessage(e, 'İşlem başarısız') }
  }
}
