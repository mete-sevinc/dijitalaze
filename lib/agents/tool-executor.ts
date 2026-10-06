import { prisma } from '@/lib/db'
import { AgentContext, ToolResult } from '@/lib/types'
import {
  listTasksInputSchema,
  createTaskInputSchema,
  updateTaskInputSchema,
  searchMemoryInputSchema,
  addMemoryInputSchema,
  getCompanySummaryInputSchema,
} from '@/lib/schemas'
import { TaskStatus, ReportType } from '@prisma/client'

export async function executeToolAction(
  toolName: string,
  input: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case 'list_tasks':
        return await listTasks(context, input)
      case 'create_task':
        return await createTask(context, input)
      case 'update_task':
        return await updateTask(context, input)
      case 'search_employee_memory':
        return await searchEmployeeMemory(context, input)
      case 'add_employee_memory':
        return await addEmployeeMemory(context, input)
      case 'get_company_summary':
        return await getCompanySummary(context, input)
      case 'get_employee_report':
        return await getEmployeeReport(context, input)
      case 'create_meeting_action':
        return await createMeetingAction(context, input)
      default:
        return {
          toolName,
          result: null,
          error: `Unknown tool: ${toolName}`,
        }
    }
  } catch (error) {
    return {
      toolName,
      result: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

async function listTasks(context: AgentContext, input: Record<string, unknown>): Promise<ToolResult> {
  const parsed = listTasksInputSchema.parse(input)

  const tasks = await prisma.task.findMany({
    where: {
      assigneeId: context.employeeId,
      status: parsed.status ? (parsed.status as TaskStatus) : undefined,
    },
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    take: parsed.limit || 10,
  })

  return {
    toolName: 'list_tasks',
    result: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate?.toISOString(),
    })),
  }
}

async function createTask(context: AgentContext, input: Record<string, unknown>): Promise<ToolResult> {
  if (!context.permissions.includes('CAN_CREATE_TASKS') && !context.permissions.includes('ALL')) {
    return {
      toolName: 'create_task',
      result: null,
      error: 'Permission denied: CAN_CREATE_TASKS required',
    }
  }

  const parsed = createTaskInputSchema.parse(input)

  const task = await prisma.task.create({
    data: {
      companyId: context.employeeId.split('_')[0],
      title: parsed.title,
      description: parsed.description,
      assigneeId: input.assigneeId as string | undefined,
      creatorId: context.employeeId,
      priority: parsed.priority || 'MEDIUM',
      dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined,
      status: 'TODO',
    },
  })

  await prisma.auditLog.create({
    data: {
      companyId: context.employeeId.split('_')[0],
      action: 'TASK_CREATED',
      entityType: 'Task',
      entityId: task.id,
      userId: context.employeeId,
      changes: JSON.stringify(parsed),
    },
  })

  return {
    toolName: 'create_task',
    result: {
      id: task.id,
      title: task.title,
      status: task.status,
    },
  }
}

async function updateTask(context: AgentContext, input: Record<string, unknown>): Promise<ToolResult> {
  const parsed = updateTaskInputSchema.parse(input)
  const taskId = input.taskId as string

  const task = await prisma.task.findUnique({
    where: { id: taskId },
  })

  if (!task) {
    return {
      toolName: 'update_task',
      result: null,
      error: 'Task not found',
    }
  }

  const canUpdate =
    context.employeeId === task.assigneeId ||
    context.permissions.includes('CAN_UPDATE_TASKS') ||
    context.permissions.includes('ALL')

  if (!canUpdate) {
    return {
      toolName: 'update_task',
      result: null,
      error: 'Permission denied: Can only update own tasks or need CAN_UPDATE_TASKS',
    }
  }

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: parsed.status as TaskStatus | undefined,
      priority: parsed.priority,
      description: parsed.description,
    },
  })

  await prisma.auditLog.create({
    data: {
      companyId: task.companyId,
      action: 'TASK_UPDATED',
      entityType: 'Task',
      entityId: taskId,
      userId: context.employeeId,
      changes: JSON.stringify(parsed),
    },
  })

  return {
    toolName: 'update_task',
    result: {
      id: updatedTask.id,
      status: updatedTask.status,
      priority: updatedTask.priority,
    },
  }
}

