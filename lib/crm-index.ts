// CRM kaydını aranabilir metne çevirir (saf fonksiyonlar; veritabanı yok).

// Senkronlanan iş modülleri. Sistem/yapılandırma modülleri ve e-postalar bilerek dışarıda.
export const CRM_MODULES = [
  'Accounts', 'Contacts', 'Leads', 'Opportunities', 'Cases', 'Notes', 'Calls', 'Meetings', 'Tasks',
  'AOS_Quotes', 'AOS_Contracts', 'AOS_Invoices', 'AOS_Products', 'Project', 'ProjectTask', 'Documents', 'Bugs', 'Campaigns',
  'AOK_KnowledgeBase',
  'aze_PurchaseOrders', 'aze_ProjeDegerlendirme', 'aze_MaintenanceCalibration', 'aze_ServiceReport',
  'aze_OlcumTarama', 'aze_Stok', 'aze_KargoTakip',
] as const

// Aramaya değer katmayan alanlar: kimlikler, denetim alanları, harita/para birimi kalıntıları, mükerrer USD alanları.
const NOISE_KEY = /(^id$|_id$|^deleted$|^date_entered$|^date_modified$|^created_by|^modified_(user|by)|_usdollar$|^jjwg_|_lat_c$|_lng_c$|reminder|^email_opt_out$|^invalid_email$|^do_not_call$|^lawful|^currency|^email_and_name|_ida$|_idb$)/
const FIELD_MAX = 2000
const CONTENT_MAX = 12_000

const cleanText = (v: string) =>
  v.replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').replace(/[ \t]{2,}/g, ' ').trim()

export function buildRecord(module: string, id: string, fields: Record<string, string>) {
  const lines: string[] = []
  let size = 0
  for (const [key, raw] of Object.entries(fields)) {
    if (NOISE_KEY.test(key) || key === 'name') continue
    let v = cleanText(raw)
    // Çoklu seçim değerleri ^a^,^b^ biçiminde gelir.
    v = v.replace(/\^/g, '').trim()
    if (!v || /^0([.,]0+)?$/.test(v)) continue
    const line = `${key}: ${v.slice(0, FIELD_MAX)}`
    if (size + line.length > CONTENT_MAX) break
    lines.push(line)
    size += line.length + 1
  }
  const title =
    cleanText(fields.name ?? '') ||
    cleanText(fields.full_name ?? '') ||
    cleanText(`${fields.first_name ?? ''} ${fields.last_name ?? ''}`) ||
    `${module} ${id.slice(0, 8)}`
  return { title: title.slice(0, 200), content: lines.join('\n') }
}

// CRM date_modified (UTC, 'YYYY-MM-DD HH:MM:SS') → Date.
export function parseCrmDate(s: string | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return null
  return new Date(`${s.replace(' ', 'T')}Z`)
}

// Arama metnini ILIKE kalıplarına çevirir (en çok 6 terim; % _ \ kaçışlı).
export function likePatterns(query: string): string[] {
  return query
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 6)
    .map((t) => `%${t.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)
}
