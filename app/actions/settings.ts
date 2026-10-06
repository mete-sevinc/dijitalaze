'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'
import { getActiveCompany } from '@/lib/active-company'

const companySchema = z.object({
  name: z.string().trim().min(1, 'Firma adı gerekli').max(200),
  description: z.string().trim().max(2000).optional(),
})

const userSchema = z.object({
  email: z.string().trim().toLowerCase().email('Geçerli bir e-posta girin'),
  name: z.string().trim().max(200).optional(),
})

const getCompanyRow = getActiveCompany

function fail(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) return { success: false as const, error: error.issues[0].message }
  return { success: false as const, error: error instanceof Error ? error.message : fallback }
}

export async function getSettings() {
  await requireAuth()
  try {
    const company = await getCompanyRow()
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } })
    return { success: true as const, data: { company, users } }
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

export async function addUser(input: { email: string; name?: string }) {
  await requireAuth()
  try {
    const data = userSchema.parse(input)
    const company = await getCompanyRow()
    const user = await prisma.user.create({
      data: { email: data.email, name: data.name || null, companyId: company?.id },
    })
    return { success: true as const, data: user }
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
      return { success: false as const, error: 'Bu e-posta zaten kayıtlı' }
    }
    return fail(error, 'Kullanıcı eklenemedi')
  }
}

export async function removeUser(id: string) {
  await requireAuth()
  try {
    await prisma.user.delete({ where: { id } })
    return { success: true as const }
  } catch (error) {
    return fail(error, 'Kullanıcı silinemedi')
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
