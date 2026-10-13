// Deterministic report builder: summarizes an employee's tasks for a period. No LLM involved,
// so reports are reproducible and never fail on a provider outage.

export type ReportType = 'DAILY' | 'WEEKLY' | 'MONTHLY'
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'REVIEW' | 'DONE' | 'CANCELLED'

export interface TaskLite {
  title: string
  status: TaskStatus
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  dueDate: Date | null
  completedAt: Date | null
  updatedAt: Date
}

export interface ReportContent {
  summary: string
  completedTasks: string[]
  activeTasks: string[]
  blockedTasks: string[]
  risks: string[]
  recommendations: string[]
  nextPriorities: string[]
}

const DAYS: Record<ReportType, number> = { DAILY: 1, WEEKLY: 7, MONTHLY: 30 }
export const REPORT_LABELS: Record<ReportType, string> = { DAILY: 'Günlük', WEEKLY: 'Haftalık', MONTHLY: 'Aylık' }
const PRIORITY_RANK = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const
const ACTIVE: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW']

export function periodFor(type: ReportType, now: Date): { start: Date; end: Date } {
  return { start: new Date(now.getTime() - DAYS[type] * 24 * 60 * 60 * 1000), end: now }
}

export function buildReport(tasks: TaskLite[], type: ReportType, now: Date): ReportContent {
  const { start, end } = periodFor(type, now)
  const doneAt = (t: TaskLite) => t.completedAt ?? t.updatedAt

  const completed = tasks.filter((t) => t.status === 'DONE' && doneAt(t) >= start && doneAt(t) <= end)
  const active = tasks.filter((t) => ACTIVE.includes(t.status))
  const blocked = tasks.filter((t) => t.status === 'BLOCKED')
  const overdue = active.filter((t) => t.dueDate !== null && t.dueDate < now)

  const next = [...active]
    .sort((a, b) => {
      const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      if (p !== 0) return p
      return (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity)
    })
    .slice(0, 5)

  const recommendations: string[] = []
  if (blocked.length > 0) recommendations.push(`Takılan ${blocked.length} işe müdahale edin.`)
  if (overdue.length > 0) recommendations.push(`${overdue.length} geciken işin teslim tarihini gözden geçirin.`)
  if (active.length === 0 && completed.length === 0) recommendations.push('Dönemde hareket yok; yeni iş vermeyi düşünün.')

  return {
    summary: `${REPORT_LABELS[type]} rapor: ${completed.length} tamamlandı, ${active.length} aktif, ${blocked.length} takılı, ${overdue.length} gecikmiş.`,
    completedTasks: completed.map((t) => t.title),
    activeTasks: active.map((t) => t.title),
    blockedTasks: blocked.map((t) => t.title),
    risks: [...blocked.map((t) => `Takıldı: ${t.title}`), ...overdue.map((t) => `Gecikti: ${t.title}`)],
    recommendations,
    nextPriorities: next.map((t) => t.title),
  }
}

// Stored as JSON strings in the database.
export function parseList(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
