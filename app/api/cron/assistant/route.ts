import { timingSafeEqual } from 'node:crypto'
import { sendDailyBriefs, sendDueReminders } from '@/lib/assistant/jobs'

export const dynamic = 'force-dynamic'

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // fail closed
  const given = Buffer.from(req.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

// ?job=brief → günlük özet (Vercel cron, günde 1). Varsayılan → vadesi gelen hatırlatmalar
// (dakikalık harici tetikleyici için; Vercel Hobby dakikalık cron'a izin vermez).
export async function GET(req: Request) {
  if (!authorized(req)) return new Response('Unauthorized', { status: 401 })
  const job = new URL(req.url).searchParams.get('job')
  if (job === 'brief') {
    const reminders = await sendDueReminders()
    const briefs = await sendDailyBriefs()
    return Response.json({ reminders, briefs })
  }
  return Response.json({ reminders: await sendDueReminders() })
}
