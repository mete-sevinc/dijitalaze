// Pazarlama çalışanı için salt okunur web okuma. Yalnız AZE'nin kendi alan adları ve sosyal hesapları (SSRF'e karşı sabit liste).
// Robot doğrulaması (LinkedIn vb.) aşılmaz; engellenen sayfa hata olarak döner.

const MAX_BYTES = 400_000
const MAX_TEXT = 12_000
const TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 3

const SITE_HOSTS = new Set(['azeotomasyon.com', 'www.azeotomasyon.com'])
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com'])
const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com'])

export class WebReadError extends Error {}

export function parseAllowedUrl(raw: string): URL {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new WebReadError('Geçersiz URL')
  }
  if (u.protocol !== 'https:') throw new WebReadError('Yalnız https')
  if (u.username || u.password || u.port) throw new WebReadError('Bu URL biçimine izin yok')
  const h = u.hostname.toLowerCase()
  const p = u.pathname.toLowerCase()
  if (SITE_HOSTS.has(h)) return u
  if (YOUTUBE_HOSTS.has(h)) {
    if (p === '/watch' || p === '/feeds/videos.xml' || p.startsWith('/@azeotomasyon') || p === '/channel/uck5wbnifjjpqzq9qfergxhw') return u
    throw new WebReadError('YouTube için yalnız @azeotomasyon kanalı, video sayfası veya kanal RSS\'i')
  }
  if (INSTAGRAM_HOSTS.has(h)) {
    if (p.startsWith('/azeotomasyon') || p.startsWith('/p/') || p.startsWith('/reel/')) return u
    throw new WebReadError('Instagram için yalnız @azeotomasyon hesabı ve gönderileri')
  }
  throw new WebReadError('Bu alan adı izinli değil (azeotomasyon.com, YouTube @azeotomasyon, Instagram @azeotomasyon)')
}

function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#039;/g, "'").replace(/&nbsp;/g, ' ')
}

function meta(html: string, key: string) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, 'i')
  return decodeEntities(html.match(re)?.[1] ?? '')
}

export function extractPage(body: string, contentType: string, base: URL) {
  if (/xml/.test(contentType) || body.trimStart().startsWith('<?xml')) {
    const entries = [...body.matchAll(/<(?:entry|item)>([\s\S]*?)<\/(?:entry|item)>/g)].slice(0, 30).map((m) => {
      const e = m[1]
      const title = decodeEntities(e.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '')
      const link = e.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? e.match(/<link>([^<]+)<\/link>/)?.[1] ?? ''
      const date = e.match(/<(?:published|pubDate)>([^<]+)</)?.[1] ?? ''
      const desc = decodeEntities((e.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1] ?? e.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').slice(0, 600)
      return { başlık: title, bağlantı: link, tarih: date, özet: desc }
    })
    return { tür: 'feed', kayıtlar: entries }
  }
  const title = decodeEntities(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim()
  const description = meta(body, 'og:description') || meta(body, 'description')
  const channelId = base.hostname.endsWith('youtube.com') ? body.match(/"externalId":"(UC[\w-]{22})"/)?.[1] : undefined
  const links = new Set<string>()
  for (const m of body.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)) {
    try {
      const l = new URL(decodeEntities(m[1]), base)
      if (l.protocol === 'https:' && l.hostname === base.hostname) links.add(l.origin + l.pathname + l.search)
    } catch {}
    if (links.size >= 80) break
  }
  const text = decodeEntities(
    body
      .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t\f\r]+/g, ' ')
    .replace(/\n\s*/g, '\n')
    .trim()
  return {
    tür: 'sayfa',
    başlık: title,
    açıklama: description,
    ...(channelId ? { youtube_rss: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}` } : {}),
    metin: text.slice(0, MAX_TEXT),
    kesildi: text.length > MAX_TEXT,
    bağlantılar: [...links],
  }
}

export async function readWeb(raw: string) {
  let url = parseAllowedUrl(raw)
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AZEDijital/1.0)', 'Accept-Language': 'tr,en;q=0.5' },
    })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = parseAllowedUrl(new URL(res.headers.get('location')!, url).toString())
      continue
    }
    if (!res.ok) throw new WebReadError(`Sayfa okunamadı (HTTP ${res.status})`)
    const ct = res.headers.get('content-type') ?? ''
    if (!/text\/|xml|json/.test(ct)) throw new WebReadError('Yalnız metin/HTML okunur')
    const reader = res.body?.getReader()
    if (!reader) throw new WebReadError('Boş yanıt')
    const chunks: Uint8Array[] = []
    let size = 0
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      size += value.length
    }
    await reader.cancel().catch(() => {})
    const body = new TextDecoder('utf-8').decode(Buffer.concat(chunks))
    return { url: url.toString(), ...extractPage(body, ct, url) }
  }
  throw new WebReadError('Çok fazla yönlendirme')
}
