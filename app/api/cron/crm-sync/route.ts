import { timingSafeEqual } from 'node:crypto'
import { syncCrm } from '@/lib/crm-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // fail closed
  const given = Buffer.from(req.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

// CRM → indeks senkronu (günlük Vercel cron). Bütçe dolarsa kaldığı yerden bir sonraki çağrıda sürer.
export async function GET(req: Request) {
  if (!authorized(req)) return new Response('Unauthorized', { status: 401 })
  return Response.json({ results: await syncCrm(45_000) })
}
