import { createHash } from 'node:crypto'

// SuiteCRM 7 v4.1 REST istemcisi. Yalnız okuma; sorgular sabit (kullanıcı girdisi SQL'e girmez).
const TIMEOUT_MS = 15_000

type NameValue = { name: string; value: string }
type Entry = { id: string; name_value_list: Record<string, NameValue> }

function config() {
  const url = process.env.SUITECRM_URL
  const user = process.env.SUITECRM_USER
  const password = process.env.SUITECRM_PASSWORD
  if (!url || !user || !password) throw new Error('SuiteCRM bağlantısı yapılandırılmamış (SUITECRM_URL/USER/PASSWORD)')
  const u = new URL(url)
  if (u.protocol !== 'https:' || u.username || u.password) throw new Error('SUITECRM_URL https olmalı ve kimlik bilgisi içermemeli')
  return { endpoint: new URL('/service/v4_1/rest.php', u.origin).toString(), user, password }
}

async function call<T>(endpoint: string, method: string, data: unknown): Promise<T> {
  const body = new URLSearchParams({
    method,
    input_type: 'JSON',
    response_type: 'JSON',
    rest_data: JSON.stringify(data),
  })
  const res = await fetch(endpoint, { method: 'POST', body, redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`SuiteCRM yanıt vermedi (${res.status})`)
  const json = (await res.json()) as T & { name?: string; description?: string }
  if (json && typeof json === 'object' && 'name' in json && 'number' in json && json.description) {
    throw new Error(`SuiteCRM hatası: ${json.name}`)
  }
  return json
}

async function listEntries(module: string, query: string, fields: string[], order: string, max: number) {
  const { endpoint, user, password } = config()
  const login = await call<{ id?: string }>(endpoint, 'login', {
    user_auth: { user_name: user, password: createHash('md5').update(password).digest('hex') },
    application_name: 'dijitalaze',
  })
  if (!login.id) throw new Error('SuiteCRM girişi başarısız (kullanıcı adı/şifre)')
  const out = await call<{ entry_list?: Entry[] }>(endpoint, 'get_entry_list', [
    login.id, module, query, order, 0, fields, [], max, 0, false,
  ])
  return (out.entry_list ?? []).map((e) => {
    const row: Record<string, string> = { id: e.id }
    for (const f of fields) row[f] = e.name_value_list[f]?.value ?? ''
    return row
  })
}

// İndeks senkronu için: tüm alanlarıyla, date_modified sırasıyla sayfalı okuma. Oturum bir kez açılır.
// Modül adı ve filigran biçimi doğrulanır; sorguya yalnız doğrulanmış değerler girer.
export async function crmReader() {
  const { endpoint, user, password } = config()
  const login = await call<{ id?: string }>(endpoint, 'login', {
    user_auth: { user_name: user, password: createHash('md5').update(password).digest('hex') },
    application_name: 'dijitalaze',
  })
  if (!login.id) throw new Error('SuiteCRM girişi başarısız (kullanıcı adı/şifre)')
  const session = login.id
  return {
    async page(module: string, since: string | null, offset: number, max: number) {
      if (!/^[A-Za-z_]+$/.test(module)) throw new Error('Geçersiz modül adı')
      if (since !== null && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(since)) throw new Error('Geçersiz filigran')
      const t = module.toLowerCase()
      const out = await call<{ entry_list?: Entry[] }>(endpoint, 'get_entry_list', [
        session, module, since ? `${t}.date_modified >= '${since}'` : '', 'date_modified ASC, id ASC', // SuiteCRM yalnız tablo öneksiz order_by'ı uygular (önekliyi sessizce yok sayar)
        offset, [], [], max, 0, false,
      ])
      return (out.entry_list ?? []).map((e) => ({
        id: e.id,
        fields: Object.fromEntries(Object.entries(e.name_value_list ?? {}).map(([k, v]) => [k, String(v?.value ?? '')])),
      }))
    },
  }
}

// CRM alanları serbest metindir (güvenilmeyen veri): kontrol karakterleri atılır, uzunluk sınırlanır.
const clean = (v: string) => v.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 120)

