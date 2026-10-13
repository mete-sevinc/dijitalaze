import { describe, expect, it } from 'vitest'
import { buildReport, parseList, periodFor, type TaskLite } from '@/lib/reports'

const now = new Date('2026-10-13T12:00:00Z')
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000)
const task = (over: Partial<TaskLite>): TaskLite => ({
  title: 't', status: 'TODO', priority: 'MEDIUM', dueDate: null, completedAt: null, updatedAt: hoursAgo(1), ...over,
})

describe('periodFor', () => {
  it('covers 1, 7 and 30 days ending now', () => {
    expect(periodFor('DAILY', now).start).toEqual(hoursAgo(24))
    expect(periodFor('WEEKLY', now).start).toEqual(hoursAgo(24 * 7))
    expect(periodFor('MONTHLY', now).end).toEqual(now)
  })
})

describe('buildReport', () => {
  it('counts only tasks completed inside the period', () => {
    const r = buildReport(
      [
        task({ title: 'yeni', status: 'DONE', completedAt: hoursAgo(2) }),
        task({ title: 'eski', status: 'DONE', completedAt: hoursAgo(72) }),
      ],
      'DAILY',
      now,
    )
    expect(r.completedTasks).toEqual(['yeni'])
  })

  it('flags blocked and overdue work as risks and recommends action', () => {
    const r = buildReport(
      [
        task({ title: 'takıldı', status: 'BLOCKED' }),
        task({ title: 'geç', status: 'IN_PROGRESS', dueDate: hoursAgo(5) }),
        task({ title: 'zamanında', status: 'TODO', dueDate: new Date(now.getTime() + 86400_000) }),
      ],
      'WEEKLY',
      now,
    )
    expect(r.risks).toEqual(['Takıldı: takıldı', 'Gecikti: geç'])
    expect(r.blockedTasks).toEqual(['takıldı'])
    expect(r.recommendations).toHaveLength(2)
    expect(r.summary).toBe('Haftalık rapor: 0 tamamlandı, 2 aktif, 1 takılı, 1 gecikmiş.')
  })

  it('orders next priorities by priority, then due date, and keeps five', () => {
    const tasks = [
      task({ title: 'low', priority: 'LOW' }),
      task({ title: 'high-late', priority: 'HIGH', dueDate: new Date(now.getTime() + 5 * 86400_000) }),
      task({ title: 'high-soon', priority: 'HIGH', dueDate: new Date(now.getTime() + 86400_000) }),
      task({ title: 'urgent', priority: 'URGENT' }),
      task({ title: 'm1' }), task({ title: 'm2' }), task({ title: 'm3' }),
    ]
    const r = buildReport(tasks, 'DAILY', now)
    expect(r.nextPriorities.slice(0, 3)).toEqual(['urgent', 'high-soon', 'high-late'])
    expect(r.nextPriorities).toHaveLength(5)
  })

  it('suggests assigning work when nothing happened', () => {
    const r = buildReport([], 'MONTHLY', now)
    expect(r.recommendations).toEqual(['Dönemde hareket yok; yeni iş vermeyi düşünün.'])
  })

  it('ignores cancelled tasks', () => {
    const r = buildReport([task({ status: 'CANCELLED' })], 'DAILY', now)
    expect(r.activeTasks).toEqual([])
  })
})

describe('parseList', () => {
  it('reads JSON string arrays and tolerates bad input', () => {
    expect(parseList('["a","b"]')).toEqual(['a', 'b'])
    expect(parseList('[1,"a"]')).toEqual(['a'])
    expect(parseList('not json')).toEqual([])
    expect(parseList('{"a":1}')).toEqual([])
    expect(parseList(null)).toEqual([])
  })
})