async function searchEmployeeMemory(context: AgentContext, input: Record<string, unknown>): Promise<ToolResult> {
  const parsed = searchMemoryInputSchema.parse(input)

  const memories = await prisma.employeeMemory.findMany({
    where: {
      employeeId: context.employeeId,
      OR: [
        { content: { contains: parsed.query } },
        { tags: { contains: parsed.query } },
      ],
    },
    orderBy: { importance: 'desc' },
    take: parsed.limit || 10,
  })

  return {
    toolName: 'search_employee_memory',
    result: memories.map((m) => ({
      id: m.id,
      content: m.content,
      type: m.type,
      importance: m.importance,
      tags: m.tags ? JSON.parse(m.tags) : [],
    })),
  }
}

async function addEmployeeMemory(context: AgentContext, input: Record<string, unknown>): Promise<ToolResult> {
  const parsed = addMemoryInputSchema.parse(input)

  const memory = await prisma.employeeMemory.create({
    data: {
      employeeId: context.employeeId,
      content: parsed.content,
      type: parsed.type,
      importance: parsed.importance || 2,
      tags: parsed.tags ? JSON.stringify(parsed.tags) : null,
      source: 'AI_GENERATED',
    },
  })

  return {
    toolName: 'add_employee_memory',
    result: {
      id: memory.id,
      content: memory.content,
      type: memory.type,
    },
  }
}

async function getCompanySummary(context: AgentContext, input: Record<string, unknown>): Promise<ToolResult> {
  const parsed = getCompanySummaryInputSchema.parse(input)
  const companyId = context.employeeId.split('_')[0]

  const company = await prisma.company.findUnique({ where: { id: companyId } })
  const employeeCount = await prisma.employee.count({ where: { companyId } })
  const taskStats = await prisma.task.groupBy({
    by: ['status'],
    where: { companyId },
    _count: true,
  })

  const summary: { company?: string; totalEmployees: number; taskStats: Record<string, number>; risks?: string[] } = {
    company: company?.name,
    totalEmployees: employeeCount,
    taskStats: taskStats.reduce((acc: Record<string, number>, s) => ({ ...acc, [s.status]: s._count }), {}),
  }

  if (parsed.includeRisks) {
    const risks = await prisma.task.findMany({
      where: { companyId, status: 'BLOCKED' },
      take: 5,
    })
    summary.risks = risks.map((r) => r.title)
  }

  return {
    toolName: 'get_company_summary',
    result: summary,
  }
}

async function getEmployeeReport(context: AgentContext, input: Record<string, unknown>): Promise<ToolResult> {
  const employeeId = input.employeeId as string
  const type = input.type as ReportType

  const report = await prisma.employeeReport.findFirst({
    where: { employeeId, type },
    orderBy: { createdAt: 'desc' },
  })

  if (!report) {
    return {
      toolName: 'get_employee_report',
      result: null,
      error: 'No report found',
    }
  }

  return {
    toolName: 'get_employee_report',
    result: {
      id: report.id,
      type: report.type,
      summary: report.summary,
      createdAt: report.createdAt,
    },
  }
}

async function createMeetingAction(context: AgentContext, input: Record<string, unknown>): Promise<ToolResult> {
  const meetingId = input.meetingId as string
  const content = input.content as string
  const assigneeId = input.assigneeId as string | undefined

  const actionItem = await prisma.meetingActionItem.create({
    data: {
      meetingId,
      content,
      assigneeId,
      status: assigneeId ? 'ASSIGNED' : 'OPEN',
    },
  })

  if (assigneeId) {
    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } })
    if (meeting) {
      await prisma.task.create({
        data: {
          companyId: meeting.companyId,
          title: content,
          description: `Action item from meeting: ${meeting.title}`,
          assigneeId,
          creatorId: context.employeeId,
          status: 'TODO',
          priority: 'HIGH',
        },
      })
    }
  }

  return {
    toolName: 'create_meeting_action',
    result: {
      id: actionItem.id,
      content: actionItem.content,
      status: actionItem.status,
    },
  }
}
