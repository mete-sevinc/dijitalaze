import Anthropic from '@anthropic-ai/sdk'
import { BaseAIProvider } from './provider'
import { AIMessage, AIResponse, AIStreamChunk, AITool, AIToolUse } from '@/lib/types'
import {
  TextBlock,
  ToolUseBlock,
} from '@anthropic-ai/sdk/resources/messages'

export class AnthropicProvider extends BaseAIProvider {
  private client: Anthropic
  private maxTokens = 4096

  constructor(model: string) {
    super(model)
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }

  async sendMessage(
    messages: AIMessage[],
    tools?: AITool[],
    modelOverride?: string
  ): Promise<AIResponse> {
    const model = this.getModel(modelOverride)

    const anthropicMessages = messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }))

    const anthropicTools = tools?.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }))

    const response = await this.client.messages.create({
      model,
      max_tokens: this.maxTokens,
      messages: anthropicMessages,
      tools: anthropicTools,
      system: this.getSystemPrompt(),
    })

    const toolUses: AIToolUse[] = []
    let content = ''

    for (const block of response.content) {
      if (block.type === 'text') {
        content += (block as TextBlock).text
      } else if (block.type === 'tool_use') {
        const toolUseBlock = block as ToolUseBlock
        toolUses.push({
          id: toolUseBlock.id,
          name: toolUseBlock.name,
          input: toolUseBlock.input as Record<string, unknown>,
        })
      }
    }

    return {
      content,
      stopReason: this.mapStopReason(response.stop_reason || 'end_turn'),
      toolUses: toolUses.length > 0 ? toolUses : undefined,
    }
  }

  async *streamMessage(
    messages: AIMessage[],
    tools?: AITool[],
    modelOverride?: string
  ): AsyncGenerator<AIStreamChunk> {
    const model = this.getModel(modelOverride)

    const anthropicMessages = messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }))

    const anthropicTools = tools?.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }))

    const stream = await this.client.messages.create({
      model,
      max_tokens: this.maxTokens,
      messages: anthropicMessages,
      tools: anthropicTools,
      system: this.getSystemPrompt(),
      stream: true,
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          yield {
            type: 'text',
            content: event.delta.text,
          }
        }
      }
    }

    yield {
      type: 'end',
    }
  }

  private mapStopReason(
    reason: string
  ): 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' {
    switch (reason) {
      case 'end_turn':
        return 'end_turn'
      case 'tool_use':
        return 'tool_use'
      case 'max_tokens':
        return 'max_tokens'
      case 'stop_sequence':
        return 'stop_sequence'
      default:
        return 'end_turn'
    }
  }

  private getSystemPrompt(): string {
    return `You are an AI assistant representing a company employee. You should:

1. Respond in Turkish (Türkçe)
2. Be professional and helpful
3. Follow all instructions and rules provided in the context
4. Use the available tools to accomplish tasks
5. Always consider company policies and employee permissions
6. Escalate decisions when required by rules
7. Ask for clarification when needed
8. Be concise and action-oriented

Remember:
- Never make decisions beyond your authority
- Always follow approval rules
- Maintain professional communication
- Protect company interests
- Be efficient and focused`
  }
}
