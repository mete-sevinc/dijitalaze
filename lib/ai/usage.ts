import { prisma } from '@/lib/db'
import { UserError } from '@/lib/action-log'

export interface UsageEntry {
  model: string
  inputTokens: number
  outputTokens: number
}

// Çalışan başına aylık token üst sınırı (giriş + çıkış). Tanımsız ya da 0 → sınır yok.
export function monthlyTokenLimit(env: string | undefined = process.env.EMPLOYEE_MONTHLY_TOKEN_LIMIT): number {
  const n = Number(env)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

export function isOverBudget(used: number, limit: number): boolean {
  return limit > 0 && used >= limit
}

function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

export async function monthlyTokensUsed(employeeId: string): Promise<number> {
  const r = await prisma.agentUsage.aggregate({
    where: { employeeId, createdAt: { gte: monthStart() } },
    _sum: { inputTokens: true, outputTokens: true },
  })
  return (r._sum.inputTokens ?? 0) + (r._sum.outputTokens ?? 0)
}

// Tüm çalışanlar toplamında dakikadaki model çağrısı üst sınırı (döngü/kötüye kullanım koruması).
// Sunucusuz ortamda bellek içi sayaç güvenilmez; son dakikanın AgentUsage kayıtları sayılır.
export const LLM_CALLS_PER_MINUTE = 40

export function isOverRate(recentCalls: number, limit = LLM_CALLS_PER_MINUTE): boolean {
  return recentCalls >= limit
}

// Modele gitmeden önce çağrılır; bütçe dolduysa ya da dakikalık hız sınırı aşıldıysa iş başlamaz.
export async function assertWithinBudget(employeeId: string): Promise<void> {
  const recent = await prisma.agentUsage.count({ where: { createdAt: { gte: new Date(Date.now() - 60_000) } } })
  if (isOverRate(recent)) throw new UserError('Çok fazla istek var, bir dakika sonra tekrar dene')
  const limit = monthlyTokenLimit()
  if (!limit) return
  if (isOverBudget(await monthlyTokensUsed(employeeId), limit)) {
    throw new UserError('Bu çalışanın aylık kullanım limiti doldu')
  }
}

// Ajan döngüsü boyunca kullanımı biriktirir; flush ile tek seferde yazılır.
export function createUsageTracker(employeeId: string) {
  const entries: UsageEntry[] = []
  return {
    add: (u: UsageEntry) => {
      entries.push(u)
    },
    async flush() {
      if (entries.length === 0) return
      const rows = entries.splice(0).map((u) => ({ employeeId, ...u }))
      try {
        await prisma.agentUsage.createMany({ data: rows })
      } catch (e) {
        console.error('usage kaydedilemedi', e instanceof Error ? e.message : e)
      }
    },
  }
}
