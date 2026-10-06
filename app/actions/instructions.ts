'use server'

import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'

export async function getInstructions(employeeId: string) {
  await requireAuth()
  try {
    const instructions = await prisma.employeeInstruction.findMany({
      where: { employeeId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    })
    return { success: true, data: instructions }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Talimatlar alınamadı' }
  }
}

export async function createInstruction(employeeId: string, content: string, priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' = 'NORMAL') {
  await requireAuth()
  try {
    const instruction = await prisma.employeeInstruction.create({
      data: { employeeId, content, priority, active: true },
    })
    return { success: true, data: instruction }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Talimat oluşturulamadı' }
  }
}

export async function updateInstruction(id: string, data: { content?: string; priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'; active?: boolean }) {
  await requireAuth()
  try {
    const instruction = await prisma.employeeInstruction.update({
      where: { id },
      data,
    })
    return { success: true, data: instruction }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Talimat güncellenemedi' }
  }
}

export async function deleteInstruction(id: string) {
  await requireAuth()
  try {
    await prisma.employeeInstruction.delete({ where: { id } })
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Talimat silinemedi' }
  }
}
