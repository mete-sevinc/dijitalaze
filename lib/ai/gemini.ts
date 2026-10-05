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

    const res = await fetch(
      `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    )
    const data = await res.json()

    if (!res.ok) {
      throw new Error(`Gemini API error: ${JSON.stringify(data)}`)
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
