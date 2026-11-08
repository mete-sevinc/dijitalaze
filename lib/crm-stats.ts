import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

// Teklif (AOS_Quotes) istatistiği: sayım ve toplamı model değil veritabanı hesaplar.
// Grup = teklif adının başındaki harf öbeği (PAS_Bakim → PAS). Yıl = teklifin geçerlilik (expiration) yılı,
// yoksa CRM'deki son değişiklik yılı (oluşturma tarihi indekste tutulmuyor).
export interface QuoteStatRow {
  group: string
  stage: string
  count: number
  total: number
}

export async function quoteStats(year: number, groups?: string[]): Promise<QuoteStatRow[]> {
  const wanted = (groups ?? []).map((g) => g.trim().toUpperCase()).filter(Boolean)
  const groupFilter = wanted.length ? Prisma.sql`AND g."grp" IN (${Prisma.join(wanted)})` : Prisma.empty
  const rows = await prisma.$queryRaw<{ grp: string; stage: string; cnt: bigint; total: number | null }[]>`
    WITH q AS (
      SELECT
        upper(coalesce(substring("title" from '^[A-Za-zÇĞİÖŞÜçğıöşü]+'), '?')) AS grp,
        coalesce(substring("content" from '(?m)^stage: (.*)$'), '(aşama yok)') AS stage,
        coalesce(nullif(substring("content" from '(?m)^total_amt: ([0-9.]+)'), '')::numeric, 0) AS total,
        coalesce(
          substring("content" from '(?m)^expiration: ([0-9]{4})')::int,
          extract(year from "crmModifiedAt")::int
        ) AS yr
      FROM "CrmRecord"
      WHERE "module" = 'AOS_Quotes'
    )
    SELECT g."grp", g."stage", count(*) AS cnt, sum(g."total")::float8 AS total
    FROM q g
    WHERE g."yr" = ${year} ${groupFilter}
    GROUP BY g."grp", g."stage"
    ORDER BY g."grp", cnt DESC`
  return rows.map((r) => ({ group: r.grp, stage: r.stage, count: Number(r.cnt), total: Math.round((r.total ?? 0) * 100) / 100 }))
}
