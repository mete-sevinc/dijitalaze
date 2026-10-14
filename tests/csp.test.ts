import { describe, expect, it } from 'vitest'
import { buildCsp, isPublicPath, newNonce } from '@/lib/csp'

describe('csp', () => {
  it('locks scripts to the request nonce and forbids plugins, framing and foreign form targets', () => {
    const csp = buildCsp('abc123')
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'")
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/)
    expect(csp).not.toMatch(/script-src[^;]*unsafe-eval/)
    for (const d of ["object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "default-src 'self'"]) expect(csp).toContain(d)
  })
  it('allows unsafe-eval only in development', () => {
    expect(buildCsp('n', true)).toContain("'unsafe-eval'")
    expect(buildCsp('n', false)).not.toContain("'unsafe-eval'")
  })
  it('creates a fresh, header-safe nonce each time', () => {
    const a = newNonce()
    const b = newNonce()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[A-Za-z0-9+/=]+$/)
  })
  it('keeps only the login pages public', () => {
    expect(isPublicPath('/giris')).toBe(true)
    expect(isPublicPath('/giris-hatasi')).toBe(true)
    for (const p of ['/', '/dashboard', '/giris/x', '/api/anything', '/giris-hatasi/x']) expect(isPublicPath(p)).toBe(false)
  })
})
