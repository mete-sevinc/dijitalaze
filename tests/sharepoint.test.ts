import { describe, it, expect } from 'vitest'
import { allowedPrefixes, deniedPrefixes, isAllowedUrl, parsePrefixList } from '@/lib/sharepoint'

const ROOT = 'https://azeotomasyon.sharepoint.com/AZE_external'
const A = allowedPrefixes(ROOT)
const D = deniedPrefixes('https://azeotomasyon.sharepoint.com/AZE_external/Finans')
const ok = (u: string) => isAllowedUrl(u, A, D)

describe('sharepoint önek yapılandırması', () => {
  it('bozuk kayıt tüm listeyi reddeder (sessizce atlamaz)', () => {
    expect(() => parsePrefixList('https://azeotomasyon.sharepoint.com/A, http://x.sharepoint.com/b')).toThrow()
    expect(() => parsePrefixList('https://evil.com/a')).toThrow()
    expect(() => parsePrefixList('https://azeotomasyon.sharepoint.com/')).toThrow()
    expect(() => parsePrefixList('https://azeotomasyon.sharepoint.com/a/../b')).toThrow()
    expect(() => parsePrefixList('https://azeotomasyon.sharepoint.com/a?x=1')).toThrow()
  })
  it('boş değer boş liste', () => {
    expect(parsePrefixList('')).toEqual([])
    expect(parsePrefixList(undefined)).toEqual([])
  })
  it('önek kodlanmış/NFC farkından etkilenmez', () => {
    const d = deniedPrefixes('https://azeotomasyon.sharepoint.com/AZE_external/%C4%B0K')
    expect(isAllowedUrl('https://azeotomasyon.sharepoint.com/AZE_external/İK/a.pdf', A, d)).toBe(false)
    expect(isAllowedUrl('https://azeotomasyon.sharepoint.com/AZE_external/%C4%B0K/a.pdf', A, d)).toBe(false)
  })
})

describe('sharepoint izin ve engel eşleştirmesi', () => {
  it('izinli klasör altı geçer, büyük/küçük harf önemsiz', () => {
    expect(ok('https://azeotomasyon.sharepoint.com/AZE_external/Teklif_F04/a.pdf')).toBe(true)
    expect(ok('https://azeotomasyon.sharepoint.com/aze_external/x')).toBe(true)
  })
  it.each([
    'https://azeotomasyon.sharepoint.com/AZE_external/Finans',
    'https://azeotomasyon.sharepoint.com/AZE_external/Finans/Giden_Fatura_F01/a.pdf',
    'https://azeotomasyon.sharepoint.com/AZE_external/finans/a.pdf',
    'https://azeotomasyon.sharepoint.com/AZE_external//Finans/a.pdf',
    'https://azeotomasyon.sharepoint.com/AZE_external/%46inans/a.pdf',
    'https://azeotomasyon.sharepoint.com/AZE_external/Finans/a.pdf?web=1',
    'https://azeotomasyon.sharepoint.com/AZE_external/Forms/DispForm.aspx?ID=1',
    'https://azeotomasyon.sharepoint.com/AZE_external/Forms/AllItems.aspx',
    'https://azeotomasyon.sharepoint.com/AZE_external_gizli/x',
    'https://azeotomasyon.sharepoint.com/AZE_externalx',
    'https://azeotomasyon.sharepoint.com/Ik/maas.xlsx',
    'https://azeotomasyon.sharepoint.com/AZE_external/../Ik/x',
    'https://azeotomasyon.sharepoint.com/AZE_external%2F..%2FIk/x',
    'https://evil.sharepoint.com/AZE_external/x',
    'http://azeotomasyon.sharepoint.com/AZE_external/x',
    'https://azeotomasyon.sharepoint.com:8443/AZE_external/x',
    'not a url',
    '',
  ])('reddedilir: %s', (u) => expect(ok(u)).toBe(false))
  it('önek yoksa hiçbir şey geçmez', () => expect(isAllowedUrl('https://azeotomasyon.sharepoint.com/AZE_external/x', [], [])).toBe(false))
  it('FinansDisi gibi benzer ad engellenmez', () => expect(ok('https://azeotomasyon.sharepoint.com/AZE_external/FinansDisi/a.pdf')).toBe(true))
})
