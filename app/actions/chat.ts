'use server'

import { prisma } from '@/lib/db'
import { agentRuntime } from '@/lib/agents/runtime'

export async function sendMessage(
  employeeId: string,
  companyId: string,
  content: string,
  conversationId?: string
) {
  try {
    const response = await agentRuntime.runConversation(employeeId, companyId, content, conversationId)

    return {
      success: true,
      data: response,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Mesaj gönderilemedi',
    }
  }
}

export async function getConversations(employeeId: string) {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { employeeId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return {
      success: true,
      data: conversations,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Konuşmalar alınamadı',
    }
  }
}

export async function getConversation(conversationId: string) {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        employee: true,
      },
    })

    if (!conversation) {
      return {
        success: false,
        error: 'Konuşma bulunamadı',
      }
    }

    return {
      success: true,
      data: conversation,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Konuşma alınamadı',
    }
  }
}

export async function createConversation(employeeId: string, companyId: string, title: string) {
  try {
    const conversation = await prisma.conversation.create({
      data: {
        employeeId,
        companyId,
        title,
      },
    })

    return {
      success: true,
      data: conversation,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Konuşma oluşturulamadı',
    }
  }
}
