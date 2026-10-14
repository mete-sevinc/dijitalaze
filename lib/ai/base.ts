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
