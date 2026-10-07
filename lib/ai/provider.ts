import { AIProvider, AIMessage, AIResponse, AIStreamChunk, AITool } from '@/lib/types'

export abstract class BaseAIProvider implements AIProvider {
  protected model: string

  constructor(model: string) {
    this.model = model
  }

  abstract sendMessage(
    messages: AIMessage[],
    tools?: AITool[],
    modelOverride?: string
  ): Promise<AIResponse>

  abstract streamMessage(
    messages: AIMessage[],
    tools?: AITool[],
    modelOverride?: string
  ): AsyncGenerator<AIStreamChunk>

  protected getModel(modelOverride?: string): string {
    return modelOverride || this.model
  }
}

let cachedProvider: AIProvider

export function createAIProvider(type: string = process.env.AI_PROVIDER || 'gemini'): AIProvider {
  if (cachedProvider) {
    return cachedProvider
  }

  if (type === 'anthropic') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AnthropicProvider } = require('./anthropic')
    const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'
    cachedProvider = new AnthropicProvider(model)
    return cachedProvider
  }

  if (type === 'gemini') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GeminiProvider } = require('./gemini')
    const model = process.env.GEMINI_MODEL || 'gemini-flash-latest'
    cachedProvider = new GeminiProvider(model)
    return cachedProvider
  }

  throw new Error(`Unknown AI provider type: ${type}`)
}
