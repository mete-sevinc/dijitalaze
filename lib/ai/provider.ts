import type { AIProvider } from '@/lib/types'
import { AnthropicProvider } from './anthropic'
import { GeminiProvider } from './gemini'

export { BaseAIProvider } from './base'

let cachedProvider: AIProvider

export function createAIProvider(type: string = process.env.AI_PROVIDER || 'gemini'): AIProvider {
  if (cachedProvider) {
    return cachedProvider
  }

  if (type === 'anthropic') {
    cachedProvider = new AnthropicProvider(process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5')
    return cachedProvider
  }

  if (type === 'gemini') {
    cachedProvider = new GeminiProvider(process.env.GEMINI_MODEL || 'gemini-3.8-flash')
    return cachedProvider
  }

  throw new Error(`Unknown AI provider type: ${type}`)
}
