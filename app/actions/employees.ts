'use server'

import { prisma } from '@/lib/db'
import { createEmployeeSchema, updateEmployeeSchema } from '@/lib/schemas'
import { z } from 'zod'
import { requireAuth } from '@/lib/require-auth'
import { getCompanyId } from '@/lib/company'
import { logActionError } from '@/lib/action-log'

export async function getEmployees() {
  await requireAuth()
  try {
    const companyId = await getCompanyId()
    const employees = await prisma.employee.findMany({
      where: { companyId },
      include: {
        assignedTasks: {
          where: { status: { in: ['TODO', 'IN_PROGRESS'] } },
        },
        reports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    })

    return {
      success: true,
      data: employees,
    }
  } catch (e) {
    logActionError('getEmployees', e)
    return { success: false, error: 'Çalışanlar alınamadı' }
  }
}

export async function getEmployeeById(employeeId: string) {
  await requireAuth()
  try {
    const companyId = await getCompanyId()
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      include: {
        instructions: {
          orderBy: { priority: 'desc' },
        },
        assignedTasks: {
          orderBy: { dueDate: 'asc' },
        },
        reports: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        conversations: {
          orderBy: { updatedAt: 'desc' },
          take: 5,
        },
      },
    })

    if (!employee) {
      return {
        success: false,
        error: 'Çalışan bulunamadı',
      }
    }

    return {
      success: true,
      data: employee,
    }
  } catch (e) {
    logActionError('getEmployeeById', e)
    return { success: false, error: 'Çalışan detayları alınamadı' }
  }
}

export async function createEmployee(input: z.infer<typeof createEmployeeSchema>) {
  await requireAuth()
  try {
    const validated = createEmployeeSchema.parse(input)
    const companyId = await getCompanyId()

    const employee = await prisma.employee.create({
      data: {
        companyId,
        ...validated,
        permissions: JSON.stringify(['CAN_UPDATE_TASKS']),
      },
    })

    return {
      success: true,
      data: employee,
    }
  } catch (e) {
    logActionError('createEmployee', e)
    return { success: false, error: 'Çalışan oluşturulamadı' }
  }
}

export async function updateEmployee(employeeId: string, input: z.infer<typeof updateEmployeeSchema>) {
  await requireAuth()
  try {
    const validated = updateEmployeeSchema.parse(input)
    const companyId = await getCompanyId()

    const employee = await prisma.employee.update({
      where: { id: employeeId, companyId },
      data: validated,
    })

    return {
      success: true,
      data: employee,
    }
  } catch (e) {
    logActionError('updateEmployee', e)
    return { success: false, error: 'Çalışan güncellenemedi' }
  }
}

export async function searchEmployees(query: string, department?: string) {
  await requireAuth()
  try {
    const companyId = await getCompanyId()
    const employees = await prisma.employee.findMany({
      where: {
        companyId,
        department: department ? { equals: department } : undefined,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { title: { contains: query, mode: 'insensitive' } },
          { department: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 20,
    })

    return {
      success: true,
      data: employees,
    }
  } catch (e) {
    logActionError('searchEmployees', e)
    return { success: false, error: 'Arama başarısız' }
  }
}

export async function deleteEmployee(employeeId: string) {
  await requireAuth()
  try {
    const companyId = await getCompanyId()
    await prisma.employee.delete({ where: { id: employeeId, companyId } })
    return { success: true }
  } catch (e) {
    logActionError('deleteEmployee', e)
    return { success: false, error: 'Çalışan silinemedi' }
  }
}
