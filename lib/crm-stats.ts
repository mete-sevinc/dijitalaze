import { crmQuotesForYear } from '@/lib/suitecrm'

// Teklif istatistiği: sayım ve toplamı model değil kod hesaplar. Veri canlı CRM'den (salt okunur) gelir.
// Grup = CRM "product_of_interest_c" alanı (1.PAS, 2.CMM, 3.YPA, 4.Genel). Yıl = teklifin oluşturulma yılı (İstanbul saati).
export interface QuoteRow {
  stage: string
  total: number
  currency: string
  group: string
  lostCauses: string[]
}

export interface GroupStats {
  grup: string
  toplam: number
  aşamalar: Record<string, { adet: number; tutar: Record<string, number> }>
  kaybetmeSebepleri: Record<string, number>
}

const groupName = (v: string) => v.replace(/^\d+\.\s*/, '').trim() || '(grup yok)'

export function aggregateQuotes(rows: QuoteRow[], groups?: string[]): GroupStats[] {
  const wanted = new Set((groups ?? []).map((g) => g.trim().toUpperCase()).filter(Boolean))
  const out = new Map<string, GroupStats>()
  for (const r of rows) {
    const g = groupName(r.group)
    if (wanted.size && !wanted.has(g.toUpperCase())) continue
    const s = out.get(g) ?? { grup: g, toplam: 0, aşamalar: {}, kaybetmeSebepleri: {} }
    out.set(g, s)
    s.toplam++
    const st = (s.aşamalar[r.stage || '(aşama yok)'] ??= { adet: 0, tutar: {} })
    st.adet++
    st.tutar[r.currency] = Math.round(((st.tutar[r.currency] ?? 0) + r.total) * 100) / 100
    if (r.stage === 'Closed Lost') for (const c of r.lostCauses) s.kaybetmeSebepleri[c] = (s.kaybetmeSebepleri[c] ?? 0) + 1
  }
  return [...out.values()].sort((a, b) => a.grup.localeCompare(b.grup))
}

export async function quoteStats(year: number, groups?: string[]): Promise<GroupStats[]> {
  return aggregateQuotes(await crmQuotesForYear(year), groups)
}
