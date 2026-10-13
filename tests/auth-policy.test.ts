import { describe, expect, it } from 'vitest'
import { emailFromProfile, isAllowedEmail, parseAllowedEmails } from '@/lib/auth-policy'

describe('parseAllowedEmails', () => {
  it('splits on commas, trims and lowercases', () => {
    expect(parseAllowedEmails(' Mete@AZE.com.tr , ayse@aze.com.tr ')).toEqual(['mete@aze.com.tr', 'ayse@aze.com.tr'])
  })
  it('drops empty entries', () => {
    expect(parseAllowedEmails('a@x.com,, ,')).toEqual(['a@x.com'])
  })
  it('returns an empty list when unset or blank', () => {
    expect(parseAllowedEmails(undefined)).toEqual([])
    expect(parseAllowedEmails('   ')).toEqual([])
  })
})

describe('isAllowedEmail', () => {
  const allowed = ['mete@aze.com.tr']
  it('allows a listed address, case-insensitively', () => {
    expect(isAllowedEmail('mete@aze.com.tr', allowed)).toBe(true)
    expect(isAllowedEmail('METE@aze.com.tr', allowed)).toBe(true)
  })
  it('rejects anyone not listed, including look-alike domains', () => {
    expect(isAllowedEmail('mete@aze.com.tr.evil.com', allowed)).toBe(false)
    expect(isAllowedEmail('x@aze.com.tr', allowed)).toBe(false)
  })
  it('fails closed with an empty allow-list or empty email', () => {
    expect(isAllowedEmail('mete@aze.com.tr', [])).toBe(false)
    expect(isAllowedEmail('', allowed)).toBe(false)
    expect(isAllowedEmail('', [''])).toBe(false)
  })
})

describe('emailFromProfile', () => {
  it('prefers email, falls back to preferred_username, lowercases', () => {
    expect(emailFromProfile({ email: 'A@B.com', preferred_username: 'x@y.com' })).toBe('a@b.com')
    expect(emailFromProfile({ preferred_username: 'X@Y.com' })).toBe('x@y.com')
  })
  it('returns an empty string for a missing profile', () => {
    expect(emailFromProfile(undefined)).toBe('')
    expect(emailFromProfile(null)).toBe('')
  })
})
