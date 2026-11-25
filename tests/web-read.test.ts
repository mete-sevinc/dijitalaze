import { describe, it, expect } from 'vitest'
import { parseAllowedUrl, extractPage } from '@/lib/web-read'

describe('web_read URL izin listesi', () => {
  it.each([
    'https://www.azeotomasyon.com/aze/kurumsal/hakkimizda/',
    'https://azeotomasyon.com/feed/',
    'https://www.youtube.com/@azeotomasyon/videos',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCK5wBNiFjJPQzQ9QfErGxHw',
    'https://www.instagram.com/azeotomasyon/',
    'https://www.tubitak.gov.tr/tr/destekler',
    'https://kosgeb.gov.tr/site/tr/genel/destekler',
    'https://ticaret.gov.tr/destekler',
  ])('izinli: %s', (u) => expect(() => parseAllowedUrl(u)).not.toThrow())

  it.each([
    'http://www.azeotomasyon.com/',
    'https://azeotomasyon.com.evil.com/',
    'https://evil.com/azeotomasyon.com',
    'https://user:pw@www.azeotomasyon.com/',
    'https://www.azeotomasyon.com:8443/',
    'https://127.0.0.1/',
    'https://169.254.169.254/latest/meta-data',
    'https://www.youtube.com/@baskasi',
    'https://www.youtube.com/@azeotomasyon/%2e%2e/x',
    'https://www.youtube.com/@azeotomasyon/baska',
    'https://tubitak.gov.tr.evil.com/',
    'https://nottubitak.gov.tr/',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCK5wBNiFjJPQzQ9QfErGxHw&channel_id=UCbaskasi',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCK5wBNiFjJPQzQ9QfErGxHw&user=x',
    'https://www.instagram.com/azeotomasyon/p/abc123/',
    'https://www.youtube.com/@azeotomasyonevil',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCbaskasi',
    'https://www.youtube.com/watch?v=../../x',
    'https://www.instagram.com/azeotomasyon-evil/',
    'https://www.instagram.com/p/abc123/',
    'https://www.instagram.com/baskasi/',
    'https://www.linkedin.com/company/azeotomasyon',
    'file:///etc/passwd',
    'not a url',
  ])('reddedilir: %s', (u) => expect(() => parseAllowedUrl(u)).toThrow())
})

describe('extractPage', () => {
  const base = new URL('https://www.azeotomasyon.com/')
  it('script/style temizler, başlık ve yalnız aynı host bağlantılarını döndürür', () => {
    const r = extractPage(
      '<html><title>AZE &amp; Co</title><meta name="description" content="Tanıtım"><script>alert(1)</script><p>Merhaba</p><a href="/a/">x</a><a href="https://evil.com/x">y</a></html>',
      'text/html',
      base
    ) as { başlık: string; metin: string; bağlantılar: string[] }
    expect(r.başlık).toBe('AZE & Co')
    expect(r.metin).toContain('Merhaba')
    expect(r.metin).not.toContain('alert')
    expect(r.bağlantılar).toEqual(['https://www.azeotomasyon.com/a/'])
  })
  it('RSS girdilerini çıkarır', () => {
    const r = extractPage('<?xml version="1.0"?><feed><entry><title>Video 1</title><link rel="alternate" href="https://www.youtube.com/watch?v=x"/><published>2026-01-01</published></entry></feed>', 'application/atom+xml', base) as { kayıtlar: { başlık: string }[] }
    expect(r.kayıtlar[0].başlık).toBe('Video 1')
  })
})
