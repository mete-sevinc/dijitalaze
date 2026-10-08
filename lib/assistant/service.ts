import { z } from 'zod'
import { prisma } from '@/lib/db'

const MAX_TOOL_ROUNDS = 6
const HISTORY_LIMIT = 20

const isoDate = z.string().datetime({ offset: true })

const addTaskInput = z.object({
  title: z.string().min(1).max(300),
  due_at: isoDate.optional(),
  remind_at: isoDate.optional(),
})
const listTasksInput = z.object({ include_done: z.boolean().optional() })
const completeTaskInput = z.object({ id: z.string().min(1) })
const addNoteInput = z.object({ content: z.string().min(1).max(5000) })
const listNotesInput = z.object({ query: z.string().max(200).optional() })

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta'

const functionDeclarations = [
  {
    name: 'add_task',
    description:
      'İş/görev veya hatırlatma ekler. Kullanıcı bir zamanda hatırlatılmak istiyorsa remind_at ver. Son tarih varsa due_at ver.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        due_at: { type: 'STRING', description: 'ISO 8601, saat dilimi ofsetli (+03:00)' },
        remind_at: { type: 'STRING', description: 'ISO 8601, saat dilimi ofsetli (+03:00)' },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_tasks',
    description: 'Görevleri ve hatırlatmaları listeler. Varsayılan: sadece tamamlanmamışlar.',
    parameters: { type: 'OBJECT', properties: { include_done: { type: 'BOOLEAN' } } },
  },
  {
    name: 'complete_task',
    description: 'Görevi tamamlandı olarak işaretler. id list_tasks sonucundan alınır.',
    parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } }, required: ['id'] },
  },
  {
    name: 'add_note',
    description: 'Kullanıcının notunu kaydeder.',
    parameters: { type: 'OBJECT', properties: { content: { type: 'STRING' } }, required: ['content'] },
  },
  {
    name: 'list_notes',
    description: 'Notları listeler; query verilirse içinde arar. En yeni 20 not döner.',
    parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' } } },
  },
]

interface GeminiPart {
  text?: string
  functionCall?: { name: string; args?: Record<string, unknown> }
  functionResponse?: { name: string; response: Record<string, unknown> }
}
interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

function istanbulNow(): string {
  const d = new Date()
  const text = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(d)
  return `${text} (Europe/Istanbul, UTC+03:00)`
}

function systemPrompt(): string {
  return `Sen Mete'nin kişisel asistanısın. Türkçe, kısa ve net yaz.
Görevlerin: günlük işlerini takip etmek, hatırlatma kurmak, notlarını saklamak ve planlarını özetlemek.
Şu an: ${istanbulNow()}. Göreli zamanları ("yarın 10'da", "2 saat sonra") bu saate göre hesapla ve araçlara +03:00 ofsetli ISO 8601 ver.
Kayıt/silme/tamamlama gibi işlemleri yalnızca araçlarla yap; araç çalışmadan "yaptım" deme.
Tarih/saat belirsizse tahmin etme, tek kısa soru sor.`
}

function fmt(d: Date | null): string | null {
  return d ? d.toISOString() : null
}

