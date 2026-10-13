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

// Her araç çağrısı (başarılı/başarısız) denetim izine yazılır. Girdi değerleri kaydedilmez, yalnızca alan adları.
export async function executeToolAction(
  toolName: string,
  input: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  const result = await dispatchTool(toolName, input, context)
  try {
    const employee = await prisma.employee.findUnique({ where: { id: context.employeeId }, select: { companyId: true } })
    if (employee) {
      await prisma.auditLog.create({
        data: {
          companyId: employee.companyId,
          action: 'TOOL_CALL',
          entityType: 'Tool',
          entityId: toolName,
          userId: context.employeeId,
          changes: JSON.stringify({ ok: !result.error, error: result.error?.slice(0, 200), fields: Object.keys(input) }),
        },
      })
    }
  } catch (e) {
    console.error('tool audit yazılamadı', e instanceof Error ? e.message : e)
  }
  return result
}

async function dispatchTool(
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

async function getCompanyId(employeeId: string): Promise<string> {
  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { companyId: true } })
  return employee.companyId
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

  const companyId = await getCompanyId(context.employeeId)

  const task = await prisma.task.create({
    data: {
      companyId,
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
      companyId,
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

  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId: await getCompanyId(context.employeeId) },
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
  const companyId = await getCompanyId(context.employeeId)

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
    where: { employeeId, type, companyId: await getCompanyId(context.employeeId) },
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
  const meetingId = String(input.meetingId ?? '')
  const content = String(input.content ?? '').trim().slice(0, 500)
  const assigneeId = input.assigneeId ? String(input.assigneeId) : undefined
  const fail = (error: string): ToolResult => ({ toolName: 'create_meeting_action', result: null, error })
  if (!meetingId || !content) return fail('meetingId and content are required')

  if (assigneeId && !context.permissions.includes('CAN_CREATE_TASKS') && !context.permissions.includes('ALL')) {
    return fail('Permission denied: CAN_CREATE_TASKS required')
  }
  // The model supplies these ids: both must belong to the acting employee's company.
  const companyId = await getCompanyId(context.employeeId)
  const meeting = await prisma.meeting.findFirst({ where: { id: meetingId, companyId }, select: { id: true, title: true, status: true } })
  if (!meeting) return fail('Meeting not found')
  if (meeting.status === 'COMPLETED' || meeting.status === 'CANCELLED') return fail('Meeting is closed')
  if (assigneeId && !(await prisma.employee.findFirst({ where: { id: assigneeId, companyId }, select: { id: true } }))) {
    return fail('Assignee not found')
  }

  const actionItem = await prisma.$transaction(async (tx) => {
    const task = assigneeId
      ? await tx.task.create({
          data: {
            companyId,
            title: content,
            description: `Toplantı aksiyonu: ${meeting.title}`,
            assigneeId,
            creatorId: context.employeeId,
            status: 'TODO',
            priority: 'HIGH',
            source: `meeting:${meeting.id}`,
          },
          select: { id: true },
        })
      : null
    return tx.meetingActionItem.create({
      data: { meetingId: meeting.id, content, assigneeId, taskId: task?.id, status: assigneeId ? 'ASSIGNED' : 'OPEN' },
    })
  })

  return {
    toolName: 'create_meeting_action',
    result: { id: actionItem.id, content: actionItem.content, status: actionItem.status },
  }
}
