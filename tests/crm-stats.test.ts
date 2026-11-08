import { describe, expect, it } from 'vitest'
import { aggregateDocs } from '@/lib/crm-stats'

describe('aggregateDocs', () => {
  const rows = [
    { subtotal: 0, group: '1.PAS', status: 'Closed Accepted', total: 100.5, currency: 'EUR', lostCauses: [] },
    { subtotal: 0, group: '1.PAS', status: 'Closed Accepted', total: 50, currency: 'GBP', lostCauses: [] },
    { subtotal: 0, group: '1.PAS', status: 'Closed Lost', total: 10, currency: 'EUR', lostCauses: ['Fiyat_Yuksek', 'Teklif_Suremiz_Doldu'] },
    { subtotal: 0, group: '3.YPA', status: 'Closed Lost', total: 5, currency: 'EUR', lostCauses: ['Fiyat_Yuksek'] },
    { subtotal: 0, group: '2.CMM', status: 'Negotiation', total: 1, currency: 'USD', lostCauses: [] },
  ]
  it('counts by group/stage, sums per currency and counts loss causes', () => {
    const r = aggregateDocs(rows)
    expect(r.map((g) => g.grup)).toEqual(['CMM', 'PAS', 'YPA'])
    const pas = r.find((g) => g.grup === 'PAS')!
    expect(pas.toplam).toBe(3)
    expect(pas.durumlar['Closed Accepted']).toEqual({ adet: 2, tutar: { EUR: { kdvHariç: 0, kdvDahil: 100.5 }, GBP: { kdvHariç: 0, kdvDahil: 50 } } })
    expect(pas.kaybetmeSebepleri).toEqual({ Fiyat_Yuksek: 1, Teklif_Suremiz_Doldu: 1 })
  })
  it('filters groups case-insensitively', () => {
    expect(aggregateDocs(rows, ['pas', 'ypa']).map((g) => g.grup)).toEqual(['PAS', 'YPA'])
  })
})

describe('aggregateDocs untrusted keys', () => {
  it('does not pollute prototypes and survives __proto__ keys', () => {
    const r = aggregateDocs([{ subtotal: 0, group: '__proto__', status: 'constructor', total: 1, currency: '__proto__', lostCauses: [] }])
    expect(r).toHaveLength(1)
    expect(({} as Record<string, unknown>).adet).toBeUndefined()
    expect(Object.keys(r[0].durumlar)).toEqual(['(geçersiz)'])
  })
})