// Bekleyen = henüz kabul/ret/kapanış almamış teklifler.
export async function pendingQuotes(limit = 25) {
  const rows = await listEntries(
    'AOS_Quotes',
    "aos_quotes.stage IN ('Draft','Negotiation','Delivered','On Hold')",
    ['number', 'name', 'stage', 'total_amount', 'currency_id', 'expiration', 'billing_account', 'date_entered', 'assigned_user_name'],
    'date_entered DESC',
    Math.min(Math.max(limit, 1), 50)
  )
  return rows.map((r) => ({
    no: clean(r.number), ad: clean(r.name), aşama: clean(r.stage), tutar: clean(r.total_amount), müşteri: clean(r.billing_account),
    geçerlilik: clean(r.expiration), oluşturma: clean(r.date_entered), sorumlu: clean(r.assigned_user_name),
  }))
}

const STATUS_TR: Record<string, string> = { 'Not Started': 'Başlatılmadı', 'In Progress': 'Devam ediyor' }

// month: 'YYYY-MM' (verilmezse İstanbul saatine göre içinde bulunulan ay). Tarih sınırları doğrulanmış sayılardan üretilir.
export async function ybaEndingIn(month?: string) {
  const m = month ?? new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }).slice(0, 7)
  const [y, mo] = m.split('-').map(Number)
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) throw new Error('Ay YYYY-MM biçiminde olmalı')
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  const rows = await listEntries(
    'AOS_Contracts',
    `aos_contracts.end_date BETWEEN '${m}-01' AND '${m}-${String(last).padStart(2, '0')}' AND aos_contracts.status <> 'Iptal_Edildi'`,
    ['name', 'status', 'start_date', 'end_date', 'contract_account', 'total_contract_value', 'assigned_user_name'],
    'end_date ASC',
    50
  )
  return rows.map((r) => ({
    ad: clean(r.name), müşteri: clean(r.contract_account), başlangıç: clean(r.start_date), bitiş: clean(r.end_date),
    durum: STATUS_TR[r.status] ?? clean(r.status), değer: clean(r.total_contract_value), sorumlu: clean(r.assigned_user_name),
  }))
}

// Teklif istatistiği için: verilen yılın (İstanbul saati) tüm teklifleri, yalnız gereken alanlarla. Sorguya yalnız tamsayı yıl girer.
export async function crmQuotesForYear(year: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Geçersiz yıl')
  const { endpoint, user, password } = config()
  const login = await call<{ id?: string }>(endpoint, 'login', {
    user_auth: { user_name: user, password: createHash('md5').update(password).digest('hex') },
    application_name: 'dijitalaze',
  })
  if (!login.id) throw new Error('SuiteCRM girişi başarısız (kullanıcı adı/şifre)')
  const session = login.id

  const cur = await call<{ entry_list?: Entry[] }>(endpoint, 'get_entry_list', [
    session, 'Currencies', '', '', 0, ['id', 'iso4217'], [], 50, 0, false,
  ])
  const currencies = new Map<string, string>([['-99', 'Varsayılan (-99)']])
  for (const e of cur.entry_list ?? []) currencies.set(e.id, e.name_value_list.iso4217?.value || e.id)

  // CRM tarihleri UTC; İstanbul yılı UTC+3 ile kayar.
  const from = new Date(Date.UTC(year, 0, 1) - 3 * 3600_000).toISOString().slice(0, 19).replace('T', ' ')
  const to = new Date(Date.UTC(year + 1, 0, 1) - 3 * 3600_000).toISOString().slice(0, 19).replace('T', ' ')
  const query = `aos_quotes.date_entered >= '${from}' AND aos_quotes.date_entered < '${to}'`
  const fields = ['stage', 'total_amt', 'currency_id', 'product_of_interest_c', 'cause_of_lost_c']

  const rows: { stage: string; total: number; currency: string; group: string; lostCauses: string[] }[] = []
  const PAGE = 200
  for (let offset = 0, i = 0; i < 50; i++) {
    const out = await call<{ entry_list?: Entry[]; next_offset?: number }>(endpoint, 'get_entry_list', [
      session, 'AOS_Quotes', query, 'date_entered ASC, id ASC', offset, fields, [], PAGE, 0, false,
    ])
    const list = out.entry_list ?? []
    for (const e of list) {
      const v = (k: string) => String(e.name_value_list[k]?.value ?? '')
      rows.push({
        stage: v('stage'),
        total: Number(v('total_amt')) || 0,
        currency: currencies.get(v('currency_id')) ?? (v('currency_id') || 'Varsayılan (-99)'),
        group: v('product_of_interest_c'),
        lostCauses: v('cause_of_lost_c').split(',').map((c) => c.replace(/\^/g, '').trim()).filter(Boolean),
      })
    }
    if (list.length < PAGE) break
    offset = out.next_offset ?? offset + PAGE
  }
  return rows
}
