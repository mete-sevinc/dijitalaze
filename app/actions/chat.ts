'use server'

import { prisma } from '@/lib/db'
import { agentRuntime } from '@/lib/agents/runtime'
import { requireAuth } from '@/lib/require-auth'
import { assertEmployeeInCompany, getCompanyId } from '@/lib/company'
import { logActionError } from '@/lib/action-log'

export async function sendMessage(employeeId: string, content: string, conversationId?: string) {
  await requireAuth()
  try {
    const companyId = await getCompanyId()
    await assertEmployeeInCompany(employeeId, companyId)
    const response = await agentRuntime.runConversation(employeeId, companyId, content, conversationId)

    return {
      success: true,
      data: response,
    }
  } catch (e) {
    logActionError('sendMessage', e)
    return { success: false, error: 'Mesaj gönderilemedi' }
  }
}

export async function getConversations(employeeId: string) {
  await requireAuth()
  try {
    const companyId = await getCompanyId()
    const conversations = await prisma.conversation.findMany({
      where: { employeeId, companyId },
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
  } catch (e) {
    logActionError('getConversations', e)
    return { success: false, error: 'Konuşmalar alınamadı' }
  }
}

export async function getConversation(conversationId: string) {
  await requireAuth()
  try {
    const companyId = await getCompanyId()
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
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
  } catch (e) {
    logActionError('getConversation', e)
    return { success: false, error: 'Konuşma alınamadı' }
  }
}

export async function createConversation(employeeId: string, title: string) {
  await requireAuth()
  try {
    const companyId = await getCompanyId()
    await assertEmployeeInCompany(employeeId, companyId)
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
  } catch (e) {
    logActionError('createConversation', e)
    return { success: false, error: 'Konuşma oluşturulamadı' }
  }
}
