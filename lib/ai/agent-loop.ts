import { AITool } from '@/lib/types'

// Hem kişisel asistanın hem personel ajanlarının kullandığı ortak araç döngüsü.
// Önce Gemini (model yedek zinciri), olmazsa GitHub Models (token varsa).

export type ToolSpec = AITool & { requiresApproval?: boolean }
export type ToolRunner = (name: string, args: unknown) => Promise<unknown>
export type HistoryItem = { role: string; content: string }

export interface AgentRunOptions {
  system: string
  history: HistoryItem[]
  userText: string
  tools: ToolSpec[]
  run: ToolRunner
  // Yazma yapan bir araç çalıştıysa sağlayıcı değiştirilmez (aynı işlem iki kez yazılmasın).
  hasSideEffects?: () => boolean
  maxRounds?: number
  // Her model yanıtı için token kullanımı bildirilir (maliyet/bütçe takibi).
  onUsage?: (u: { model: string; inputTokens: number; outputTokens: number }) => void
}

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta'
const GITHUB_MODELS_URL = 'https://models.github.ai/inference/chat/completions'
const REQUEST_TIMEOUT_MS = 25_000
const RETRYABLE = new Set([429, 500, 503, 504])
// Hızlı, düşünmesi kapalı modeller önce; ilk yanıt veren kazanır.
const FALLBACK_MODELS = ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-3.8-flash']
const PARTIAL_REPLY = 'İşlemi kaydettim ama yanıtı oluşturamadım. Listeden kontrol edebilirsin.'

interface GeminiPart {
  text?: string
  functionCall?: { name: string; args?: Record<string, unknown> }
  functionResponse?: { name: string; response: Record<string, unknown> }
}
interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

// JSON Schema (küçük harf tipler) → Gemini şeması (BÜYÜK HARF tipler).
function toGeminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toGeminiSchema)
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node).map(([k, v]) => [k, k === 'type' && typeof v === 'string' ? v.toUpperCase() : toGeminiSchema(v)])
    )
  }
  return node
}

// Model yoğun (503/429), zaman aşımında ya da bulunamazsa (404) sıradaki modele geçer.
// Düşünme kapalı istenir (gecikmeyi kısaltır); model bu alanı reddederse (400) alansız yeniden denenir.
async function callGemini(apiKey: string, body: Record<string, unknown>): Promise<{ res: Response; model: string }> {
  const models = [...new Set([process.env.GEMINI_MODEL, ...FALLBACK_MODELS].filter((m): m is string => !!m))]
  let last = 'Gemini yanıt vermedi'
  for (const model of models) {
    for (const thinkingOff of [true, false]) {
      const gen = (body.generationConfig ?? {}) as Record<string, unknown>
      const payload = thinkingOff ? { ...body, generationConfig: { ...gen, thinkingConfig: { thinkingBudget: 0 } } } : body
      const t0 = Date.now()
      let res: Response
      try {
        res = await fetch(`${GEMINI_URL}/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
      } catch {
        console.warn(`gemini ${model} timeout ${Date.now() - t0}ms`)
        last = `Gemini zaman aşımı (${model})`
        break
      }
      console.log(`gemini ${model} thinkingOff=${thinkingOff} status=${res.status} ${Date.now() - t0}ms`)
      if (res.ok) return { res, model }
      last = `Gemini API ${res.status} (${model}): ${(await res.text()).slice(0, 300)}`
      if (res.status === 400 && thinkingOff) continue
      if (res.status !== 404 && !RETRYABLE.has(res.status)) throw new Error(last)
      break
    }
  }
  throw new Error(last)
}

async function geminiTurn(o: AgentRunOptions): Promise<string> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY tanımlı değil')
  const declarations = o.tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: toGeminiSchema(t.inputSchema),
  }))
  const contents: GeminiContent[] = o.history.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  contents.push({ role: 'user', parts: [{ text: o.userText }] })

  let reply = ''
  for (let round = 0; round < (o.maxRounds ?? 6); round++) {
    const { res, model } = await callGemini(apiKey, {
      systemInstruction: { parts: [{ text: o.system }] },
      contents,
      tools: declarations.length ? [{ functionDeclarations: declarations }] : undefined,
      generationConfig: { maxOutputTokens: 1500 },
    })
    const data = await res.json()
    o.onUsage?.({
      model,
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    })
    const parts: GeminiPart[] = data.candidates?.[0]?.content?.parts ?? []
    reply = parts.map((p) => p.text ?? '').join('')

    const calls = parts.filter((p) => p.functionCall)
    if (calls.length === 0) break

    contents.push({ role: 'model', parts })
    const responses: GeminiPart[] = []
    for (const p of calls) {
      const { name, args } = p.functionCall!
      try {
        responses.push({ functionResponse: { name, response: { result: await o.run(name, args ?? {}) } } })
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

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[]
  tool_call_id?: string
}

async function githubModelsTurn(token: string, o: AgentRunOptions): Promise<string> {
  const model = process.env.GITHUB_MODELS_MODEL || 'openai/gpt-4.1-mini'
  const tools = o.tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.inputSchema },
  }))
  const messages: OpenAIMessage[] = [
    { role: 'system', content: o.system },
    ...o.history.map((m): OpenAIMessage => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    { role: 'user', content: o.userText },
  ]

  let reply = ''
  for (let round = 0; round < (o.maxRounds ?? 6); round++) {
    const res = await fetch(GITHUB_MODELS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ model, messages, tools: tools.length ? tools : undefined, max_tokens: 1500 }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`GitHub Models ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const data = await res.json()
    o.onUsage?.({
      model,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    })
    const msg: OpenAIMessage | undefined = data.choices?.[0]?.message
    reply = msg?.content ?? ''
    const calls = msg?.tool_calls ?? []
    if (calls.length === 0) break

    messages.push({ role: 'assistant', content: msg?.content ?? null, tool_calls: calls })
    for (const c of calls) {
      let content: string
      try {
        content = JSON.stringify(await o.run(c.function.name, JSON.parse(c.function.arguments || '{}')))
      } catch (e) {
        content = JSON.stringify({ error: e instanceof Error ? e.message : 'Araç hatası' })
      }
      messages.push({ role: 'tool', tool_call_id: c.id, content })
    }
  }
  return reply
}

export async function runAgent(o: AgentRunOptions): Promise<string> {
  try {
    return await geminiTurn(o)
  } catch (primaryError) {
    console.error('gemini turn failed', primaryError)
    if (o.hasSideEffects?.()) return PARTIAL_REPLY
    const token = process.env.GITHUB_MODELS_TOKEN
    if (!token) throw primaryError
    return await githubModelsTurn(token, o)
  }
}
