import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam, Tool, ContentBlockParam } from '@anthropic-ai/sdk/resources/messages'
import type { Provider, RunParams, RunResult, ToolCallRequest } from './types'

export class AnthropicProvider implements Provider {
  readonly id = 'anthropic' as const
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async run(params: RunParams): Promise<RunResult> {
    const messages: MessageParam[] = []
    for (const m of params.messages) {
      if (m.role === 'user') {
        messages.push({ role: 'user', content: m.content })
      } else if (m.role === 'assistant') {
        const blocks: ContentBlockParam[] = []
        if (m.content) blocks.push({ type: 'text', text: m.content })
        for (const t of m.toolCalls ?? []) {
          blocks.push({ type: 'tool_use', id: t.id, name: t.name, input: t.arguments })
        }
        messages.push({ role: 'assistant', content: blocks })
      } else if (m.role === 'tool') {
        messages.push({
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }]
        })
      }
    }

    const tools: Tool[] = params.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Tool['input_schema']
    }))

    const stream = this.client.messages.stream(
      {
        model: params.model,
        max_tokens: 4096,
        system: params.system,
        messages,
        tools: tools.length ? tools : undefined
      },
      { signal: params.signal }
    )

    stream.on('text', (delta) => params.onText(delta))

    const final = await stream.finalMessage()
    let text = ''
    const toolCalls: ToolCallRequest[] = []
    for (const block of final.content) {
      if (block.type === 'text') text += block.text
      else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: (block.input as Record<string, unknown>) ?? {}
        })
      }
    }

    return { text, toolCalls }
  }
}
