import { after } from 'next/server'
import { MemoryType } from '@prisma/client'
import { prisma } from '@/lib/db'
import { runAgent } from '@/lib/ai/agent-loop'
import { AgentContext } from '@/lib/types'
import { agentTools, GATED_TOOLS } from './tools'
import { contextBuilder } from './context-builder'
import { executeToolAction } from './tool-executor'
import { UserError } from '@/lib/action-log'
import { assertWithinBudget, createUsageTracker } from '@/lib/ai/usage'

const MUTATING_TOOLS = new Set(['update_task', 'add_employee_memory'])

// Personel ajanı için araç çalıştırıcı: onay gerektiren araçlar Approval kaydına dönüşür.
export function buildEmployeeRunner(ctx: AgentContext, companyId: string) {
  let mutated = false
  const run = async (name: string, args: unknown): Promise<unknown> => {
    if (GATED_TOOLS.has(name)) {
      const approval = await prisma.approval.create({
        data: {
          companyId,
          employeeId: ctx.employeeId,
          action: name,
          payload: JSON.stringify(args ?? {}),
          reason: `${ctx.employeeName} bu işlemi yapmak istiyor`,
        },
      })
      mutated = true
      return { status: 'pending_approval', approvalId: approval.id, message: 'Onay bekliyor; sahibi onaylayınca uygulanacak.' }
    }
    const r = await executeToolAction(name, (args ?? {}) as Record<string, unknown>, ctx)
    if (r.error) throw new Error(r.error)
    if (MUTATING_TOOLS.has(name)) mutated = true
    return r.result
  }
  return { run, hasSideEffects: () => mutated }
}

export async function runEmployeeOnTask(taskId: string): Promise<void> {
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } })
  if (!task.assigneeId) throw new UserError('Göreve çalışan atanmamış')
  await prisma.task.update({ where: { id: taskId }, data: { status: 'IN_PROGRESS' } })

  const usage = createUsageTracker(task.assigneeId)
  try {
    await assertWithinBudget(task.assigneeId)
    const ctx = await contextBuilder.buildContext(task.assigneeId, task.companyId)
    const { run, hasSideEffects } = buildEmployeeRunner(ctx, task.companyId)
    const feedback = task.reviewNote
      ? `\n\nÖnceki teslimin:\n${task.result ?? '(yok)'}\n\nSahibinin düzeltme isteği: ${task.reviewNote}\nBu geri bildirimi dikkate alarak işi yeniden yap.`
      : ''
    const result = await runAgent({
      system: `${contextBuilder.buildSystemPrompt(ctx)}

## Şu anki görev
Sahibin sana bir iş verdi. Gerekirse araçları kullan, sonra teslim edeceğin çıktıyı (rapor, taslak, plan, cevap) açık ve eksiksiz yaz. Nihai yanıtın doğrudan teslim edilecek metindir; "yaptım" gibi özet değil, işin kendisini ver. Bilmediğin bir bilgiyi uydurma, eksikse neyin eksik olduğunu belirt.`,
      history: [],
      userText: `Görev: ${task.title}\n${task.description ?? ''}${feedback}`,
      tools: agentTools,
      run,
      hasSideEffects,
      onUsage: usage.add,
    })
    await prisma.task.update({
      where: { id: taskId },
      data: { result: result.trim() || 'Çıktı üretilemedi.', status: 'REVIEW', reviewNote: null },
    })
  } catch (e) {
    console.error('employee task run failed', e)
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'BLOCKED', result: `Çalıştırılamadı: ${e instanceof Error ? e.message.slice(0, 400) : 'bilinmeyen hata'}` },
    })
  } finally {
    await usage.flush()
  }
}

