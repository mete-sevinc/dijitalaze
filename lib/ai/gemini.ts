import { BaseAIProvider } from './provider'
import { AIMessage, AIResponse, AIStreamChunk, AITool, AIToolUse } from '@/lib/types'

interface GeminiContent {
  role: 'user' | 'model'
  parts: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> }; functionResponse?: unknown }>
}

interface GeminiFunctionDeclaration {
  name: string
  description: string
  parameters: Record<string, unknown>
}

const REQUEST_TIMEOUT_MS = 20_000
const RETRYABLE = new Set([429, 500, 503, 504])
const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest']

export class GeminiProvider extends BaseAIProvider {
  private apiKey: string
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta'

  constructor(model: string) {
    super(model)
    this.apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || ''
  }

  async sendMessage(
    messages: AIMessage[],
    tools?: AITool[],
    modelOverride?: string
  ): Promise<AIResponse> {
    const model = this.getModel(modelOverride)
    const { system, contents } = this.convertMessages(messages)
    const geminiTools = this.convertTools(tools)

    const body: Record<string, unknown> = {
      contents,
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      tools: geminiTools.length > 0 ? [{ functionDeclarations: geminiTools }] : undefined,
      generationConfig: { maxOutputTokens: 4096 },
    }

    // Busy (429/5xx), timed-out or missing (404) model falls through to the next one.
    const models = [...new Set([model, ...FALLBACK_MODELS])]
    let res: Response | undefined
    let data: Record<string, any> = {} // eslint-disable-line @typescript-eslint/no-explicit-any
    let lastError = 'Gemini yanıt vermedi'
    for (const m of models) {
      try {
        res = await fetch(`${this.baseUrl}/models/${m}:generateContent?key=${this.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
        data = await res.json()
        if (res.ok) break
        lastError = `Gemini API error (${m}): ${JSON.stringify(data)}`
        if (!RETRYABLE.has(res.status) && res.status !== 404) break
      } catch (e) {
        res = undefined
        lastError = `Gemini zaman aşımı/bağlantı hatası (${m}): ${e instanceof Error ? e.message : e}`
      }
    }
    if (!res || !res.ok) {
      throw new Error(lastError)
    }

    const candidate = data.candidates?.[0]
    const parts = candidate?.content?.parts || []
    let content = ''
    const toolUses: AIToolUse[] = []

    for (const part of parts) {
      if (part.text) content += part.text
      if (part.functionCall) {
        toolUses.push({
          id: `tool_${Date.now()}`,
          name: part.functionCall.name,
          input: part.functionCall.args || {},
        })
      }
    }

    const finishReason = candidate?.finishReason
    return {
      content,
      stopReason: finishReason === 'STOP' ? 'end_turn' : finishReason === 'MAX_TOKENS' ? 'max_tokens' : 'end_turn',
      toolUses: toolUses.length > 0 ? toolUses : undefined,
    }
  }

  async *streamMessage(
    messages: AIMessage[],
    tools?: AITool[],
    modelOverride?: string
  ): AsyncGenerator<AIStreamChunk> {
    const model = this.getModel(modelOverride)
    const { system, contents } = this.convertMessages(messages)
    const geminiTools = this.convertTools(tools)

    const body: Record<string, unknown> = {
      contents,
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      tools: geminiTools.length > 0 ? [{ functionDeclarations: geminiTools }] : undefined,
      generationConfig: { maxOutputTokens: 4096 },
    }

    const res = await fetch(
      `${this.baseUrl}/models/${model}:streamGenerateContent?key=${this.apiKey}&alt=sse`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    )

    if (!res.ok || !res.body) {
      throw new Error(`Gemini stream error: ${res.status}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const jsonStr = line.slice(6).trim()
        if (!jsonStr || jsonStr === '[DONE]') continue
        try {
          const chunk = JSON.parse(jsonStr)
          const parts = chunk.candidates?.[0]?.content?.parts || []
          for (const part of parts) {
            if (part.text) yield { type: 'text', content: part.text }
          }
        } catch { /* skip malformed */ }
      }
    }

    yield { type: 'end' }
  }

  private convertMessages(messages: AIMessage[]): { system: string; contents: GeminiContent[] } {
    let system = ''
    const contents: GeminiContent[] = []

    for (const msg of messages) {
      if (msg.role === 'system') {
        system += msg.content + '\n'
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        })
      }
    }

    // Gemini requires alternating user/model, ensure starts with user
    if (contents.length === 0 || contents[0].role !== 'user') {
      contents.unshift({ role: 'user', parts: [{ text: 'Merhaba' }] })
    }

    return { system: system.trim(), contents }
  }

  private convertTools(tools?: AITool[]): GeminiFunctionDeclaration[] {
    if (!tools) return []
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    }))
  }
}
