import { prisma } from '@/lib/db'
import { AgentContext, MemoryEntry, TaskSummary, ReportSummary, CompanyContextData, AIMessage } from '@/lib/types'

export class AgentContextBuilder {
  async buildContext(
    employeeId: string,
    companyId: string,
    conversationHistory: AIMessage[] = [],
    meetingContext?: { meetingId: string; title: string; agenda?: string; participants: string[]; previousMessages: AIMessage[] }
  ): Promise<AgentContext> {
    // Get employee
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        instructions: {
          where: { active: true },
          orderBy: { priority: 'desc' },
        },
      },
    })

    if (!employee) {
      throw new Error(`Employee not found: ${employeeId}`)
    }

    // Get relevant memory
    const relevantMemory = await this.getRelevantMemory(employeeId)

    // Get current tasks
    const currentTasks = await this.getCurrentTasks(employeeId)

    // Get recent reports
    const recentReports = await this.getRecentReports(employeeId)

    // Get company context
    const companyContext = await this.getCompanyContext(companyId)

    // Build context
    const context: AgentContext = {
      employeeId,
      employeeName: employee.name,
      employeeTitle: employee.title,
      employeeDepartment: employee.department,
      systemRole: employee.systemRole || '',
      responsibilities: employee.responsibilities || '',
      objectives: employee.objectives || '',
      kpis: employee.kpis || '',
      dailyRoutine: employee.dailyRoutine || '',
      weeklyRoutine: employee.weeklyRoutine || '',
      communicationStyle: employee.communicationStyle || '',
      decisionRules: employee.decisionRules || '',
      escalationRules: employee.escalationRules || '',
      permissions: employee.permissions ? JSON.parse(employee.permissions) : ([] as string[]),
      instructions: employee.instructions.map((i: { content: string }) => i.content),
      relevantMemory,
      currentTasks,
      recentReports,
      companyContext,
      conversationHistory,
      meetingContext: meetingContext
        ? {
            meetingId: meetingContext.meetingId,
            title: meetingContext.title,
            agenda: meetingContext.agenda,
            participants: meetingContext.participants,
            previousMessages: meetingContext.previousMessages,
          }
        : undefined,
    }

    return context
  }

  private async getRelevantMemory(employeeId: string): Promise<MemoryEntry[]> {
    const memories = await prisma.employeeMemory.findMany({
      where: { employeeId },
      orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    })

    return memories.map((m) => ({
      content: m.content,
      type: m.type,
      importance: m.importance,
      source: m.source || undefined,
      tags: m.tags ? JSON.parse(m.tags) : ([] as string[]),
      createdAt: m.createdAt,
    }))
  }

  private async getCurrentTasks(employeeId: string): Promise<TaskSummary[]> {
    const tasks = await prisma.task.findMany({
      where: {
        assigneeId: employeeId,
        status: {
          in: ['TODO', 'IN_PROGRESS', 'BLOCKED', 'REVIEW'],
        },
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
      ],
      take: 10,
      include: {
        assignee: true,
      },
    })

    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description || undefined,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate || undefined,
      assigneeName: t.assignee?.name,
    }))
  }

  private async getRecentReports(employeeId: string): Promise<ReportSummary[]> {
    const reports = await prisma.employeeReport.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    return reports.map((r: { id: string; type: string; summary?: string; createdAt: Date }) => ({
      id: r.id,
      type: r.type,
      summary: r.summary || undefined,
      createdAt: r.createdAt,
    }))
  }

  private async getCompanyContext(companyId: string): Promise<CompanyContextData> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    })

    const employeeCount = await prisma.employee.count({
      where: { companyId },
    })

    const activeTasks = await prisma.task.count({
      where: {
        companyId,
        status: {
          in: ['TODO', 'IN_PROGRESS', 'BLOCKED'],
        },
      },
    })

    const overdueTasks = await prisma.task.count({
      where: {
        companyId,
        status: {
          in: ['TODO', 'IN_PROGRESS'],
        },
        dueDate: {
          lt: new Date(),
        },
      },
    })

    const memory = await prisma.companyMemory.findMany({
      where: { companyId },
      orderBy: { importance: 'desc' },
      take: 5,
    })

    const risks = await prisma.task.findMany({
      where: {
        companyId,
        status: 'BLOCKED',
      },
      take: 5,
    })

    return {
      companyName: company?.name || 'Unknown',
      companyDescription: company?.description || undefined,
      totalEmployees: employeeCount,
      activeTasks,
      overdueTasks,
      risksCount: risks.length,
      recentMemory: memory.map((m: { content: string }) => m.content),
    }
  }

  buildSystemPrompt(context: AgentContext): string {
    const prompt = `You are ${context.employeeName}, a ${context.employeeTitle} at ${context.companyContext.companyName}.

## Your Role
System Role: ${context.systemRole}
Department: ${context.employeeDepartment}

## Responsibilities
${context.responsibilities || 'Not specified'}

## Objectives
${context.objectives || 'Not specified'}

## Key Performance Indicators (KPIs)
${context.kpis || 'Not specified'}

## Daily Routine
${context.dailyRoutine || 'Not specified'}

## Weekly Routine
${context.weeklyRoutine || 'Not specified'}

## Communication Style
${context.communicationStyle || 'Professional and clear'}

## Decision Rules
${context.decisionRules || 'Make decisions within your authority'}

## Escalation Rules
${context.escalationRules || 'Escalate when unsure'}

## Your Permissions
${context.permissions.length > 0 ? context.permissions.join(', ') : 'Standard employee permissions'}

## Critical Instructions
${context.instructions.length > 0 ? context.instructions.map((i) => `- ${i}`).join('\n') : 'No special instructions'}

## Current Tasks
${
  context.currentTasks.length > 0
    ? context.currentTasks.map((t) => `- ${t.title} (${t.status}, Priority: ${t.priority})`).join('\n')
    : 'No active tasks'
}

## Important Memory
${context.relevantMemory.length > 0 ? context.relevantMemory.map((m) => `- ${m.content}`).join('\n') : 'No relevant memory'}

## Company Context
- Total Employees: ${context.companyContext.totalEmployees}
- Active Tasks: ${context.companyContext.activeTasks}
- Overdue Tasks: ${context.companyContext.overdueTasks}
- Open Risks: ${context.companyContext.risksCount}

## Guidelines
1. Always respond in Turkish
2. Respect all rules and instructions above
3. Check permissions before taking actions
4. Escalate when required
5. Be professional and efficient
6. Use available tools to accomplish tasks
7. Never exceed your authority
8. Ask for clarification when needed`

    return prompt
  }
}

export const contextBuilder = new AgentContextBuilder()
