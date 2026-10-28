import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { crmReader } from '@/lib/suitecrm'
import { buildRecord, CRM_MODULES, likePatterns, parseCrmDate } from '@/lib/crm-index'

const PAGE_SIZE = 100
const FULL_EVERY_MS = 7 * 24 * 3600_000 // silinen kayıtlar yalnız tam geçişte temizlenir
const RESUME_OVERLAP = 5 // geçiş sürerken bir kayıt değişip sona kayarsa ofset kayar; birkaç satır geri al

export type SyncResult = { module: string; fetched: number; done: boolean }

// Bütçe (ms) dolana kadar modülleri sırayla senkronlar; kaldığı yerden devam eder.
export async function syncCrm(budgetMs: number, skip: ReadonlySet<string> = new Set()): Promise<SyncResult[]> {
  const deadline = Date.now() + budgetMs
  const reader = await crmReader()
  const results: SyncResult[] = []

  for (const name of CRM_MODULES) {
    if (Date.now() >= deadline) break
    if (skip.has(name)) continue
    let st = await prisma.crmSyncState.upsert({ where: { module: name }, create: { module: name }, update: {} })
    let fetched = 0

    if (!st.inPass) {
      const full = !st.lastFullAt || Date.now() - st.lastFullAt.getTime() > FULL_EVERY_MS
      st = await prisma.crmSyncState.update({
        where: { module: name },
        data: { inPass: true, fullPass: full, passSince: full ? null : st.since, pageOffset: 0, maxSeen: null, passStartedAt: new Date() },
      })
    } else {
      st = await prisma.crmSyncState.update({ where: { module: name }, data: { pageOffset: Math.max(0, st.pageOffset - RESUME_OVERLAP) } })
    }
    const passStartedAt = st.passStartedAt!
    let offset = st.pageOffset
    let maxSeen = st.maxSeen
    let done = false

    while (Date.now() < deadline) {
      const rows = await reader.page(name, st.passSince, offset, PAGE_SIZE)
      if (rows.length) {
        const built = rows.map((r) => ({ id: r.id, ...buildRecord(name, r.id, r.fields), mod: parseCrmDate(r.fields.date_modified)?.toISOString() ?? null }))
        await prisma.$executeRaw`
          INSERT INTO "CrmRecord" ("id", "module", "recordId", "title", "content", "crmModifiedAt", "syncedAt")
          SELECT gen_random_uuid()::text, ${name}, t.rid, t.title, t.content, t.modified, ${passStartedAt}
          FROM unnest(${built.map((b) => b.id)}::text[], ${built.map((b) => b.title)}::text[], ${built.map((b) => b.content)}::text[], ${built.map((b) => b.mod)}::timestamp[])
            AS t(rid, title, content, modified)
          ON CONFLICT ("module", "recordId") DO UPDATE
            SET "title" = EXCLUDED."title", "content" = EXCLUDED."content",
                "crmModifiedAt" = EXCLUDED."crmModifiedAt", "syncedAt" = EXCLUDED."syncedAt"`
        const last = rows[rows.length - 1].fields.date_modified
        if (last && (!maxSeen || last > maxSeen)) maxSeen = last
      }
      offset += rows.length
      fetched += rows.length
      if (rows.length < PAGE_SIZE) {
        done = true
        break
      }
      await prisma.crmSyncState.update({ where: { module: name }, data: { pageOffset: offset, maxSeen } })
    }

    if (done) {
      if (st.fullPass) await prisma.crmRecord.deleteMany({ where: { module: name, syncedAt: { lt: passStartedAt } } })
      await prisma.crmSyncState.update({
        where: { module: name },
        data: {
          inPass: false, pageOffset: 0, maxSeen: null, passStartedAt: null,
          since: maxSeen ?? st.passSince ?? st.since,
          ...(st.fullPass ? { lastFullAt: new Date() } : {}),
        },
      })
    } else {
      await prisma.crmSyncState.update({ where: { module: name }, data: { pageOffset: offset, maxSeen } })
    }
    results.push({ module: name, fetched, done })
  }
  return results
}

export type CrmHit = { module: string; recordId: string; title: string; snippet: string; modifiedAt: Date | null }

// Başlık+içerikte Türkçe tam metin eşleşmesi VEYA tüm terimlerin geçtiği kayıtlar; en alakalı + en yeni önce.
export async function searchCrm(query: string, opts: { module?: string; limit?: number } = {}): Promise<CrmHit[]> {
  const q = query.trim().slice(0, 200)
  const patterns = likePatterns(q)
  if (!patterns.length) return []
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 25)
  const moduleFilter = opts.module ? Prisma.sql`AND "module" = ${opts.module}` : Prisma.empty
  const rows = await prisma.$queryRaw<{ module: string; recordId: string; title: string; snippet: string; crmModifiedAt: Date | null }[]>`
    SELECT "module", "recordId", "title", left("content", 700) AS snippet, "crmModifiedAt"
    FROM "CrmRecord"
    WHERE (
      to_tsvector('turkish', "title" || ' ' || "content") @@ websearch_to_tsquery('turkish', ${q})
      OR ("title" || ' ' || "content") ILIKE ALL (${patterns}::text[])
    ) ${moduleFilter}
    ORDER BY ts_rank(setweight(to_tsvector('turkish', "title"), 'A') || setweight(to_tsvector('turkish', "content"), 'C'), websearch_to_tsquery('turkish', ${q})) DESC,
             "crmModifiedAt" DESC NULLS LAST
    LIMIT ${limit}`
  return rows.map((r) => ({ module: r.module, recordId: r.recordId, title: r.title, snippet: r.snippet, modifiedAt: r.crmModifiedAt }))
}
