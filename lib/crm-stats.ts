import { crmDocumentsForYear, type CrmDoc, type DocKind } from '@/lib/suitecrm'

// Teklif/fatura istatistiği: sayım ve toplamı model değil kod hesaplar. Veri canlı CRM'den (salt okunur) gelir.
// Grup = CRM "product_of_interest_c" alanı (1.PAS, 2.CMM, 3.YPA, 4.Genel).
export type DocRow = Pick<CrmDoc, 'status' | 'subtotal' | 'total' | 'currency' | 'group' | 'lostCauses'>

export interface Amount {
  kdvHariç: number
  kdvDahil: number
}
export interface GroupStats {
  grup: string
  toplam: number
  durumlar: Record<string, { adet: number; tutar: Record<string, Amount> }>
  kaybetmeSebepleri: Record<string, number>
}

// CRM'den gelen metinler nesne anahtarı olur: prototipsiz nesne + tehlikeli anahtar reddi.
const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype'])
const safeKey = (k: string) => (FORBIDDEN.has(k) ? '(geçersiz)' : k)
const dict = <T,>() => Object.create(null) as Record<string, T>
const round2 = (n: number) => Math.round(n * 100) / 100

const groupName = (v: string) => v.replace(/^\d+\.\s*/, '').trim() || '(grup yok)'

export function aggregateDocs(rows: DocRow[], groups?: string[]): GroupStats[] {
  const wanted = new Set((groups ?? []).map((g) => g.trim().toUpperCase()).filter(Boolean))
  const out = new Map<string, GroupStats>()
  for (const r of rows) {
    const g = safeKey(groupName(r.group))
    if (wanted.size && !wanted.has(g.toUpperCase())) continue
    const s = out.get(g) ?? { grup: g, toplam: 0, durumlar: dict(), kaybetmeSebepleri: dict() }
    out.set(g, s)
    s.toplam++
    const st = (s.durumlar[safeKey(r.status) || '(durum yok)'] ??= { adet: 0, tutar: dict() })
    st.adet++
    const cur = safeKey(r.currency)
    const a = (st.tutar[cur] ??= { kdvHariç: 0, kdvDahil: 0 })
    a.kdvHariç = round2(a.kdvHariç + r.subtotal)
    a.kdvDahil = round2(a.kdvDahil + r.total)
    if (r.status === 'Closed Lost') {
      for (const c0 of r.lostCauses) {
        const c = safeKey(c0)
        s.kaybetmeSebepleri[c] = (s.kaybetmeSebepleri[c] ?? 0) + 1
      }
    }
  }
  return [...out.values()].sort((a, b) => a.grup.localeCompare(b.grup))
}

export async function docStats(kind: DocKind, year: number, groups?: string[]): Promise<GroupStats[]> {
  return aggregateDocs(await crmDocumentsForYear(kind, year), groups)
}

// Kayıt listesi (en yeni önce). Firma adı alt dizge, durum tam eşleşme (büyük/küçük harf duyarsız).
export async function listDocs(kind: DocKind, year: number, opts: { status?: string; account?: string; limit?: number } = {}) {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50)
  const st = opts.status?.trim().toLowerCase()
  const acc = opts.account?.trim().toLowerCase()
  const all = await crmDocumentsForYear(kind, year)
  const hit = all
    .filter((d) => (!st || d.status.toLowerCase() === st) && (!acc || d.account.toLowerCase().includes(acc) || d.name.toLowerCase().includes(acc)))
    .sort((a, b) => b.date.localeCompare(a.date))
  return {
    eşleşenToplam: hit.length,
    gösterilen: Math.min(hit.length, limit),
    kayıtlar: hit.slice(0, limit).map((d) => ({
      no: d.number, ad: d.name, firma: d.account, durum: d.status, grup: groupName(d.group),
      kdvHariç: d.subtotal, kdvDahil: d.total, paraBirimi: d.currency, tarih: d.date, vade: d.dueDate,
    })),
  }
}
