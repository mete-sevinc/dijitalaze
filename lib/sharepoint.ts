import { accessToken, SHAREPOINT_SCOPE } from '@/lib/assistant/mail'

// Çalışanlar için salt okunur SharePoint/portal erişimi. Fail closed:
// SHAREPOINT_OWNER_EMAIL (token sahibi) ve SHAREPOINT_ALLOWED_PREFIXES (izinli webUrl önekleri, virgüllü) tanımlı değilse hiçbir şey okunmaz.
const GRAPH = 'https://graph.microsoft.com/v1.0'
const MAX_BYTES = 300_000
const MAX_TEXT = 12_000
const ID_RE = /^[A-Za-z0-9!_\-]{5,300}$/

export class SharePointError extends Error {}

export function deniedPrefixes() {
  return parsePrefixes(process.env.SHAREPOINT_DENIED_PREFIXES)
}

export function allowedPrefixes(raw = process.env.SHAREPOINT_ALLOWED_PREFIXES): string[] {
  return parsePrefixes(raw)
}

function parsePrefixes(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter((x) => /^https:\/\/[a-z0-9-]+\.sharepoint\.com\/.+/i.test(x))
    .map((x) => (x.endsWith('/') ? x : x + '/'))
}

// Önek karşılaştırması segment sınırında: ".../AZE_external/" izinliyse ".../AZE_external_gizli/x" geçmez.
export function isAllowedUrl(webUrl: string | undefined, prefixes = allowedPrefixes(), denied = deniedPrefixes()): boolean {
  if (!webUrl) return false
  let u: URL
  try {
    u = new URL(webUrl)
  } catch {
    return false
  }
  if (u.protocol !== 'https:') return false
  let path: string
  try {
    path = decodeURIComponent(u.pathname)
  } catch {
    return false
  }
  // Nokta segmentleri ve ters eğik çizgi: önek atlatma (../) girişimi
  if (path.includes('\\') || path.split('/').some((seg) => seg === '.' || seg === '..')) return false
  const norm = u.origin.toLowerCase() + path
  const lower = norm.toLowerCase()
  // Engellenen klasörler her zaman izinlilerin önüne geçer
  if (denied.some((d) => lower.startsWith(d.toLowerCase()))) return false
  return prefixes.some((p) => lower.startsWith(p.toLowerCase()))
}

function ctx() {
  const owner = process.env.SHAREPOINT_OWNER_EMAIL?.trim().toLowerCase()
  const prefixes = allowedPrefixes()
  if (!owner || prefixes.length === 0) throw new SharePointError('SharePoint erişimi yapılandırılmamış')
  return { owner, prefixes }
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
  const { owner, prefixes } = ctx()
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
    .filter((h) => isAllowedUrl(h.resource?.webUrl, prefixes))
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
  const { owner, prefixes } = ctx()
  if (!ID_RE.test(driveId) || !ID_RE.test(itemId)) throw new SharePointError('Geçersiz kimlik')
  const meta = (await (await graph(owner, `/drives/${driveId}/items/${itemId}?$select=name,size,webUrl,file,lastModifiedDateTime`)).json()) as {
    name?: string; size?: number; webUrl?: string; lastModifiedDateTime?: string; file?: { mimeType?: string }
  }
  if (!isAllowedUrl(meta.webUrl, prefixes)) throw new SharePointError('Bu dosya izinli klasörlerde değil')
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
