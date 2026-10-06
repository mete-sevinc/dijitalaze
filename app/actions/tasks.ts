'use server'

import { prisma } from '@/lib/db'
import { createTaskSchema, updateTaskSchema } from '@/lib/schemas'
import { z } from 'zod'
import { requireAuth } from '@/lib/require-auth'

export async function getTasks(companyId: string, filter?: { status?: string; assigneeId?: string }) {
  await requireAuth()
  try {
    const tasks = await prisma.task.findMany({
      where: {
        companyId,
        status: filter?.status ? (filter.status as import('@prisma/client').TaskStatus) : undefined,
        assigneeId: filter?.assigneeId,
      },
      include: {
        assignee: true,
        creator: true,
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    })

    return { success: true, data: tasks }
  } catch {
    return { success: false, error: 'Görevler alınamadı' }
  }
}

export async function createTask(companyId: string, input: z.infer<typeof createTaskSchema>) {
  await requireAuth()
  try {
    const validated = createTaskSchema.parse(input)
    const task = await prisma.task.create({
      data: {
        companyId,
        ...validated,
      },
      include: { assignee: true },
    })

    return { success: true, data: task }
  } catch {
    return { success: false, error: 'Görev oluşturulamadı' }
  }
}

export async function updateTask(taskId: string, input: z.infer<typeof updateTaskSchema>) {
  await requireAuth()
  try {
    const validated = updateTaskSchema.parse(input)
    const task = await prisma.task.update({
      where: { id: taskId },
      data: validated,
      include: { assignee: true },
    })

    return { success: true, data: task }
  } catch {
    return { success: false, error: 'Görev güncellenemedi' }
  }
}
