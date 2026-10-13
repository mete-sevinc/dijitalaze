'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'
import { assertEmployeeInCompany, getCompanyId } from '@/lib/company'
import { logActionError } from '@/lib/action-log'
import { buildReport, periodFor, type ReportType } from '@/lib/reports'

const typeSchema = z.enum(['DAILY', 'WEEKLY', 'MONTHLY'])

export async function getReports(type?: ReportType) {
  await requireAuth()
  try {
    const companyId = await getCompanyId()
    const reports = await prisma.employeeReport.findMany({
      where: { companyId, type: type ? typeSchema.parse(type) : undefined },
      include: { employee: { select: { name: true, title: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return { success: true as const, data: reports }
  } catch (e) {
    logActionError('getReports', e)
    return { success: false as const, error: 'Raporlar alınamadı' }
  }
}

// Builds a report from the employee's tasks. Without employeeId, one report per active employee.
export async function generateReports(type: ReportType, employeeId?: string) {
  await requireAuth()
  try {
    const kind = typeSchema.parse(type)
    const companyId = await getCompanyId()
    if (employeeId) await assertEmployeeInCompany(employeeId, companyId)

    const employees = await prisma.employee.findMany({
      where: employeeId ? { id: employeeId, companyId } : { companyId, status: 'ACTIVE' },
      select: { id: true },
    })
    const now = new Date()
    const { start, end } = periodFor(kind, now)

    const rows = await Promise.all(
      employees.map(async ({ id }) => {
        const tasks = await prisma.task.findMany({
          where: { companyId, assigneeId: id },
          select: { title: true, status: true, priority: true, dueDate: true, completedAt: true, updatedAt: true },
        })
        const r = buildReport(tasks, kind, now)
        return {
          employeeId: id,
          companyId,
          type: kind,
          periodStart: start,
          periodEnd: end,
          summary: r.summary,
          completedTasks: JSON.stringify(r.completedTasks),
          activeTasks: JSON.stringify(r.activeTasks),
          blockedTasks: JSON.stringify(r.blockedTasks),
          risks: JSON.stringify(r.risks),
          recommendations: JSON.stringify(r.recommendations),
          nextPriorities: JSON.stringify(r.nextPriorities),
        }
      }),
    )
    const created = await prisma.employeeReport.createMany({ data: rows })
    return { success: true as const, count: created.count }
  } catch (e) {
    logActionError('generateReports', e)
    return { success: false as const, error: 'Rapor oluşturulamadı' }
  }
}
