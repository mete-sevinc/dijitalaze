import { describe, expect, it } from 'vitest'
import { aggregateQuotes } from '@/lib/crm-stats'

describe('aggregateQuotes', () => {
  const rows = [
    { group: '1.PAS', stage: 'Closed Accepted', total: 100.5, currency: 'Varsayılan (-99)', lostCauses: [] },
    { group: '1.PAS', stage: 'Closed Accepted', total: 50, currency: 'GBP', lostCauses: [] },
    { group: '1.PAS', stage: 'Closed Lost', total: 10, currency: 'Varsayılan (-99)', lostCauses: ['Fiyat_Yuksek', 'Teklif_Suremiz_Doldu'] },
    { group: '3.YPA', stage: 'Closed Lost', total: 5, currency: 'Varsayılan (-99)', lostCauses: ['Fiyat_Yuksek'] },
    { group: '2.CMM', stage: 'Negotiation', total: 1, currency: 'USD', lostCauses: [] },
  ]
  it('counts by group/stage, sums per currency and counts loss causes', () => {
    const r = aggregateQuotes(rows)
    expect(r.map((g) => g.grup)).toEqual(['CMM', 'PAS', 'YPA'])
    const pas = r.find((g) => g.grup === 'PAS')!
    expect(pas.toplam).toBe(3)
    expect(pas.aşamalar['Closed Accepted']).toEqual({ adet: 2, tutar: { 'Varsayılan (-99)': 100.5, GBP: 50 } })
    expect(pas.kaybetmeSebepleri).toEqual({ Fiyat_Yuksek: 1, Teklif_Suremiz_Doldu: 1 })
  })
  it('filters groups case-insensitively', () => {
    expect(aggregateQuotes(rows, ['pas', 'ypa']).map((g) => g.grup)).toEqual(['PAS', 'YPA'])
  })
})
