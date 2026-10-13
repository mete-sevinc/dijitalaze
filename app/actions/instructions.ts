'use server'

import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'
import { assertEmployeeInCompany, getCompanyId } from '@/lib/company'
import { logActionError } from '@/lib/action-log'

type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'

export async function getInstructions(employeeId: string) {
  await requireAuth()
  try {
    const companyId = await getCompanyId()
    await assertEmployeeInCompany(employeeId, companyId)
    const instructions = await prisma.employeeInstruction.findMany({
      where: { employeeId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    })
    return { success: true, data: instructions }
  } catch (e) {
    logActionError('getInstructions', e)
    return { success: false, error: 'Talimatlar alınamadı' }
  }
}

export async function createInstruction(employeeId: string, content: string, priority: Priority = 'NORMAL') {
  await requireAuth()
  try {
    const companyId = await getCompanyId()
    await assertEmployeeInCompany(employeeId, companyId)
    const instruction = await prisma.employeeInstruction.create({
      data: { employeeId, content, priority, active: true },
    })
    return { success: true, data: instruction }
  } catch (e) {
    logActionError('createInstruction', e)
    return { success: false, error: 'Talimat oluşturulamadı' }
  }
}

export async function updateInstruction(id: string, data: { content?: string; priority?: Priority; active?: boolean }) {
  await requireAuth()
  try {
    const companyId = await getCompanyId()
    const instruction = await prisma.employeeInstruction.update({
      where: { id, employee: { companyId } },
      data,
    })
    return { success: true, data: instruction }
  } catch (e) {
    logActionError('updateInstruction', e)
    return { success: false, error: 'Talimat güncellenemedi' }
  }
}

export async function deleteInstruction(id: string) {
  await requireAuth()
  try {
    const companyId = await getCompanyId()
    await prisma.employeeInstruction.delete({ where: { id, employee: { companyId } } })
    return { success: true }
  } catch (e) {
    logActionError('deleteInstruction', e)
    return { success: false, error: 'Talimat silinemedi' }
  }
}