export async function assignTaskToEmployee(input: {
  employeeId: string
  title: string
  description?: string
  dueDate?: Date
}) {
  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: input.employeeId } })
  const task = await prisma.task.create({
    data: {
      companyId: employee.companyId,
      title: input.title,
      description: input.description,
      assigneeId: employee.id,
      dueDate: input.dueDate,
      status: 'TODO',
      priority: 'MEDIUM',
      source: 'OWNER',
    },
  })
  await prisma.auditLog.create({
    data: { companyId: employee.companyId, action: 'TASK_ASSIGNED', entityType: 'Task', entityId: task.id, changes: JSON.stringify(input) },
  })
  // Yanıtı geciktirmeden arka planda çalıştır; sonuç Görevler sayfasında incelemeye düşer.
  after(() => runEmployeeOnTask(task.id))
  return task.id
}

async function remember(employeeId: string, content: string, importance: number) {
  await prisma.employeeMemory.create({
    data: { employeeId, content: content.slice(0, 1500), type: MemoryType.LESSON, importance, source: 'REVIEW' },
  })
}

// Sahibin incelemesi: onay → öğrenilen ders kaydedilir; düzeltme → ders + yeniden çalıştırma.
export async function reviewEmployeeTask(taskId: string, decision: 'approve' | 'revise', note?: string) {
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } })
  if (task.status !== 'REVIEW' || !task.assigneeId) throw new UserError('Görev inceleme durumunda değil')
  const n = note?.trim()

  if (decision === 'approve') {
    const claimed = await prisma.task.updateMany({
      where: { id: taskId, status: 'REVIEW' },
      data: { status: 'DONE', completedAt: new Date(), reviewNote: n || null },
    })
    if (claimed.count === 0) return
    await remember(
      task.assigneeId,
      `"${task.title}" görevinde teslim edilen çıktı onaylandı.${n ? ` Sahibin notu: ${n}.` : ''} Örnek çıktı: ${(task.result ?? '').slice(0, 600)}`,
      2
    )
    return
  }

  if (!n) throw new UserError('Düzeltme için not gerekli')
  const claimed = await prisma.task.updateMany({
    where: { id: taskId, status: 'REVIEW' },
    data: { status: 'TODO', reviewNote: n },
  })
  if (claimed.count === 0) return
  await remember(task.assigneeId, `"${task.title}" görevinde düzeltme istendi: ${n}`, 3)
  after(() => runEmployeeOnTask(taskId))
}

export async function resolveEmployeeApproval(approvalId: string, approve: boolean, note?: string) {
  const approval = await prisma.approval.findUniqueOrThrow({ where: { id: approvalId } })
  const claimed = await prisma.approval.updateMany({
    where: { id: approvalId, status: 'PENDING' },
    data: { status: approve ? 'APPROVED' : 'REJECTED', resolvedAt: new Date() },
  })
  if (claimed.count === 0) throw new UserError('Bu onay zaten sonuçlanmış')

  const payload = approval.payload ? (JSON.parse(approval.payload) as Record<string, unknown>) : {}
  if (approve) {
    const ctx = await contextBuilder.buildContext(approval.employeeId, approval.companyId)
    // İnsan onayı yetkiyi verir.
    const elevated: AgentContext = { ...ctx, permissions: [...ctx.permissions, 'CAN_CREATE_TASKS', 'CAN_UPDATE_TASKS'] }
    const r = await executeToolAction(approval.action, payload, elevated)
    if (r.error) throw new Error(r.error)
  } else if (note?.trim()) {
    await remember(approval.employeeId, `Reddedilen eylem (${approval.action}): ${approval.payload}. Neden: ${note.trim()}`, 3)
  }
  await prisma.auditLog.create({
    data: {
      companyId: approval.companyId,
      action: approve ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED',
      entityType: 'Approval',
      entityId: approvalId,
      changes: JSON.stringify({ action: approval.action, note }),
    },
  })
}

export async function retryEmployeeTask(taskId: string) {
  const claimed = await prisma.task.updateMany({
    where: { id: taskId, status: 'BLOCKED', assigneeId: { not: null } },
    data: { status: 'TODO', result: null },
  })
  if (claimed.count === 0) throw new UserError('Görev tekrar denenemez')
  after(() => runEmployeeOnTask(taskId))
}
