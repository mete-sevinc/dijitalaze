import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({ assistantMessage: { count: vi.fn() } }))
const chat = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db', () => ({ prisma }))
vi.mock('@/auth', () => ({ auth: vi.fn().mockResolvedValue({ user: { email: 'Mete@aze.com.tr' } }) }))
vi.mock('@/lib/assistant/service', () => ({ chatWithAssistant: chat }))
vi.mock('@/lib/assistant/push', () => ({ isAllowedPushEndpoint: () => true }))

import { sendAssistantMessage } from '@/app/actions/assistant'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('assistant message rate limit', () => {
  it('lets normal use through and counts only this user\'s messages from the last minute', async () => {
    prisma.assistantMessage.count.mockResolvedValue(3)
    chat.mockResolvedValue('merhaba')
    expect(await sendAssistantMessage('selam')).toEqual({ success: true, reply: 'merhaba' })
    const where = prisma.assistantMessage.count.mock.calls[0][0].where
    expect(where).toMatchObject({ ownerEmail: 'mete@aze.com.tr', role: 'user' })
    expect(where.createdAt.gte.getTime()).toBeGreaterThan(Date.now() - 61_000)
  })
  it('blocks at 15 messages per minute without calling the model', async () => {
    prisma.assistantMessage.count.mockResolvedValue(15)
    const res = await sendAssistantMessage('selam')
    expect(res.success).toBe(false)
    expect(chat).not.toHaveBeenCalled()
  })
  it('ignores empty messages before touching the database', async () => {
    expect((await sendAssistantMessage('   ')).success).toBe(false)
    expect(prisma.assistantMessage.count).not.toHaveBeenCalled()
  })
})
