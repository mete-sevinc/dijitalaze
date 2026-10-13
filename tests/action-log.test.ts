import { afterEach, describe, expect, it, vi } from 'vitest'
import { logActionError, UserError, userMessage } from '@/lib/action-log'

afterEach(() => vi.restoreAllMocks())

describe('logActionError', () => {
  it('logs the action name and error details', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = Object.assign(new Error('boom'), { code: 'P2025' })
    logActionError('updateTask', err)
    const args = spy.mock.calls[0]
    expect(args[0]).toBe('[action:updateTask]')
    expect(args).toContain('P2025')
    expect(args).toContain('boom')
  })
  it('handles non-Error values', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logActionError('x', 'plain')
    expect(spy).toHaveBeenCalledWith('[action:x]', 'plain')
  })
})

describe('userMessage', () => {
  it('passes through deliberate UserError messages', () => {
    expect(userMessage(new UserError('Görev bulunamadı'), 'fallback')).toBe('Görev bulunamadı')
  })
  it('hides plain errors, which may carry internals', () => {
    expect(userMessage(new Error('fetch failed: https://internal/...'), 'fallback')).toBe('fallback')
  })
  it('hides database errors behind the fallback', () => {
    const prismaLike = Object.assign(new Error('Invalid `prisma.task.update()` invocation ... table'), { code: 'P2025' })
    expect(userMessage(prismaLike, 'İşlem başarısız')).toBe('İşlem başarısız')
    const named = new Error('connection details')
    named.name = 'PrismaClientInitializationError'
    expect(userMessage(named, 'İşlem başarısız')).toBe('İşlem başarısız')
  })
  it('falls back for non-errors', () => {
    expect(userMessage('str', 'fb')).toBe('fb')
  })
})
