'use server'

import { prisma } from '@/lib/db'
import { agentRuntime } from '@/lib/agents/runtime'
import { requireAuth } from '@/lib/require-auth'
import { getCompanyId } from '@/lib/company'
import { logActionError } from '@/lib/action-log'

export async function getDashboardSummary() {
  await requireAuth()
  try {
    const companyId = await getCompanyId()
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    })

    const employees = await prisma.employee.count({
      where: { companyId, status: 'ACTIVE' },
    })

    const taskStats = await prisma.task.groupBy({
      by: ['status'],
      where: { companyId },
      _count: true,
    })

    const overdueTasks = await prisma.task.count({
      where: {
        companyId,
        status: { in: ['TODO', 'IN_PROGRESS'] },
        dueDate: { lt: new Date() },
      },
    })

    const meetings = await prisma.meeting.count({
      where: { companyId, status: 'ACTIVE' },
    })

    const risks = await prisma.task.count({
      where: { companyId, status: 'BLOCKED' },
    })

    return {
      success: true,
      data: {
        company,
        employees,
        taskStats: taskStats.reduce((acc: Record<string, number>, s: { status: string; _count: number }) => ({ ...acc, [s.status]: s._count }), {}),
        overdueTasks,
        meetings,
        risks,
      },
    }
  } catch (e) {
    logActionError('getDashboardSummary', e)
    return { success: false, error: 'Özet alınamadı' }
  }
}

export async function generateDailyBriefing() {
  await requireAuth()
  try {
    const companyId = await getCompanyId()
    const briefing = await agentRuntime.generateDailyBriefing(companyId)
    return { success: true, data: briefing }
  } catch (error) {
    logActionError('generateDailyBriefing', error)
    return { success: false, error: 'Günlük özet oluşturulamadı' }
  }
}
