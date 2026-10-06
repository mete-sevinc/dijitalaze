import { prisma } from '@/lib/db'
import { createAIProvider } from '@/lib/ai/provider'
import { AIMessage } from '@/lib/types'
import { agentTools } from './tools'
import { contextBuilder } from './context-builder'
import { executeToolAction } from './tool-executor'

export class AgentRuntime {
  private aiProvider = createAIProvider()

  async runConversation(
    employeeId: string,
    companyId: string,
    userMessage: string,
    conversationId?: string
  ): Promise<{ conversationId: string; response: string }> {
    // Load or create conversation
    let conversation
    if (conversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      })
    } else {
      conversation = await prisma.conversation.create({
        data: {
          employeeId,
          companyId,
          title: userMessage.slice(0, 100),
          messages: {
            create: [],
          },
        },
        include: { messages: true },
      })
    }

    if (!conversation) {
      throw new Error('Failed to create conversation')
    }

    // Save user message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content: userMessage,
      },
    })

    // Build conversation history
    const conversationHistory: AIMessage[] = conversation.messages.map((msg: { role: string; content: string }) => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
    }))

    conversationHistory.push({
      role: 'user',
      content: userMessage,
    })

    // Build context
    const context = await contextBuilder.buildContext(employeeId, companyId, conversationHistory)

    // Build system prompt
    const systemPrompt = contextBuilder.buildSystemPrompt(context)

    // Call AI
    const response = await this.aiProvider.sendMessage(
      [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...conversationHistory,
      ],
      agentTools
    )

    // Handle tool uses
    const finalResponse = response.content
    if (response.toolUses && response.toolUses.length > 0) {
      for (const toolUse of response.toolUses) {
        const toolResult = await executeToolAction(toolUse.name, toolUse.input, context)
        if (toolResult.error) {
          console.error(`Tool error: ${toolResult.error}`)
        }
      }
    }

    // Save assistant message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: finalResponse,
        metadata: JSON.stringify({
          toolUses: response.toolUses,
          stopReason: response.stopReason,
        }),
      },
    })

    return { conversationId: conversation.id, response: finalResponse }
  }

  async *streamConversation(
    employeeId: string,
    companyId: string,
    userMessage: string,
    conversationId?: string
  ): AsyncGenerator<string> {
    // Load or create conversation
    let conversation
    if (conversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      })
    } else {
      conversation = await prisma.conversation.create({
        data: {
          employeeId,
          companyId,
          title: userMessage.slice(0, 100),
        },
        include: { messages: true },
      })
    }

    if (!conversation) {
      throw new Error('Failed to create conversation')
    }

    // Save user message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content: userMessage,
      },
    })

    // Build conversation history
    const conversationHistory: AIMessage[] = conversation.messages.map((msg: { role: string; content: string }) => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
    }))

    conversationHistory.push({
      role: 'user',
      content: userMessage,
    })

    // Build context
    const context = await contextBuilder.buildContext(employeeId, companyId, conversationHistory)

    // Build system prompt
    const systemPrompt = contextBuilder.buildSystemPrompt(context)

    // Stream AI response
    let fullResponse = ''
    for await (const chunk of this.aiProvider.streamMessage(
      [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...conversationHistory,
      ],
      agentTools
    )) {
      if (chunk.type === 'text' && chunk.content) {
        fullResponse += chunk.content
        yield chunk.content
      }
    }

    // Save assistant message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: fullResponse,
      },
    })
  }

  async generateDailyBriefing(companyId: string): Promise<string> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    })

    if (!company) {
      throw new Error('Company not found')
    }

    const taskStats = await prisma.task.groupBy({
      by: ['status'],
      where: { companyId },
      _count: true,
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

    const meetingCount = await prisma.meeting.count({
      where: {
        companyId,
        status: 'ACTIVE',
      },
    })

    const systemPrompt = `You are the AI Company Assistant for ${company.name}.
Generate a daily briefing in Turkish that summarizes the company status.

Company Stats:
- Total Tasks: ${taskStats.reduce((acc: number, s: { _count: number }) => acc + s._count, 0)}
- Active Tasks: ${taskStats.find((s: { status: string }) => s.status === 'IN_PROGRESS')?._count || 0}
- Overdue Tasks: ${overdueTasks}
- Active Meetings: ${meetingCount}

Create a professional, concise briefing that includes:
1. A greeting
2. Key metrics
3. Priority items
4. Recommended actions

Format it nicely for a dashboard display.`

    const response = await this.aiProvider.sendMessage([
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: 'Generate today\'s company briefing',
      },
    ])

    return response.content
  }
}

export const agentRuntime = new AgentRuntime()
