import { describe, it, expect } from 'vitest'
import { isOverBudget, monthlyTokenLimit } from '@/lib/ai/usage'

describe('token bütçesi', () => {
  it('limit tanımsız, 0, negatif veya geçersizse kapalıdır', () => {
    for (const v of [undefined, '', '0', '-5', 'abc']) expect(monthlyTokenLimit(v)).toBe(0)
  })
  it('geçerli limiti tam sayıya çevirir', () => {
    expect(monthlyTokenLimit('50000')).toBe(50000)
    expect(monthlyTokenLimit('1000.9')).toBe(1000)
  })
  it('sınır dahil dolduğunda engeller, limit yokken asla engellemez', () => {
    expect(isOverBudget(999, 1000)).toBe(false)
    expect(isOverBudget(1000, 1000)).toBe(true)
    expect(isOverBudget(10_000_000, 0)).toBe(false)
  })
})
