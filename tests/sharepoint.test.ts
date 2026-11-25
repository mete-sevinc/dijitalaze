import { describe, it, expect } from 'vitest'
import { allowedPrefixes, isAllowedUrl } from '@/lib/sharepoint'

const P = allowedPrefixes('https://azeotomasyon.sharepoint.com/AZE_external')

describe('sharepoint izin önekleri', () => {
  it('yalnız geçerli https sharepoint önekleri kabul edilir', () => {
    expect(allowedPrefixes('http://x.sharepoint.com/a, https://evil.com/a, https://azeotomasyon.sharepoint.com/A')).toEqual(['https://azeotomasyon.sharepoint.com/A/'])
    expect(allowedPrefixes('')).toEqual([])
    expect(allowedPrefixes(undefined)).toEqual([])
  })
  it('izinli klasör altı geçer', () => {
    expect(isAllowedUrl('https://azeotomasyon.sharepoint.com/AZE_external/Firsat_F03/a.pdf', P)).toBe(true)
    expect(isAllowedUrl('https://azeotomasyon.sharepoint.com/aze_external/x', P)).toBe(true)
  })
  it.each([
    'https://azeotomasyon.sharepoint.com/AZE_external_gizli/x',
    'https://azeotomasyon.sharepoint.com/AZE_externalx',
    'https://azeotomasyon.sharepoint.com/Finans/maas.xlsx',
    'https://azeotomasyon.sharepoint.com/AZE_external/../Finans/x',
    'https://azeotomasyon.sharepoint.com/AZE_external%2F..%2FFinans/x',
    'https://evil.sharepoint.com/AZE_external/x',
    'http://azeotomasyon.sharepoint.com/AZE_external/x',
    'not a url',
    '',
  ])('reddedilir: %s', (u) => expect(isAllowedUrl(u, P)).toBe(false))
  it('önek yoksa hiçbir şey geçmez', () => expect(isAllowedUrl('https://azeotomasyon.sharepoint.com/AZE_external/x', [])).toBe(false))
})