async function runTool(owner: string, name: string, input: unknown): Promise<unknown> {
  switch (name) {
    case 'add_task': {
      const p = addTaskInput.parse(input)
      const t = await prisma.assistantTask.create({
        data: {
          ownerEmail: owner,
          title: p.title,
          dueAt: p.due_at ? new Date(p.due_at) : null,
          remindAt: p.remind_at ? new Date(p.remind_at) : null,
        },
      })
      return { id: t.id, title: t.title, dueAt: fmt(t.dueAt), remindAt: fmt(t.remindAt) }
    }
    case 'list_tasks': {
      const p = listTasksInput.parse(input)
      const rows = await prisma.assistantTask.findMany({
        where: { ownerEmail: owner, ...(p.include_done ? {} : { doneAt: null }) },
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
        take: 50,
      })
      return rows.map((t) => ({
        id: t.id,
        title: t.title,
        dueAt: fmt(t.dueAt),
        remindAt: fmt(t.remindAt),
        done: !!t.doneAt,
      }))
    }
    case 'complete_task': {
      const p = completeTaskInput.parse(input)
      const r = await prisma.assistantTask.updateMany({
        where: { id: p.id, ownerEmail: owner, doneAt: null },
        data: { doneAt: new Date() },
      })
      return { updated: r.count }
    }
    case 'add_note': {
      const p = addNoteInput.parse(input)
      const n = await prisma.assistantNote.create({ data: { ownerEmail: owner, content: p.content } })
      return { id: n.id }
    }
    case 'list_notes': {
      const p = listNotesInput.parse(input)
      const rows = await prisma.assistantNote.findMany({
        where: {
          ownerEmail: owner,
          ...(p.query ? { content: { contains: p.query, mode: 'insensitive' } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
      return rows.map((n) => ({ id: n.id, content: n.content, createdAt: n.createdAt.toISOString() }))
    }
    default:
      throw new Error(`Bilinmeyen araç: ${name}`)
  }
}

const REQUEST_TIMEOUT_MS = 15_000
const RETRYABLE = new Set([429, 500, 503, 504])
const FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest']

// Model yoğun (503/429), zaman aşımında ya da bulunamazsa (404) sıradaki modele geçer.
async function callGemini(apiKey: string, preferred: string | undefined, body: unknown): Promise<Response> {
  const models = [...new Set([preferred, ...FALLBACK_MODELS].filter((m): m is string => !!m))]
  let last = 'Gemini yanıt vermedi'
  for (const model of models) {
    let res: Response
    try {
      res = await fetch(`${GEMINI_URL}/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch {
      last = `Gemini zaman aşımı (${model})`
      continue
    }
    if (res.ok) return res
    last = `Gemini API ${res.status} (${model}): ${(await res.text()).slice(0, 300)}`
    if (res.status !== 404 && !RETRYABLE.has(res.status)) throw new Error(last)
  }
  throw new Error(last)
}

type HistoryItem = { role: string; content: string }
type ToolRunner = (name: string, args: unknown) => Promise<unknown>

const GITHUB_MODELS_URL = 'https://models.github.ai/inference/chat/completions'
const MUTATING_TOOLS = new Set(['add_task', 'complete_task', 'add_note'])

async function geminiTurn(
  history: HistoryItem[],
  userText: string,
  run: ToolRunner
): Promise<string> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY tanımlı değil')
  const contents: GeminiContent[] = history.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  contents.push({ role: 'user', parts: [{ text: userText }] })

  let reply = ''
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await callGemini(apiKey, process.env.GEMINI_MODEL, {
      systemInstruction: { parts: [{ text: systemPrompt() }] },
      contents,
      tools: [{ functionDeclarations }],
      generationConfig: { maxOutputTokens: 1500 },
    })
    const data = await res.json()
    const parts: GeminiPart[] = data.candidates?.[0]?.content?.parts ?? []
    reply = parts.map((p) => p.text ?? '').join('')

    const calls = parts.filter((p) => p.functionCall)
    if (calls.length === 0) break

    contents.push({ role: 'model', parts })
    const responses: GeminiPart[] = []
    for (const p of calls) {
      const { name, args } = p.functionCall!
      try {
        responses.push({ functionResponse: { name, response: { result: await run(name, args ?? {}) } } })
      } catch (e) {
        responses.push({
          functionResponse: { name, response: { error: e instanceof Error ? e.message : 'Araç hatası' } },
        })
      }
    }
    contents.push({ role: 'user', parts: responses })
  }
  return reply
}

// Gemini şemasındaki (BÜYÜK HARFLİ) tipleri OpenAI/JSON Schema biçimine çevirir.
function toJsonSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toJsonSchema)
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node).map(([k, v]) => [k, k === 'type' && typeof v === 'string' ? v.toLowerCase() : toJsonSchema(v)])
    )
  }
  return node
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[]
  tool_call_id?: string
}

async function githubModelsTurn(
  token: string,
  history: HistoryItem[],
  userText: string,
  run: ToolRunner
): Promise<string> {
  const model = process.env.GITHUB_MODELS_MODEL || 'openai/gpt-4.1-mini'
  const tools = functionDeclarations.map((f) => ({
    type: 'function',
    function: { name: f.name, description: f.description, parameters: toJsonSchema(f.parameters) },
  }))
  const messages: OpenAIMessage[] = [
    { role: 'system', content: systemPrompt() },
    ...history.map((m): OpenAIMessage => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    { role: 'user', content: userText },
  ]

  let reply = ''
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await fetch(GITHUB_MODELS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ model, messages, tools, max_tokens: 1500 }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`GitHub Models ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const msg: OpenAIMessage | undefined = (await res.json()).choices?.[0]?.message
    reply = msg?.content ?? ''
    const calls = msg?.tool_calls ?? []
    if (calls.length === 0) break

    messages.push({ role: 'assistant', content: msg?.content ?? null, tool_calls: calls })
    for (const c of calls) {
      let content: string
      try {
        content = JSON.stringify(await run(c.function.name, JSON.parse(c.function.arguments || '{}')))
      } catch (e) {
        content = JSON.stringify({ error: e instanceof Error ? e.message : 'Araç hatası' })
      }
      messages.push({ role: 'tool', tool_call_id: c.id, content })
    }
  }
  return reply
}

export async function chatWithAssistant(owner: string, userText: string): Promise<string> {
  const past = await prisma.assistantMessage.findMany({
    where: { ownerEmail: owner },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_LIMIT,
  })
  const history = past.reverse()

  // Kaydedici araçlar çalıştıysa sağlayıcı değiştirilmez (aynı işlem iki kez yazılmasın).
  const done: string[] = []
  const run: ToolRunner = async (name, args) => {
    const out = await runTool(owner, name, args)
    if (MUTATING_TOOLS.has(name)) done.push(`${name}: ${JSON.stringify(out)}`)
    return out
  }

  let reply = ''
  try {
    reply = await geminiTurn(history, userText, run)
  } catch (primaryError) {
    console.error('gemini turn failed', primaryError)
    const token = process.env.GITHUB_MODELS_TOKEN
    if (done.length > 0) {
      reply = 'İşlemi kaydettim ama yanıtı oluşturamadım. Sağ paneldeki listeden kontrol edebilirsin.'
    } else if (token) {
      reply = await githubModelsTurn(token, history, userText, run)
    } else {
      throw primaryError
    }
  }

  reply = reply || 'Bir yanıt üretemedim, tekrar dener misin?'
  // Aynı createdAt sıralamayı belirsiz yapmasın diye yanıt 1 ms sonraya yazılır.
  const now = Date.now()
  await prisma.assistantMessage.createMany({
    data: [
      { ownerEmail: owner, role: 'user', content: userText, createdAt: new Date(now) },
      { ownerEmail: owner, role: 'assistant', content: reply, createdAt: new Date(now + 1) },
    ],
  })
  return reply
}
