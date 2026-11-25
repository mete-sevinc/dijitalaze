import { accessToken, SHAREPOINT_SCOPE } from '@/lib/assistant/mail'

// Çalışanlar için salt okunur SharePoint/portal erişimi. Fail closed:
// SHAREPOINT_OWNER_EMAIL (token sahibi) ve SHAREPOINT_ALLOWED_PREFIXES (izinli webUrl önekleri, virgüllü) tanımlı değilse hiçbir şey okunmaz.
const GRAPH = 'https://graph.microsoft.com/v1.0'
const MAX_BYTES = 300_000
const MAX_TEXT = 12_000
const ID_RE = /^[A-Za-z0-9!_\-]{5,300}$/

export class SharePointError extends Error {}

type Prefix = { origin: string; segs: string[] }

const norm = (x: string) => x.normalize('NFC').toLowerCase()

// "https://x.sharepoint.com/A/B" -> { origin, segs: ['a','b'] }; geçersizse null
function parsePrefix(raw: string): Prefix | null {
  if (/\.\.|%2e|%2f|%5c|\\|\/\//i.test(raw.trim().replace(/^https:\/\//i, ''))) return null
  let u: URL
  try {
    u = new URL(raw.trim())
    if (u.protocol !== 'https:' || !/^[a-z0-9-]+\.sharepoint\.com$/i.test(u.hostname) || u.search || u.hash || u.username || u.password || u.port) return null
    const path = decodeURIComponent(u.pathname)
    if (path.includes('//') || path.includes('\\')) return null
    const segs = path.split('/').filter(Boolean).map(norm)
    if (segs.length === 0 || segs.some((x) => x === '.' || x === '..')) return null
    return { origin: u.origin.toLowerCase(), segs }
  } catch {
    return null
  }
}

// Yapılandırma: tek bir bozuk kayıt bile varsa tamamı reddedilir (sessizce atlanmaz)
export function parsePrefixList(raw: string | undefined): Prefix[] {
  const parts = (raw ?? '').split(',').map((x) => x.trim()).filter(Boolean)
  const list = parts.map(parsePrefix)
  if (list.some((x) => x === null)) throw new SharePointError('SharePoint önek ayarı geçersiz')
  return list as Prefix[]
}

export function allowedPrefixes(raw = process.env.SHAREPOINT_ALLOWED_PREFIXES): Prefix[] {
  return parsePrefixList(raw)
}

export function deniedPrefixes(raw = process.env.SHAREPOINT_DENIED_PREFIXES): Prefix[] {
  return parsePrefixList(raw)
}

// Adında arşiv geçen her klasör/dosya segmenti engellidir (ör. ARSIV_2012-2025, tmp_ARSIV_2012-2026)
const DENIED_SEGMENT_WORDS = ['arsiv', 'arşiv', 'archive']
const isArchiveSegment = (seg: string) => DENIED_SEGMENT_WORDS.some((w) => seg.includes(w))

const covers = (p: Prefix, origin: string, segs: string[]) => p.origin === origin && p.segs.length <= segs.length && p.segs.every((x, i) => x === segs[i])

// Segment sınırında, normalize edilmiş eşleşme. Belirsiz biçimler (sorgu, //, .., /Forms/, kodlama hatası) reddedilir.
export function isAllowedUrl(webUrl: string | undefined, allow: Prefix[] = allowedPrefixes(), deny: Prefix[] = deniedPrefixes()): boolean {
  if (!webUrl) return false
  try {
    const u = new URL(webUrl)
    if (u.protocol !== 'https:' || u.search || u.hash || u.username || u.password || u.port) return false
    const path = decodeURIComponent(u.pathname)
    if (path.includes('//') || path.includes('\\')) return false
    const segs = path.split('/').filter(Boolean).map(norm)
    if (segs.some((x) => x === '.' || x === '..' || x === 'forms' || isArchiveSegment(x))) return false
    const origin = u.origin.toLowerCase()
    if (deny.some((d) => covers(d, origin, segs))) return false
    return allow.some((a) => covers(a, origin, segs))
  } catch {
    return false
  }
}

function ctx() {
  const owner = process.env.SHAREPOINT_OWNER_EMAIL?.trim().toLowerCase()
  const prefixes = allowedPrefixes()
  const denied = deniedPrefixes()
  if (!owner || prefixes.length === 0) throw new SharePointError('SharePoint erişimi yapılandırılmamış')
  return { owner, prefixes, denied }
}

async function graph(owner: string, path: string, init?: RequestInit) {
  let token: string
  try {
    token = await accessToken(owner, SHAREPOINT_SCOPE)
  } catch {
    throw new SharePointError('SharePoint yetkisi yok: Mete çıkış yapıp Microsoft ile tekrar giriş yapıp yeni izinleri onaylamalı')
  }
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new SharePointError(`SharePoint isteği başarısız (HTTP ${res.status})`)
  return res
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

export async function searchSharePoint(query: string, limit = 10) {
  const { owner, prefixes, denied } = ctx()
  const res = await graph(owner, '/search/query', {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ entityTypes: ['driveItem'], query: { queryString: query.slice(0, 200) }, from: 0, size: 25 }],
    }),
  })
  type Res = { name?: string; webUrl?: string; lastModifiedDateTime?: string; size?: number; id?: string; parentReference?: { driveId?: string } }
  const json = (await res.json()) as { value?: { hitsContainers?: { hits?: { summary?: string; resource?: Res }[] }[] }[] }
  const hits = json.value?.[0]?.hitsContainers?.[0]?.hits ?? []
  return hits
    .filter((h) => isAllowedUrl(h.resource?.webUrl, prefixes, denied))
    .slice(0, Math.min(limit, 20))
    .map((h) => ({
      ad: String(h.resource?.name ?? ''),
      bağlantı: String(h.resource?.webUrl ?? ''),
      değişiklik: String(h.resource?.lastModifiedDateTime ?? '').slice(0, 10),
      boyut: h.resource?.size,
      özet: stripTags(h.summary ?? '').slice(0, 400),
      driveId: h.resource?.parentReference?.driveId,
      itemId: h.resource?.id,
    }))
}

