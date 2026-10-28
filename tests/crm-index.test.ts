import { describe, expect, it } from 'vitest'
import { buildRecord, likePatterns, parseCrmDate } from '@/lib/crm-index'

describe('buildRecord', () => {
  it('uses name as title and keeps meaningful fields only', () => {
    const r = buildRecord('Accounts', 'abc12345-0000', {
      id: 'abc12345-0000', name: 'GES Plastik', assigned_user_id: 'u1', date_modified: '2026-05-22 16:24:48',
      billing_address_city: 'Manisa', phone_office: '(236) 233 1110', amount_usdollar: '12.00',
      jjwg_maps_lat_c: '0.00000000', aze_projedegerlendirme_accounts_name: '      ', total_amt: '0.000000', industry: '^Manufacturing^',
    })
    expect(r.title).toBe('GES Plastik')
    expect(r.content).toBe('billing_address_city: Manisa\nphone_office: (236) 233 1110\nindustry: Manufacturing')
  })

  it('falls back to full name, first+last name, then module and id', () => {
    expect(buildRecord('Contacts', 'x', { full_name: 'Semih Ağırgöçer' }).title).toBe('Semih Ağırgöçer')
    expect(buildRecord('Contacts', 'x', { first_name: 'Semih', last_name: 'A' }).title).toBe('Semih A')
    expect(buildRecord('Calls', '12345678-9', {}).title).toBe('Calls 12345678')
  })

  it('strips control characters (incl. NUL) but keeps line breaks, and caps size', () => {
    const r = buildRecord('Notes', 'x', { name: 'n\u0000ame', description: 'a\u0000b\nc' })
    expect(r.title).toBe('n ame')
    expect(r.content).toBe('description: a b\nc')
    const big = buildRecord('Notes', 'x', { a: 'x'.repeat(5000), b: 'y'.repeat(5000), c: 'z'.repeat(5000) })
    expect(big.content.length).toBeLessThanOrEqual(12_000 + 20)
  })
})

describe('parseCrmDate', () => {
  it('parses CRM UTC timestamps and rejects other formats', () => {
    expect(parseCrmDate('2026-05-22 16:24:48')?.toISOString()).toBe('2026-05-22T16:24:48.000Z')
    expect(parseCrmDate('')).toBeNull()
    expect(parseCrmDate("2026-05-22'; DROP")).toBeNull()
  })
})

describe('likePatterns', () => {
  it('escapes LIKE wildcards, drops 1-char terms and caps at 6 terms', () => {
    expect(likePatterns('100% a_b x')).toEqual(['%100\\%%', '%a\\_b%'])
    expect(likePatterns('a1 b2 c3 d4 e5 f6 g7 h8')).toHaveLength(6)
    expect(likePatterns('  ')).toEqual([])
  })
})
