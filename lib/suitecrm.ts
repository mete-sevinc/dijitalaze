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
  return { endpoint: `${url.replace(/\/$/, '')}/service/v4_1/rest.php`, user, password }
}

async function call<T>(endpoint: string, method: string, data: unknown): Promise<T> {
  const body = new URLSearchParams({
    method,
    input_type: 'JSON',
    response_type: 'JSON',
    rest_data: JSON.stringify(data),
  })
  const res = await fetch(endpoint, { method: 'POST', body, signal: AbortSignal.timeout(TIMEOUT_MS) })
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
    no: r.number, ad: r.name, aşama: r.stage, tutar: r.total_amount, müşteri: r.billing_account,
    geçerlilik: r.expiration, oluşturma: r.date_entered, sorumlu: r.assigned_user_name,
  }))
}
