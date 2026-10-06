'use server'

import { prisma } from '@/lib/db'
import { createEmployeeSchema, updateEmployeeSchema } from '@/lib/schemas'
import { z } from 'zod'
import { requireAuth } from '@/lib/require-auth'

export async function getEmployees(companyId: string) {
  await requireAuth()
  try {
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
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Çalışanlar alınamadı',
    }
  }
}

export async function getEmployeeById(employeeId: string) {
  await requireAuth()
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
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
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Çalışan detayları alınamadı',
    }
  }
}

export async function createEmployee(companyId: string, input: z.infer<typeof createEmployeeSchema>) {
  await requireAuth()
  try {
    const validated = createEmployeeSchema.parse(input)

    const employee = await prisma.employee.create({
      data: {
        companyId,
        ...validated,
      },
    })

    return {
      success: true,
      data: employee,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Çalışan oluşturulamadı',
    }
  }
}

export async function updateEmployee(employeeId: string, input: z.infer<typeof updateEmployeeSchema>) {
  await requireAuth()
  try {
    const validated = updateEmployeeSchema.parse(input)

    const employee = await prisma.employee.update({
      where: { id: employeeId },
      data: validated,
    })

    return {
      success: true,
      data: employee,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Çalışan güncellenemedi',
    }
  }
}

export async function searchEmployees(companyId: string, query: string, department?: string) {
  await requireAuth()
  try {
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
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Arama başarısız',
    }
  }
}
