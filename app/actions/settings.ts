'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'

const companySchema = z.object({
  name: z.string().trim().min(1, 'Firma adı gerekli').max(200),
  description: z.string().trim().max(2000).optional(),
})

// Single-tenant app: the one company row is the active company.
async function getCompanyRow() {
  return prisma.company.findFirst({ orderBy: { createdAt: 'asc' } })
}

function fail(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) return { success: false as const, error: error.issues[0].message }
  return { success: false as const, error: error instanceof Error ? error.message : fallback }
}

export async function getSettings() {
  await requireAuth()
  try {
    const company = await getCompanyRow()
    // Login access comes from auth (Entra + AUTH_ALLOWED_EMAIL), not the DB.
    const allowedEmails = (process.env.AUTH_ALLOWED_EMAIL ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
    return { success: true as const, data: { company, allowedEmails } }
  } catch (error) {
    return fail(error, 'Ayarlar alınamadı')
  }
}

export async function updateCompanyInfo(input: { name: string; description?: string }) {
  await requireAuth()
  try {
    const data = companySchema.parse(input)
    const company = await getCompanyRow()
    if (!company) return { success: false as const, error: 'Firma bulunamadı' }
    const updated = await prisma.company.update({
      where: { id: company.id },
      data: { name: data.name, description: data.description || null },
    })
    return { success: true as const, data: updated }
  } catch (error) {
    return fail(error, 'Firma bilgileri güncellenemedi')
  }
}

// Wipes all business data (employees and, via cascade, their conversations/messages,
// tasks, reports, meetings, memory, approvals, audit logs). Keeps company row and users.
export async function deleteAllData(confirmation: string) {
  await requireAuth()
  try {
    if (confirmation !== 'SİL') return { success: false as const, error: 'Onay metni hatalı' }
    const company = await getCompanyRow()
    if (!company) return { success: true as const }
    const where = { companyId: company.id }
    await prisma.$transaction([
      prisma.conversation.deleteMany({ where }),
      prisma.task.deleteMany({ where }),
      prisma.employeeReport.deleteMany({ where }),
      prisma.meeting.deleteMany({ where }),
      prisma.companyMemory.deleteMany({ where }),
      prisma.approval.deleteMany({ where }),
      prisma.auditLog.deleteMany({ where }),
      prisma.employee.deleteMany({ where }),
    ])
    return { success: true as const }
  } catch (error) {
    return fail(error, 'Veriler silinemedi')
  }
}