export async function readSharePointItem(driveId: string, itemId: string) {
  const { owner, prefixes, denied } = ctx()
  if (!ID_RE.test(driveId) || !ID_RE.test(itemId)) throw new SharePointError('Geçersiz kimlik')
  const meta = (await (await graph(owner, `/drives/${driveId}/items/${itemId}?$select=name,size,webUrl,file,lastModifiedDateTime`)).json()) as {
    name?: string; size?: number; webUrl?: string; lastModifiedDateTime?: string; file?: { mimeType?: string }
  }
  if (!isAllowedUrl(meta.webUrl, prefixes, denied)) throw new SharePointError('Bu dosya izinli klasörlerde değil')
  const base = { ad: meta.name, bağlantı: meta.webUrl, değişiklik: String(meta.lastModifiedDateTime ?? '').slice(0, 10), boyut: meta.size }
  const mime = String(meta.file?.mimeType ?? '')
  const isText = /^text\//.test(mime) || /(json|csv|xml)$/.test(mime)
  if (!isText || (meta.size ?? Infinity) > MAX_BYTES) {
    return { ...base, içerik: null, not: 'Bu dosya türü/boyutu doğrudan okunamaz; arama sonucundaki özeti ve bağlantıyı kullan.' }
  }
  const content = await graph(owner, `/drives/${driveId}/items/${itemId}/content`, { headers: { 'content-type': 'text/plain' } })
  // Gerçek akışta da sınırla: meta.size'a güvenme
  const reader = content.body?.getReader()
  if (!reader) throw new SharePointError('Boş yanıt')
  const chunks: Uint8Array[] = []
  let size = 0
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read()
    if (done) break
    const room = MAX_BYTES - size
    chunks.push(value.length > room ? value.subarray(0, room) : value)
    size += Math.min(value.length, room)
  }
  await reader.cancel().catch(() => {})
  const text = new TextDecoder('utf-8').decode(Buffer.concat(chunks)).slice(0, MAX_TEXT)
  return { ...base, içerik: text }
}
